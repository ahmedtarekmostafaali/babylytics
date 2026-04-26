-- 025_whatsapp_outbox.sql
-- Wires the medication-reminder pipeline that the whatsapp-dose-reminder
-- edge function consumes:
--   * whatsapp_outbox: queued / sent / failed messages, one row per user per
--     scheduled dose. Unique on (medication_id, user_id, scheduled_for) so
--     a re-run of the cron never double-sends.
--   * pending_med_reminders(): SQL function the edge function calls to pull
--     the next batch of doses that are due in the next ±15 minutes for
--     opted-in caregivers, joined with their WhatsApp number.
--
-- The edge function inserts an outbox row before calling Twilio so
-- concurrent runs can see "this is being sent". After the Twilio call it
-- updates the row to 'sent' or 'failed'.
--
-- Safe to re-run.

begin;

create table if not exists public.whatsapp_outbox (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  baby_id         uuid not null references public.babies(id) on delete cascade,
  medication_id   uuid references public.medications(id) on delete cascade,
  scheduled_for   timestamptz not null,                        -- when the dose is due
  e164            text not null,                               -- recipient number
  body            text not null,                               -- rendered message text
  status          text not null default 'queued' check (status in ('queued','sent','failed','cancelled')),
  twilio_sid      text,                                        -- Twilio message SID after send
  error           text,                                        -- last error message on failure
  attempts        int  not null default 0,
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- One reminder per (med, user, scheduled time). Lets the worker insert with
-- ON CONFLICT DO NOTHING and treat "already enqueued" as a no-op.
create unique index if not exists whatsapp_outbox_dedup
  on public.whatsapp_outbox (medication_id, user_id, scheduled_for)
  where medication_id is not null;

create index if not exists whatsapp_outbox_pending_idx
  on public.whatsapp_outbox (status, scheduled_for)
  where status = 'queued';

-- Service-role (edge function) bypasses RLS, but we still enable it so the
-- table never accidentally leaks via the anon key. Users can read their own
-- recent reminders if we ever want to surface a "WhatsApp delivery log".
alter table public.whatsapp_outbox enable row level security;

drop policy if exists whatsapp_outbox_self_select on public.whatsapp_outbox;
create policy whatsapp_outbox_self_select on public.whatsapp_outbox
  for select using (user_id = auth.uid());

-- updated_at trigger
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_whatsapp_outbox_set_updated_at on public.whatsapp_outbox;
    create trigger trg_whatsapp_outbox_set_updated_at
      before update on public.whatsapp_outbox
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ─── Helper: find pending doses that need a WhatsApp reminder ────────────
-- Called by the edge function each cron tick. Returns dose tuples for any
-- baby/user combination where:
--   * the user has opted into WhatsApp reminders (user_preferences),
--   * the user has a non-null phone number,
--   * the user has parent/caregiver/owner role on the baby,
--   * the medication's next computed dose lands within the lookahead window
--     and isn't already in the outbox.
--
-- Frequency math is intentionally simple — we compute "next dose" as
-- starts_at + N * frequency_hours where N produces the smallest non-past
-- timestamp. A more sophisticated scheduler can replace this once Batch L
-- proves itself.
create or replace function public.pending_med_reminders(
  p_lookahead_minutes int default 15,
  p_window_minutes    int default 15
)
returns table (
  medication_id uuid,
  baby_id       uuid,
  user_id       uuid,
  e164          text,
  baby_name     text,
  med_name      text,
  med_dosage    text,
  scheduled_for timestamptz
)
language sql
security definer
set search_path = public
as $$
  with active_meds as (
    select m.id, m.baby_id, m.name, m.dosage, m.starts_at, m.frequency_hours, m.ends_at
      from public.medications m
     where m.deleted_at is null
       and m.frequency_hours is not null
       and m.frequency_hours > 0
       and (m.ends_at is null or m.ends_at >= now())
  ),
  -- Compute the next scheduled dose timestamp by snapping "now + lookahead"
  -- back to the closest interval boundary on or after starts_at.
  next_doses as (
    select
      am.id    as medication_id,
      am.baby_id,
      am.name  as med_name,
      am.dosage as med_dosage,
      am.starts_at + (
        ceil(
          extract(epoch from ((now() + (p_lookahead_minutes || ' minutes')::interval) - am.starts_at))
          / (am.frequency_hours * 3600)
        ) * (am.frequency_hours || ' hours')::interval
      ) as scheduled_for
    from active_meds am
  ),
  recipients as (
    select bu.baby_id, bu.user_id, up.whatsapp_e164
      from public.baby_users bu
      join public.user_preferences up on up.user_id = bu.user_id
     where bu.role in ('owner','parent','caregiver','editor')
       and up.whatsapp_optin = true
       and up.whatsapp_e164 is not null
  )
  select
    nd.medication_id,
    nd.baby_id,
    r.user_id,
    r.whatsapp_e164,
    b.name        as baby_name,
    nd.med_name,
    nd.med_dosage,
    nd.scheduled_for
  from next_doses nd
  join recipients r on r.baby_id = nd.baby_id
  join public.babies b on b.id = nd.baby_id and b.deleted_at is null
  where nd.scheduled_for between now() - (p_window_minutes || ' minutes')::interval
                          and     now() + (p_lookahead_minutes || ' minutes')::interval
    and not exists (
      select 1 from public.whatsapp_outbox o
       where o.medication_id = nd.medication_id
         and o.user_id       = r.user_id
         and o.scheduled_for = nd.scheduled_for
    );
$$;

commit;

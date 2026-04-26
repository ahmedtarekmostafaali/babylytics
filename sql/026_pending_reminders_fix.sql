-- 026_pending_reminders_fix.sql
-- Fixes pending_med_reminders() so the FIRST dose at exactly starts_at fires,
-- and doses that happened in the last `p_window_minutes` still trigger a
-- catch-up reminder (e.g. cron tick missed by a few seconds).
--
-- Old math: next_dose = starts_at + ceil((now + lookahead - starts_at) / freq) * freq
--   ⇒ ceil() always returns >= 1 once starts_at is even a second in the past,
--     so starts_at itself is never returned as a candidate.
--
-- New math: round to the nearest scheduled boundary around NOW.
--   next_dose = starts_at + round((now - starts_at) / freq) * freq
--   ⇒ Returns whichever dose (past or future) is closest to right-now.
--   ⇒ The WHERE clause then keeps only those within ±window of now.
--
-- Safe to re-run; CREATE OR REPLACE.

begin;

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
       and m.starts_at <= now() + (p_lookahead_minutes || ' minutes')::interval
  ),
  -- Snap to the nearest scheduled boundary (past or future) around NOW.
  -- N can be 0 (i.e. we're sitting on starts_at), positive (post-start), or
  -- negative if the med is fully in the future (filtered out above).
  next_doses as (
    select
      am.id     as medication_id,
      am.baby_id,
      am.name   as med_name,
      am.dosage as med_dosage,
      am.starts_at + (
        round(
          extract(epoch from (now() - am.starts_at))
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

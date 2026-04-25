-- ============================================================================
-- Babylytics — migration 016
-- Bag of additive changes for the new feature batch:
--   * appointments.conclusion       — post-visit doctor outcome / follow-up
--   * screen_time_logs              — daily screen-time tracker
--   * activity_logs                 — tummy time / play / walk / etc.
-- ============================================================================

-- 1. appointments.conclusion --------------------------------------------------
-- `notes` is for the parent's prep notes (questions to ask). `conclusion` is
-- the doctor's outcome / next-step summary captured AFTER the visit.
alter table public.appointments
  add column if not exists conclusion text;

-- 2. screen_time_logs ---------------------------------------------------------
create table if not exists public.screen_time_logs (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    started_at    timestamptz not null,
    duration_min  integer not null check (duration_min > 0 and duration_min <= 1440),
    content_type  text check (content_type in (
                    'educational','entertainment','video_call','passive','other'
                  ) or content_type is null),
    device        text check (device in (
                    'tv','tablet','phone','laptop','other'
                  ) or device is null),
    notes         text,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_screen_time_baby on public.screen_time_logs(baby_id, started_at desc)
  where deleted_at is null;

-- 3. activity_logs ------------------------------------------------------------
-- Generic physical / developmental activity log. Activity_type is free text
-- so users can log anything (tummy time, walk, swim, music, story, etc.) but
-- common ones are suggested in the UI.
create table if not exists public.activity_logs (
    id             uuid primary key default gen_random_uuid(),
    baby_id        uuid not null references public.babies(id) on delete cascade,
    started_at     timestamptz not null,
    duration_min   integer check (duration_min > 0 and duration_min <= 720),
    activity_type  text not null,
    intensity      text check (intensity in ('low','moderate','high') or intensity is null),
    location       text,
    mood           text check (mood in ('happy','calm','fussy','tired','curious','other') or mood is null),
    notes          text,
    created_by     uuid not null references auth.users(id),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    deleted_at     timestamptz
);
create index if not exists idx_activity_logs_baby on public.activity_logs(baby_id, started_at desc)
  where deleted_at is null;

-- Triggers --------------------------------------------------------------------
drop trigger if exists trg_touch_screen_time on public.screen_time_logs;
create trigger trg_touch_screen_time before update on public.screen_time_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_activity_logs on public.activity_logs;
create trigger trg_touch_activity_logs before update on public.activity_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_screen_time on public.screen_time_logs;
create trigger trg_audit_screen_time after insert or update or delete on public.screen_time_logs
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_activity_logs on public.activity_logs;
create trigger trg_audit_activity_logs after insert or update or delete on public.activity_logs
  for each row execute function public.audit_row_change();

-- RLS -------------------------------------------------------------------------
alter table public.screen_time_logs enable row level security;
alter table public.activity_logs    enable row level security;

drop policy if exists screen_time_logs_member_select on public.screen_time_logs;
create policy screen_time_logs_member_select on public.screen_time_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists screen_time_logs_writer on public.screen_time_logs;
create policy screen_time_logs_writer on public.screen_time_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

drop policy if exists activity_logs_member_select on public.activity_logs;
create policy activity_logs_member_select on public.activity_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists activity_logs_writer on public.activity_logs;
create policy activity_logs_writer on public.activity_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

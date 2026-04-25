-- ============================================================================
-- Babylytics — migration 018
-- Per-user-per-baby preferences for which widgets show on the overview, the
-- daily report, and the full report. Stored as a list of HIDDEN widget IDs
-- so the default (no row) means "show everything" — backward compatible.
-- ============================================================================

create table if not exists public.dashboard_preferences (
    user_id         uuid not null references auth.users(id) on delete cascade,
    baby_id         uuid not null references public.babies(id) on delete cascade,
    scope           text not null check (scope in ('overview','daily_report','full_report')),
    hidden_widgets  text[] not null default '{}',
    updated_at      timestamptz not null default now(),
    primary key (user_id, baby_id, scope)
);

alter table public.dashboard_preferences enable row level security;

-- Each user only sees / writes their own row for any baby they have access to.
drop policy if exists dashboard_preferences_self on public.dashboard_preferences;
create policy dashboard_preferences_self on public.dashboard_preferences
  for all
  using (user_id = auth.uid() and public.has_baby_access(baby_id))
  with check (user_id = auth.uid() and public.has_baby_access(baby_id));

drop trigger if exists trg_touch_dashboard_preferences on public.dashboard_preferences;
create trigger trg_touch_dashboard_preferences before update on public.dashboard_preferences
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- Babylytics — migration 021
-- Add 'pregnancy_dashboard' as an allowed scope on dashboard_preferences so
-- pregnancy users can customize their hero / KPI / insight cards.
-- ============================================================================

alter table public.dashboard_preferences drop constraint if exists dashboard_preferences_scope_check;
alter table public.dashboard_preferences add constraint dashboard_preferences_scope_check
  check (scope in ('overview','pregnancy_dashboard','daily_report','full_report'));

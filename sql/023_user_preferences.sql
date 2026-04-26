-- 023_user_preferences.sql
-- Per-user app preferences: language, country, timezone, time format, unit
-- system. Stored as one row per auth.users.id. Used by the i18n shell, the
-- date helpers, and the unit formatters.
--
-- Defaults match the current hard-coded behaviour (English, Egypt,
-- Africa/Cairo, 12-hour clock, metric) so existing users see no change
-- until they touch the Preferences page.
--
-- Safe to re-run.

begin;

create table if not exists public.user_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  language       text not null default 'en' check (language in ('en','ar')),
  country        text not null default 'EG',                  -- ISO 3166-1 alpha-2
  timezone       text not null default 'Africa/Cairo',
  time_format    text not null default '12h' check (time_format in ('12h','24h')),
  unit_system    text not null default 'metric' check (unit_system in ('metric','imperial')),
  -- WhatsApp opt-in for medication reminders (used in Batch L).
  whatsapp_e164  text,                                        -- e.g. "+201234567890"
  whatsapp_optin boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_self_select on public.user_preferences;
create policy user_preferences_self_select on public.user_preferences
  for select using (user_id = auth.uid());

drop policy if exists user_preferences_self_upsert on public.user_preferences;
create policy user_preferences_self_upsert on public.user_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- updated_at trigger
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_user_preferences_set_updated_at on public.user_preferences;
    create trigger trg_user_preferences_set_updated_at
      before update on public.user_preferences
      for each row execute function public.set_updated_at();
  end if;
end $$;

commit;

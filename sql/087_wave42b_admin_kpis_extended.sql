-- 087: Wave 42B — extend admin_kpis with new feature counts
-- ============================================================================
-- Old admin_kpis snapshot covered users, babies, pregnancies, signups,
-- active users, language split, feedback. The recent waves shipped a
-- pile of new features; the admin overview should surface their usage:
--
--   - Forum: thread count, reply count, threads created in last 7d
--   - Mental health: total screenings + count flagged urgent (admin
--     anonymized — counts only, never user-linked)
--   - AI companion: calls today + month
--   - Pumping logs: total + this week
--   - Pregnancy bump… [removed in Wave 40A; not surfaced]
--   - Risk signals + nutrition card don't have "events" — they read
--     existing data, no log table to count
--
-- The function still returns jsonb so the page just consumes the new
-- fields without breaking on old keys.
--
-- Idempotent.

begin;

create or replace function public.admin_kpis()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with active_log_users as (
    select created_by as uid, max(created_at) as last_seen from (
      select created_by, created_at from public.feedings        where created_at > now() - interval '30 days'
      union all
      select created_by, created_at from public.stool_logs      where created_at > now() - interval '30 days'
      union all
      select created_by, created_at from public.sleep_logs      where created_at > now() - interval '30 days'
      union all
      select created_by, created_at from public.temperature_logs where created_at > now() - interval '30 days'
      union all
      select created_by, created_at from public.measurements    where created_at > now() - interval '30 days'
      union all
      select created_by, created_at from public.medication_logs where created_at > now() - interval '30 days'
    ) u
    where created_by is not null
    group by created_by
  )
  select jsonb_build_object(
    -- Existing fields kept for the existing UI.
    'total_users',          (select count(*) from auth.users),
    'total_babies',         (select count(*) from public.babies where deleted_at is null),
    'total_pregnancies',    (select count(*) from public.babies
                              where deleted_at is null and lifecycle_stage = 'pregnancy'),
    'total_planning',       (select count(*) from public.babies
                              where deleted_at is null and lifecycle_stage = 'planning'),
    'total_baby_stage',     (select count(*) from public.babies
                              where deleted_at is null
                                and lifecycle_stage in ('newborn','infant','toddler','child')),
    'signups_24h',          (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'signups_7d',           (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d',          (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d',            (select count(*) from active_log_users where last_seen > now() - interval '7 days'),
    'active_30d',           (select count(*) from active_log_users),
    'lang_ar',              (select count(*) from public.user_preferences where language = 'ar'),
    'lang_en',              (select count(*) from public.user_preferences where language = 'en'),
    'feedback_total',       (select count(*) from public.user_feedback where deleted_at is null),
    'feedback_open',        (select count(*) from public.user_feedback where deleted_at is null and status = 'open'),

    -- Wave 42B: session-aware activity (from bump_user_activity).
    'last_seen_today',      (select count(*) from public.profiles
                              where last_seen_at >= date_trunc('day', now())),
    'login_today',          (select count(*) from public.profiles
                              where last_login_at >= date_trunc('day', now())),

    -- Wave 19/24/29/30 forum metrics.
    'forum_threads',        (select count(*) from public.forum_threads where deleted_at is null),
    'forum_replies',        (select count(*) from public.forum_replies where deleted_at is null),
    'forum_threads_7d',     (select count(*) from public.forum_threads
                              where deleted_at is null and created_at > now() - interval '7 days'),
    'forum_replies_7d',     (select count(*) from public.forum_replies
                              where deleted_at is null and created_at > now() - interval '7 days'),
    'forum_reactions',      (select count(*) from public.forum_reactions),
    'forum_subscriptions',  (select count(*) from public.forum_subscriptions),

    -- Wave 33B/34 AI companion usage.
    'ai_calls_today',       (select count(*) from public.pregnancy_companion_log
                              where created_at >= date_trunc('day', now())),
    'ai_calls_7d',          (select count(*) from public.pregnancy_companion_log
                              where created_at > now() - interval '7 days'),
    'ai_calls_30d',         (select count(*) from public.pregnancy_companion_log
                              where created_at > now() - interval '30 days'),

    -- Wave 41 mental health screening usage (counts only, never per-user).
    'mh_screenings_total',  (select count(*) from public.mental_health_screenings where deleted_at is null),
    'mh_screenings_7d',     (select count(*) from public.mental_health_screenings
                              where deleted_at is null and taken_at > now() - interval '7 days'),
    'mh_severe_flag_count', (select count(*) from public.mental_health_screenings
                              where deleted_at is null and severity in ('high','urgent')),

    -- Wave 40A pumping logs.
    'pumping_logs_total',   (select count(*) from public.pumping_logs where deleted_at is null),
    'pumping_logs_7d',      (select count(*) from public.pumping_logs
                              where deleted_at is null and started_at > now() - interval '7 days'),

    -- Wave 19b/c admin moderation queue depth.
    'forum_reports_open',   (select count(*) from public.forum_reports
                              where resolved_at is null),

    'as_of',                now()
  ) into result;

  return result;
end;
$$;
grant execute on function public.admin_kpis() to authenticated;

commit;

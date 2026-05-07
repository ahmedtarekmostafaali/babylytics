-- 092: Wave 46 — admin analytics enrichment
-- ============================================================================
-- Four new server-side helpers exposed to the admin overview + a
-- new user-detail page:
--
--   1. admin_funnel()             → signup → first profile → first log
--                                    → first caregiver → first AI call
--   2. admin_ai_breakdown(p_days) → total + per-mode + per-stage + day series
--   3. admin_country_breakdown()  → user count by user_preferences.country
--   4. admin_retention()          → D1 / D7 / D30 retention from signup
--   5. admin_user_detail(p_user)  → everything one specific user has
--                                    done (for the new /admin/users/[id])
--   6. admin_stage_transitions()  → counts of cycle→pregnancy +
--                                    pregnancy→baby moves in last 30/90d
--
-- All gated on is_platform_admin(). Counts only — no per-user mental
-- health detail leaks; the screening history is summarised by
-- severity bucket only.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_funnel — single-row jsonb of conversion counts
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_funnel()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with all_users as (
    select id, created_at from auth.users
  ),
  with_profile as (
    select distinct b.created_by as uid
    from public.babies b
    where b.created_by is not null and b.deleted_at is null
  ),
  with_log as (
    select distinct uid from (
      select created_by as uid from public.feedings        where created_by is not null
      union select created_by from public.stool_logs       where created_by is not null
      union select created_by from public.sleep_logs       where created_by is not null
      union select created_by from public.temperature_logs where created_by is not null
      union select created_by from public.measurements     where created_by is not null
      union select created_by from public.medication_logs  where created_by is not null
      union select created_by from public.menstrual_cycles where created_by is not null
    ) u
  ),
  with_caregiver as (
    -- "Invited a caregiver" = there's a baby_users row where this user
    -- is the inviter (invited_by) — i.e. they brought someone else in.
    select distinct invited_by as uid
    from public.baby_users
    where invited_by is not null
  ),
  with_ai as (
    select distinct user_id as uid from public.pregnancy_companion_log
  )
  select jsonb_build_object(
    'total_signups',     (select count(*) from all_users),
    'with_profile',      (select count(*) from with_profile),
    'with_log',          (select count(*) from with_log),
    'with_caregiver',    (select count(*) from with_caregiver),
    'with_ai_call',      (select count(*) from with_ai)
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_funnel() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. admin_ai_breakdown — counts + 30-day series
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_ai_breakdown(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with day_series as (
    select generate_series(
      (current_date - (p_days - 1))::date,
      current_date::date,
      interval '1 day'
    )::date as day
  ),
  per_day as (
    select date_trunc('day', created_at)::date as day, count(*)::int as n
    from public.pregnancy_companion_log
    where created_at >= current_date - (p_days - 1)
    group by 1
  )
  select jsonb_build_object(
    'today',      (select count(*) from public.pregnancy_companion_log
                    where created_at >= date_trunc('day', now()))::int,
    'last_7d',    (select count(*) from public.pregnancy_companion_log
                    where created_at > now() - interval '7 days')::int,
    'last_30d',   (select count(*) from public.pregnancy_companion_log
                    where created_at > now() - interval '30 days')::int,
    'by_mode',    coalesce((
      select jsonb_object_agg(mode, n)
      from (select mode, count(*)::int as n
            from public.pregnancy_companion_log
            where created_at > now() - interval '30 days'
            group by mode) m
    ), '{}'::jsonb),
    'by_stage',   coalesce((
      select jsonb_object_agg(stage, n)
      from (select coalesce(stage, 'pregnancy') as stage, count(*)::int as n
            from public.pregnancy_companion_log
            where created_at > now() - interval '30 days'
            group by stage) s
    ), '{}'::jsonb),
    'series',     coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day, 'n', coalesce(p.n, 0)) order by d.day)
      from day_series d left join per_day p on p.day = d.day
    ), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_ai_breakdown(int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_country_breakdown — group by user_preferences.country
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_country_breakdown()
returns table (country text, n bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select coalesce(up.country, 'EG') as country, count(*)::bigint as n
    from public.user_preferences up
    group by 1
    order by 2 desc
    limit 30;
end; $$;
grant execute on function public.admin_country_breakdown() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_retention — rough D1 / D7 / D30 retention
-- "Retained on day N" = signup_at + N days falls within their last_seen_at
-- window. Approximated as: count signups whose last_seen_at is at least
-- N days after signup. With Wave 42B's per-page activity bumping, this
-- gives a usable cohort signal even though it's a single-snapshot
-- approximation, not a true cohort curve.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_retention()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with j as (
    select u.created_at,
           p.last_seen_at,
           extract(day from (coalesce(p.last_seen_at, u.created_at) - u.created_at)) as gap_days
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.created_at < now() - interval '30 days'
  )
  select jsonb_build_object(
    'cohort_size',  (select count(*) from j)::int,
    'd1_retained',  (select count(*) from j where gap_days >= 1)::int,
    'd7_retained',  (select count(*) from j where gap_days >= 7)::int,
    'd30_retained', (select count(*) from j where gap_days >= 30)::int
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_retention() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_user_detail(p_user) — everything ONE user has done.
--    Mental health is summarised by severity bucket only — never
--    per-screening detail, even for admins.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  result jsonb;
  v_email text;
  v_display text;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select u.email::text into v_email from auth.users u where u.id = p_user;
  select coalesce(p.display_name, '') into v_display from public.profiles p where p.id = p_user;

  select jsonb_build_object(
    'user_id',       p_user,
    'email',         v_email,
    'display_name',  v_display,
    'created_at',    (select created_at from auth.users where id = p_user),
    'last_login_at', (select last_login_at from public.profiles where id = p_user),
    'last_seen_at',  (select last_seen_at  from public.profiles where id = p_user),
    'language',      (select coalesce(language, 'en') from public.user_preferences where user_id = p_user),
    'country',       (select coalesce(country,  'EG') from public.user_preferences where user_id = p_user),

    -- Babies they have access to (created or invited).
    'babies',        coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',    b.id,
        'name',  b.name,
        'stage', coalesce(b.lifecycle_stage, 'infant'),
        'role',  coalesce((
          select role from public.baby_users bu
          where bu.baby_id = b.id and bu.user_id = p_user limit 1
        ), 'owner')
      ) order by b.created_at desc)
      from public.babies b
      where b.deleted_at is null
        and (
          b.created_by = p_user
          or exists (select 1 from public.baby_users bu where bu.baby_id = b.id and bu.user_id = p_user)
        )
    ), '[]'::jsonb),

    -- Activity counts in last 30 days.
    'logs_30d', jsonb_build_object(
      'feedings',     (select count(*) from public.feedings        where created_by = p_user and created_at > now() - interval '30 days')::int,
      'stool',        (select count(*) from public.stool_logs       where created_by = p_user and created_at > now() - interval '30 days')::int,
      'sleep',        (select count(*) from public.sleep_logs       where created_by = p_user and created_at > now() - interval '30 days')::int,
      'temperature',  (select count(*) from public.temperature_logs where created_by = p_user and created_at > now() - interval '30 days')::int,
      'measurements', (select count(*) from public.measurements     where created_by = p_user and created_at > now() - interval '30 days')::int,
      'medications',  (select count(*) from public.medication_logs  where created_by = p_user and created_at > now() - interval '30 days')::int,
      'cycles',       (select count(*) from public.menstrual_cycles where created_by = p_user and created_at > now() - interval '30 days')::int
    ),

    -- AI usage.
    'ai', jsonb_build_object(
      'total',        (select count(*) from public.pregnancy_companion_log where user_id = p_user)::int,
      'today',        (select count(*) from public.pregnancy_companion_log where user_id = p_user and created_at >= date_trunc('day', now()))::int,
      'last_30d',     (select count(*) from public.pregnancy_companion_log where user_id = p_user and created_at > now() - interval '30 days')::int,
      'by_mode',      coalesce((
        select jsonb_object_agg(mode, n)
        from (select mode, count(*)::int as n from public.pregnancy_companion_log
              where user_id = p_user group by mode) m
      ), '{}'::jsonb),
      'last_called_at', (select max(created_at) from public.pregnancy_companion_log where user_id = p_user)
    ),

    -- Forum activity (counts only).
    'forum', jsonb_build_object(
      'threads',     (select count(*) from public.forum_threads where author_id = p_user and deleted_at is null)::int,
      'replies',     (select count(*) from public.forum_replies where author_id = p_user and deleted_at is null)::int,
      'reactions',   (select count(*) from public.forum_reactions where created_by = p_user)::int,
      'subscriptions', (select count(*) from public.forum_subscriptions where user_id = p_user)::int
    ),

    -- Mental health: BUCKETED by severity. Never per-screening.
    'mh_buckets', coalesce((
      select jsonb_object_agg(severity, n)
      from (select severity, count(*)::int as n
            from public.mental_health_screenings
            where user_id = p_user and deleted_at is null
            group by severity) s
    ), '{}'::jsonb),
    'mh_total',   (select count(*) from public.mental_health_screenings where user_id = p_user and deleted_at is null)::int,

    -- Pumping logs.
    'pumping_total', (select count(*) from public.pumping_logs where created_by = p_user and deleted_at is null)::int,

    -- Is admin?
    'is_admin', exists (select 1 from public.app_admins a where a.user_id = p_user)
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. admin_stage_transitions — count cycle→pregnancy + pregnancy→baby
--    transitions in the last 30/90 days. We don't have a transition log
--    table; approximate from babies.lifecycle_stage + dob/edd dates.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_stage_transitions()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Cycle → pregnancy: babies that are in pregnancy stage AND were
  -- created (or transitioned) recently. We don't track exact transition
  -- timestamp, so use lmp/edd as a proxy.
  -- Pregnancy → baby: babies with non-null dob (born) recently.
  select jsonb_build_object(
    'preg_30d', (select count(*) from public.babies
                  where deleted_at is null
                    and lifecycle_stage = 'pregnancy'
                    and updated_at > now() - interval '30 days')::int,
    'preg_90d', (select count(*) from public.babies
                  where deleted_at is null
                    and lifecycle_stage = 'pregnancy'
                    and updated_at > now() - interval '90 days')::int,
    'born_30d', (select count(*) from public.babies
                  where deleted_at is null
                    and dob is not null
                    and dob > current_date - 30)::int,
    'born_90d', (select count(*) from public.babies
                  where deleted_at is null
                    and dob is not null
                    and dob > current_date - 90)::int
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_stage_transitions() to authenticated;

commit;

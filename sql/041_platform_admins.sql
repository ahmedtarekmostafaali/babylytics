-- 041: Platform admin role + analytics RPCs
-- ============================================================================
-- Adds a global "platform admin" role distinct from the per-baby caregiver
-- roles (parent/doctor/nurse/viewer). A platform admin can read aggregate
-- metrics across ALL users + babies, list every user, and review every piece
-- of feedback — without ever touching the per-baby RLS policies.
--
-- Implementation: a small `app_admins` table that maps auth.users.id → admin.
-- All cross-user reads happen through SECURITY DEFINER RPCs that check
-- `public.is_platform_admin()` first and raise on non-admins. The base tables
-- keep their normal per-row RLS (parents only see their own babies, etc.) so
-- a leak in one of the new RPCs cannot expose anything that isn't an
-- aggregate or a row the admin asked for.
--
-- Idempotent — safe to re-run.

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. app_admins — single source of truth for platform-admin membership
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_admins (
    user_id     uuid primary key references auth.users(id) on delete cascade,
    granted_at  timestamptz not null default now(),
    granted_by  uuid references auth.users(id) on delete set null,
    note        text
);

alter table public.app_admins enable row level security;

-- Each admin can see every other admin (so the Admin Users page can list them);
-- no INSERT/UPDATE/DELETE policies — membership changes happen only through
-- the service role / SQL editor / a future grant_admin RPC.
drop policy if exists app_admins_select_admin on public.app_admins;
create policy app_admins_select_admin on public.app_admins
  for select using (auth.uid() in (select user_id from public.app_admins));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. is_platform_admin() — gate used by every analytics RPC
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.is_platform_admin(p_user uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.app_admins where user_id = p_user
  );
$$;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. admin_kpis() — single-row snapshot for the dashboard
-- ────────────────────────────────────────────────────────────────────────────
-- Returns: total users, total babies, total active pregnancies, sign-ups in
-- the last 24h / 7d / 30d, distinct active users in the last 7d / 30d, AR vs
-- EN language split, total feedback rows, open feedback rows.
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
    -- "Active in last 7d" = created any tracked log in the window.
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
    'total_users',          (select count(*) from auth.users),
    'total_babies',         (select count(*) from public.babies where deleted_at is null),
    'total_pregnancies',    (select count(*) from public.babies
                              where deleted_at is null
                                and lifecycle_stage = 'pregnancy'),
    'signups_24h',          (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'signups_7d',           (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d',          (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d',            (select count(*) from active_log_users where last_seen > now() - interval '7 days'),
    'active_30d',           (select count(*) from active_log_users),
    'lang_ar',              (select count(*) from public.user_preferences where language = 'ar'),
    'lang_en',              (select count(*) from public.user_preferences where language = 'en'),
    'feedback_total',       (select count(*) from public.user_feedback where deleted_at is null),
    'feedback_open',        (select count(*) from public.user_feedback where deleted_at is null and status = 'open'),
    'as_of',                now()
  ) into result;

  return result;
end;
$$;
grant execute on function public.admin_kpis() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. admin_signup_series(p_days) — daily new sign-ups for the last N days
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_signup_series(p_days int default 30)
returns table (day date, signups bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with span as (
      select generate_series(
        (current_date - (p_days - 1))::date,
        current_date::date,
        interval '1 day'
      )::date as day
    ),
    counts as (
      select date_trunc('day', created_at)::date as day, count(*)::bigint as n
        from auth.users
       where created_at >= current_date - (p_days - 1)
       group by 1
    )
    select s.day, coalesce(c.n, 0)::bigint
      from span s left join counts c using (day)
     order by s.day;
end;
$$;
grant execute on function public.admin_signup_series(int) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. admin_dau_series(p_days) — daily distinct active users for the last N days
-- ────────────────────────────────────────────────────────────────────────────
-- A user counts as "active on day X" if they created at least one tracked log
-- with created_at falling in that day. We union the major log tables; doctors
-- and nurses who only comment are NOT counted (we measure parental engagement).
create or replace function public.admin_dau_series(p_days int default 30)
returns table (day date, dau bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with span as (
      select generate_series(
        (current_date - (p_days - 1))::date,
        current_date::date,
        interval '1 day'
      )::date as day
    ),
    events as (
      select created_by as uid, date_trunc('day', created_at)::date as day from public.feedings
       where created_by is not null and created_at >= current_date - (p_days - 1)
      union
      select created_by, date_trunc('day', created_at)::date from public.stool_logs
       where created_by is not null and created_at >= current_date - (p_days - 1)
      union
      select created_by, date_trunc('day', created_at)::date from public.sleep_logs
       where created_by is not null and created_at >= current_date - (p_days - 1)
      union
      select created_by, date_trunc('day', created_at)::date from public.temperature_logs
       where created_by is not null and created_at >= current_date - (p_days - 1)
      union
      select created_by, date_trunc('day', created_at)::date from public.measurements
       where created_by is not null and created_at >= current_date - (p_days - 1)
      union
      select created_by, date_trunc('day', created_at)::date from public.medication_logs
       where created_by is not null and created_at >= current_date - (p_days - 1)
    ),
    daily as (
      select day, count(distinct uid)::bigint as dau from events group by day
    )
    select s.day, coalesce(d.dau, 0)::bigint
      from span s left join daily d using (day)
     order by s.day;
end;
$$;
grant execute on function public.admin_dau_series(int) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. admin_top_trackers() — which trackers are getting used most this week
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_top_trackers()
returns table (tracker text, events_7d bigint, events_30d bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with x as (
      select 'feedings'::text as tracker,
             count(*) filter (where created_at > now() - interval '7 days')  as e7,
             count(*) filter (where created_at > now() - interval '30 days') as e30
        from public.feedings
      union all
      select 'stool',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.stool_logs
      union all
      select 'sleep',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.sleep_logs
      union all
      select 'temperature',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.temperature_logs
      union all
      select 'measurements',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.measurements
      union all
      select 'medications',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.medication_logs
      union all
      select 'vaccinations',
             count(*) filter (where created_at > now() - interval '7 days'),
             count(*) filter (where created_at > now() - interval '30 days')
        from public.vaccinations
    )
    select tracker, e7::bigint, e30::bigint from x order by e30 desc;
end;
$$;
grant execute on function public.admin_top_trackers() to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. admin_user_list(p_limit, p_offset, p_search) — paginated user list with
-- ────────────────────────────────────────────────────────────────────────────
-- enrichment: display name from profiles, language from user_preferences,
-- baby count, last activity timestamp. Optional case-insensitive search by
-- email or display_name.
create or replace function public.admin_user_list(
  p_limit  int default 50,
  p_offset int default 0,
  p_search text default null
)
returns table (
  user_id        uuid,
  email          text,
  display_name   text,
  created_at     timestamptz,
  language       text,
  country        text,
  baby_count     bigint,
  last_activity  timestamptz,
  is_admin       boolean,
  total_count    bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  search_filter text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with last_log as (
      -- Most recent activity per user across log tables.
      select created_by as uid, max(created_at) as ts from (
        select created_by, created_at from public.feedings        where created_by is not null
        union all
        select created_by, created_at from public.stool_logs      where created_by is not null
        union all
        select created_by, created_at from public.sleep_logs      where created_by is not null
        union all
        select created_by, created_at from public.temperature_logs where created_by is not null
        union all
        select created_by, created_at from public.measurements    where created_by is not null
        union all
        select created_by, created_at from public.medication_logs where created_by is not null
      ) u group by created_by
    ),
    baby_per_user as (
      -- Babies a user owns OR is a caregiver on.
      select uid, count(distinct baby_id) as n from (
        select b.created_by as uid, b.id as baby_id
          from public.babies b where b.deleted_at is null and b.created_by is not null
        union
        select c.user_id, c.baby_id from public.caregivers c where c.user_id is not null
      ) z group by uid
    ),
    enriched as (
      select
        u.id                          as user_id,
        u.email::text                 as email,
        coalesce(p.display_name,'')   as display_name,
        u.created_at,
        coalesce(up.language,'en')    as language,
        coalesce(up.country, 'EG')    as country,
        coalesce(bp.n, 0)             as baby_count,
        ll.ts                          as last_activity,
        exists(select 1 from public.app_admins a where a.user_id = u.id) as is_admin
      from auth.users u
      left join public.profiles         p  on p.id      = u.id
      left join public.user_preferences up on up.user_id = u.id
      left join baby_per_user           bp on bp.uid    = u.id
      left join last_log                ll on ll.uid    = u.id
    ),
    filtered as (
      select * from enriched
       where search_filter is null
          or email        ilike '%' || search_filter || '%'
          or display_name ilike '%' || search_filter || '%'
    )
    select f.user_id, f.email, f.display_name, f.created_at, f.language,
           f.country, f.baby_count::bigint, f.last_activity, f.is_admin,
           (select count(*) from filtered)::bigint as total_count
      from filtered f
      order by f.created_at desc
      limit greatest(1, least(p_limit, 200))
      offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_user_list(int, int, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. admin_feedback_list(p_status, p_limit, p_offset) — full feedback inbox
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_feedback_list(
  p_status text default null,
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  id              uuid,
  user_id         uuid,
  user_email      text,
  user_name       text,
  kind            text,
  subject         text,
  body            text,
  attachment_path text,
  status          text,
  admin_response  text,
  created_at      timestamptz,
  updated_at      timestamptz,
  total_count     bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with base as (
      select f.*,
             u.email::text as u_email,
             coalesce(p.display_name,'') as u_name
        from public.user_feedback f
        join auth.users u  on u.id = f.user_id
        left join public.profiles p on p.id = f.user_id
       where f.deleted_at is null
         and (p_status is null or f.status = p_status)
    )
    select b.id, b.user_id, b.u_email, b.u_name, b.kind, b.subject, b.body,
           b.attachment_path, b.status, b.admin_response,
           b.created_at, b.updated_at,
           (select count(*) from base)::bigint as total_count
      from base b
      order by b.created_at desc
      limit greatest(1, least(p_limit, 200))
      offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_feedback_list(text, int, int) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. admin_set_feedback_status(id, status, response) — mark items resolved /
-- triaged etc. and optionally write an admin response back.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_feedback_status(
  p_id       uuid,
  p_status   text,
  p_response text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('open','triaged','in_progress','resolved','dismissed') then
    raise exception 'invalid status %', p_status;
  end if;

  update public.user_feedback
     set status = p_status,
         admin_response = coalesce(p_response, admin_response),
         updated_at = now()
   where id = p_id;
end;
$$;
grant execute on function public.admin_set_feedback_status(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. admin_grant(email) — promote a user to platform admin by email.
-- ────────────────────────────────────────────────────────────────────────────
-- Convenience helper so the bootstrap admin (you) can add new admins from a
-- future UI without leaving SQL. Callable only by existing admins.
create or replace function public.admin_grant(p_email text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_target uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_target from auth.users where lower(email) = lower(p_email) limit 1;
  if v_target is null then
    raise exception 'no user with email %', p_email;
  end if;

  insert into public.app_admins (user_id, granted_by)
       values (v_target, auth.uid())
  on conflict (user_id) do nothing;
end;
$$;
grant execute on function public.admin_grant(text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. BOOTSTRAP — promote the first admin.
-- ────────────────────────────────────────────────────────────────────────────
-- Replace the placeholder below with your business Gmail BEFORE running this
-- migration. The lookup is by email in auth.users, so you must have signed up
-- with that email first via the normal /register flow.
do $$
declare
  v_email text := 'YOUR_BUSINESS_EMAIL@gmail.com';   -- ← edit me
  v_user  uuid;
begin
  if v_email = 'YOUR_BUSINESS_EMAIL@gmail.com' then
    raise notice 'Skipping bootstrap admin — placeholder email not edited.';
    return;
  end if;
  select id into v_user from auth.users where lower(email) = lower(v_email) limit 1;
  if v_user is null then
    raise notice 'No user found with email %, sign up first then re-run.', v_email;
    return;
  end if;
  insert into public.app_admins (user_id, note)
       values (v_user, 'bootstrap admin')
  on conflict (user_id) do nothing;
  raise notice 'Bootstrap admin granted to %', v_email;
end $$;

commit;

-- Publish a changelog entry so users see "we added admin tools" in the
-- in-app updates feed.
select public.publish_app_update(
  p_title    => 'Admin analytics dashboard',
  p_body     => 'We can now see how Babylytics is being used at a glance: total parents and babies, daily active users, sign-up trend, top trackers, language split, and a feedback inbox. Visible only to platform admins — your own data and privacy are not affected.',
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => 'لوحة تحليلات المسؤولين',
  p_body_ar  => 'أصبح لدينا الآن نظرة شاملة على استخدام Babylytics: إجمالي الآباء والأطفال، المستخدمون النشطون يوميًا، اتجاه التسجيل، أكثر المتعقبات استخدامًا، توزيع اللغة، وصندوق الملاحظات. تظهر للمسؤولين فقط — بياناتك وخصوصيتك لم تتأثر.'
);

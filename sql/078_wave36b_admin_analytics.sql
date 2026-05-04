-- 078: Wave 36B — admin analytics (last login, activity, AI usage per user)
-- ============================================================================
-- Three additions to the admin/users page:
--
--   1. last_login_at + last_seen_at columns on profiles. last_seen_at
--      bumps on every dashboard hit; last_login_at bumps when the
--      previous last_seen_at was >30 minutes ago (i.e. effectively a
--      "session start" without needing to wire into the auth callback).
--
--   2. bump_user_activity() RPC — cheap, throttled write that the
--      dashboard page calls on each visit. Skips the update if
--      last_seen was bumped in the last minute (keeps writes cheap on
--      tab refreshes).
--
--   3. admin_user_list v3 — adds last_login_at, last_seen_at,
--      ai_calls_today, ai_calls_total to the returned shape so the
--      Users page can render them without N+1 queries.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists last_seen_at  timestamptz;

create index if not exists idx_profiles_last_seen
  on public.profiles (last_seen_at desc nulls last);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. bump_user_activity — cheap throttled bump
--    - Always allowed for the calling user (RLS would normally block
--      profiles writes; SECURITY DEFINER + auth.uid() check is the
--      pragmatic path).
--    - Skips the write if last_seen_at is within the last 60 seconds.
--    - When last_seen_at is older than 30 minutes (or null), also bumps
--      last_login_at — that's our proxy for "session start".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bump_user_activity()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_actor    uuid := auth.uid();
  v_existing record;
  v_session_gap interval := interval '30 minutes';
  v_throttle    interval := interval '1 minute';
begin
  if v_actor is null then return; end if;

  -- Ensure a profiles row exists for this user (handles edge case
  -- where the trigger from auth.users → profiles hasn't fired yet).
  insert into public.profiles (id, last_seen_at, last_login_at)
    values (v_actor, now(), now())
  on conflict (id) do nothing;

  select last_seen_at, last_login_at
    into v_existing
    from public.profiles where id = v_actor;

  if v_existing.last_seen_at is not null
     and v_existing.last_seen_at > now() - v_throttle then
    -- Throttled: don't write again this minute.
    return;
  end if;

  if v_existing.last_seen_at is null
     or v_existing.last_seen_at < now() - v_session_gap then
    -- Treat this hit as a new session start.
    update public.profiles
      set last_seen_at  = now(),
          last_login_at = now()
      where id = v_actor;
  else
    update public.profiles
      set last_seen_at = now()
      where id = v_actor;
  end if;
end;
$$;
grant execute on function public.bump_user_activity() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. admin_user_list v3 — add last_login + last_seen + AI usage cols
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.admin_user_list(int, int, text);

create or replace function public.admin_user_list(
  p_limit  int default 50,
  p_offset int default 0,
  p_search text default null
)
returns table (
  user_id          uuid,
  email            text,
  display_name     text,
  created_at       timestamptz,
  language         text,
  country          text,
  baby_count       bigint,
  pregnancy_count  bigint,
  babies           jsonb,
  last_activity    timestamptz,
  recent_log_count bigint,
  last_login_at    timestamptz,
  last_seen_at     timestamptz,
  ai_calls_today   bigint,
  ai_calls_total   bigint,
  is_admin         boolean,
  total_count      bigint
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
      select x.uid,
             max(x.ts) as ts,
             count(*) filter (where x.ts > now() - interval '30 days') as recent_n
      from (
        select fe.created_by as uid, fe.created_at as ts from public.feedings        fe where fe.created_by is not null
        union all
        select sl.created_by, sl.created_at from public.stool_logs       sl where sl.created_by is not null
        union all
        select sp.created_by, sp.created_at from public.sleep_logs       sp where sp.created_by is not null
        union all
        select tl.created_by, tl.created_at from public.temperature_logs tl where tl.created_by is not null
        union all
        select me.created_by, me.created_at from public.measurements     me where me.created_by is not null
        union all
        select ml.created_by, ml.created_at from public.medication_logs  ml where ml.created_by is not null
      ) x group by x.uid
    ),
    user_babies as (
      select b.created_by as uid, b.id as baby_id, b.name as baby_name,
             coalesce(b.lifecycle_stage, 'infant') as stage,
             b.dob, b.edd
        from public.babies b
       where b.deleted_at is null and b.created_by is not null
      union
      select bu.user_id as uid, b.id as baby_id, b.name as baby_name,
             coalesce(b.lifecycle_stage, 'infant') as stage,
             b.dob, b.edd
        from public.baby_users bu
        join public.babies     b on b.id = bu.baby_id
       where b.deleted_at is null
    ),
    baby_agg as (
      select ub.uid,
             count(distinct ub.baby_id) as baby_n,
             count(distinct ub.baby_id) filter (where ub.stage = 'pregnancy') as preg_n,
             jsonb_agg(distinct jsonb_build_object(
               'id',   ub.baby_id,
               'name', ub.baby_name,
               'stage', ub.stage
             )) as babies_json
        from user_babies ub
       group by ub.uid
    ),
    -- Wave 36B: AI companion usage per user.
    ai_usage as (
      select pcl.user_id,
             count(*) filter (where pcl.created_at >= date_trunc('day', now())) as today_n,
             count(*) as total_n
        from public.pregnancy_companion_log pcl
       group by pcl.user_id
    ),
    enriched as (
      select
        u.id                          as e_user_id,
        u.email::text                 as e_email,
        coalesce(p.display_name, '')  as e_display_name,
        u.created_at                  as e_created_at,
        coalesce(up.language, 'en')   as e_language,
        coalesce(up.country, 'EG')    as e_country,
        coalesce(ba.baby_n, 0)        as e_baby_count,
        coalesce(ba.preg_n, 0)        as e_preg_count,
        coalesce(ba.babies_json, '[]'::jsonb) as e_babies,
        ll.ts                         as e_last_activity,
        coalesce(ll.recent_n, 0)      as e_recent_n,
        p.last_login_at               as e_last_login,
        p.last_seen_at                as e_last_seen,
        coalesce(au.today_n, 0)       as e_ai_today,
        coalesce(au.total_n, 0)       as e_ai_total,
        exists (select 1 from public.app_admins a where a.user_id = u.id) as e_is_admin
      from auth.users u
      left join public.profiles         p  on p.id      = u.id
      left join public.user_preferences up on up.user_id = u.id
      left join baby_agg                ba on ba.uid    = u.id
      left join last_log                ll on ll.uid    = u.id
      left join ai_usage                au on au.user_id = u.id
    ),
    filtered as (
      select * from enriched
       where search_filter is null
          or e_email        ilike '%' || search_filter || '%'
          or e_display_name ilike '%' || search_filter || '%'
    ),
    counted as (select (select count(*) from filtered)::bigint as tc)
    select
      f.e_user_id,
      f.e_email,
      f.e_display_name,
      f.e_created_at,
      f.e_language,
      f.e_country,
      f.e_baby_count::bigint,
      f.e_preg_count::bigint,
      f.e_babies,
      f.e_last_activity,
      f.e_recent_n::bigint,
      f.e_last_login,
      f.e_last_seen,
      f.e_ai_today::bigint,
      f.e_ai_total::bigint,
      f.e_is_admin,
      counted.tc
    from filtered f cross join counted
    order by f.e_last_seen desc nulls last, f.e_created_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_user_list(int, int, text) to authenticated;

commit;

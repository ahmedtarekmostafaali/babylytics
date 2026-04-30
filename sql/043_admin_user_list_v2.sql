-- 043: admin_user_list v2 — fix table name + return baby names + pregnancies
-- ============================================================================
-- Two issues with v1:
--   1. References non-existent `public.caregivers` (the access table is
--      actually `public.baby_users`). The Users page surfaced this as
--      "relation public.caregivers does not exist".
--   2. Only returns counts. The user wants to see WHICH babies a parent
--      tracks, plus how many of those are pregnancies vs born.
--
-- v2 fix:
--   * Use `public.baby_users` for the access junction.
--   * Aggregate baby names into a JSONB array of {id, name, lifecycle}.
--   * Add `pregnancy_count` (babies with lifecycle_stage = 'pregnancy').
--   * Add `recent_log_count` — how many tracker entries the user logged in
--     the last 30 days. Cheap leading indicator of engagement.
--   * Keep the same security-definer guard + pagination + search.
--
-- Idempotent.

begin;

-- v2 changes the RETURNS TABLE shape (new pregnancy_count / babies / recent
-- columns), so we have to drop the v1 signature first — Postgres refuses
-- CREATE OR REPLACE when the row type changes.
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
      -- Most recent log timestamp + 30-day count per user. Every column
      -- table-qualified so PostgreSQL can't confuse it with our OUT params.
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
    -- Every (user, baby) pair the user has access to, either as the original
    -- creator OR via a baby_users grant (caregiver/doctor/nurse/viewer).
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
    -- One JSONB array per user with baby summary objects, plus the two counts.
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
        exists (select 1 from public.app_admins a where a.user_id = u.id) as e_is_admin
      from auth.users u
      left join public.profiles         p  on p.id      = u.id
      left join public.user_preferences up on up.user_id = u.id
      left join baby_agg                ba on ba.uid    = u.id
      left join last_log                ll on ll.uid    = u.id
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
      f.e_is_admin,
      counted.tc
    from filtered f cross join counted
    order by f.e_created_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_user_list(int, int, text) to authenticated;

commit;

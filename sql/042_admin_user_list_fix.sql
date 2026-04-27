-- 042: Fix "column reference is ambiguous" in admin_user_list + admin_feedback_list
-- ============================================================================
-- Bug: when a function's RETURNS TABLE declares a column name that also
-- appears inside the function body, PostgreSQL treats every unqualified
-- reference as ambiguous. The Users page surfaced this as
--   "Failed to load users: column reference 'created_at' is ambiguous"
-- because the inner UNION inside the `last_log` CTE selected unqualified
-- `created_by` / `created_at` from the log tables.
--
-- Fix: rewrite both admin_user_list and admin_feedback_list with every
-- column reference fully qualified by its source table. No behaviour
-- changes — same return shape, same ordering, same security check.
--
-- Idempotent — uses CREATE OR REPLACE.

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- admin_user_list — paginated user table with enrichment
-- ────────────────────────────────────────────────────────────────────────────
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
      -- Most recent activity per user across log tables. Every column is
      -- table-qualified so PostgreSQL can't confuse it with the OUT
      -- parameters declared in RETURNS TABLE above.
      select x.uid, max(x.ts) as ts from (
        select fe.created_by as uid, fe.created_at as ts from public.feedings        fe where fe.created_by is not null
        union all
        select sl.created_by, sl.created_at from public.stool_logs      sl where sl.created_by is not null
        union all
        select sp.created_by, sp.created_at from public.sleep_logs      sp where sp.created_by is not null
        union all
        select tl.created_by, tl.created_at from public.temperature_logs tl where tl.created_by is not null
        union all
        select me.created_by, me.created_at from public.measurements    me where me.created_by is not null
        union all
        select ml.created_by, ml.created_at from public.medication_logs ml where ml.created_by is not null
      ) x group by x.uid
    ),
    baby_per_user as (
      select z.uid, count(distinct z.baby_id) as n from (
        select b.created_by as uid, b.id as baby_id
          from public.babies b where b.deleted_at is null and b.created_by is not null
        union
        select cg.user_id as uid, cg.baby_id from public.caregivers cg where cg.user_id is not null
      ) z group by z.uid
    ),
    enriched as (
      select
        u.id                          as e_user_id,
        u.email::text                 as e_email,
        coalesce(p.display_name, '')  as e_display_name,
        u.created_at                  as e_created_at,
        coalesce(up.language, 'en')   as e_language,
        coalesce(up.country, 'EG')    as e_country,
        coalesce(bp.n, 0)             as e_baby_count,
        ll.ts                         as e_last_activity,
        exists (select 1 from public.app_admins a where a.user_id = u.id) as e_is_admin
      from auth.users u
      left join public.profiles         p  on p.id      = u.id
      left join public.user_preferences up on up.user_id = u.id
      left join baby_per_user           bp on bp.uid    = u.id
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
      f.e_last_activity,
      f.e_is_admin,
      counted.tc
    from filtered f cross join counted
    order by f.e_created_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_user_list(int, int, text) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- admin_feedback_list — same defensive rewrite (id / user_id / created_at
-- all also exist as columns on user_feedback)
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
      select
        f.id              as f_id,
        f.user_id         as f_user_id,
        u.email::text     as f_user_email,
        coalesce(p.display_name, '') as f_user_name,
        f.kind            as f_kind,
        f.subject         as f_subject,
        f.body            as f_body,
        f.attachment_path as f_attachment_path,
        f.status          as f_status,
        f.admin_response  as f_admin_response,
        f.created_at      as f_created_at,
        f.updated_at      as f_updated_at
      from public.user_feedback f
      join auth.users u  on u.id = f.user_id
      left join public.profiles p on p.id = f.user_id
      where f.deleted_at is null
        and (p_status is null or f.status = p_status)
    ),
    counted as (select (select count(*) from base)::bigint as tc)
    select
      b.f_id, b.f_user_id, b.f_user_email, b.f_user_name, b.f_kind,
      b.f_subject, b.f_body, b.f_attachment_path, b.f_status,
      b.f_admin_response, b.f_created_at, b.f_updated_at,
      counted.tc
    from base b cross join counted
    order by b.f_created_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_feedback_list(text, int, int) to authenticated;

commit;

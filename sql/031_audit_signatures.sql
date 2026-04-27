-- 031: Audit signatures — display "logged by Sarah · 2 hours ago" /
-- "edited by Ahmed · just now" on every record.
--
-- Two pieces:
--  1. user_display_names(uids[]) — security-definer helper to resolve a batch
--     of auth user UUIDs to friendly display names with email-prefix fallback.
--  2. row_audit_summaries(table, ids[]) — for a given log table + a batch of
--     row ids, return {created_by, created_at, last_updated_by, last_updated_at}.
--     created_* come from the row itself; last_updated_* come from audit_log
--     (latest UPDATE entry for that row).
--
-- Also: extend the audit_row_change trigger to all the newer log tables so
-- their UPDATEs land in audit_log. The trigger function itself is unchanged.

-- ---------------------------------------------------------------------------
-- 1) User display names
-- ---------------------------------------------------------------------------
create or replace function public.user_display_names(p_ids uuid[])
returns table(id uuid, name text, email text)
language sql security definer set search_path = public, auth as $$
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name,
    p.email::text as email
  from public.profiles p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

revoke all on function public.user_display_names(uuid[]) from public;
grant execute on function public.user_display_names(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Row audit summaries
-- ---------------------------------------------------------------------------
-- Whitelist of tables we'll surface audit signatures for. We keep this tight
-- to avoid the helper being abused as a generic table-scanner. Add more as
-- new log tables ship.
create or replace function public.row_audit_summaries(
  p_table text,
  p_ids uuid[]
)
returns table(
  row_id uuid,
  created_by uuid,
  created_at timestamptz,
  last_updated_by uuid,
  last_updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array[
    'feedings','stool_logs','sleep_logs','medications','medication_logs',
    'measurements','temperature_logs','vaccinations',
    'screen_time_logs','activity_logs','teething_logs','speaking_logs',
    'developmental_milestones','shopping_list_items','allergies',
    'medical_conditions','admissions','discharges','lab_panels','lab_panel_items',
    'doctors','appointments','prenatal_visits','ultrasounds','fetal_movements',
    'maternal_symptoms','medical_files'
  ];
  q text;
begin
  if not (p_table = any(allowed)) then
    raise exception 'row_audit_summaries: table % not allowed', p_table;
  end if;

  -- We have to validate access: the underlying tables already enforce RLS
  -- when we query them via authenticated session, but this function runs
  -- security-definer. So we re-select through a sub-query that applies the
  -- same baby-access rule by joining to the table and checking has_baby_access.
  q := format($f$
    with rows as (
      select id, baby_id, created_by, created_at
      from public.%I
      where id = any($1)
        and public.has_baby_access(baby_id)
    ),
    upd as (
      select row_id,
             max(edited_at)                                                    as last_updated_at,
             (array_agg(edited_by order by edited_at desc) filter (where edited_by is not null))[1]
                                                                               as last_updated_by
      from public.audit_log
      where table_name = %L
        and operation = 'UPDATE'
        and row_id = any($1)
      group by row_id
    )
    select r.id, r.created_by, r.created_at, u.last_updated_by, u.last_updated_at
    from rows r
    left join upd u on u.row_id = r.id
  $f$, p_table, p_table);
  return query execute q using p_ids;
end;
$$;

revoke all on function public.row_audit_summaries(text, uuid[]) from public;
grant execute on function public.row_audit_summaries(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Extend audit_row_change trigger to all log tables so UPDATEs are tracked.
--    Idempotent — re-running just re-creates the triggers.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'feedings','stool_logs','sleep_logs','medications','medication_logs',
    'measurements','temperature_logs','vaccinations',
    'screen_time_logs','activity_logs','teething_logs','speaking_logs',
    'developmental_milestones','shopping_list_items','allergies',
    'medical_conditions','admissions','discharges','lab_panels','lab_panel_items',
    'doctors','appointments','prenatal_visits','ultrasounds','fetal_movements',
    'maternal_symptoms'
  ])
  loop
    -- Only attach if the table actually exists in this schema (defensive
    -- because some installs may not have certain tables yet).
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('drop trigger if exists trg_audit_%I on public.%I;', t, t);
      execute format('create trigger trg_audit_%I
                      after insert or update or delete on public.%I
                      for each row execute function public.audit_row_change();', t, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Publish the changelog entry.
-- ---------------------------------------------------------------------------
select public.publish_app_update(
  'Audit trail: who logged it, who edited it',
  'Every record now shows who originally logged it and who last edited it (by name, not email), with relative timestamps. Helpful when multiple caregivers share a baby — you always know who entered or changed each entry.',
  'enhancement'
);

-- ============================================================================
-- Babylytics — Per-field audit log
-- ============================================================================
-- Every UPDATE and DELETE on a tracked table creates one row per CHANGED COLUMN
-- into audit_log. This gives us the required (original_value, edited_value,
-- edited_at, edited_by) triplet demanded by the OCR review spec, and it works
-- for manual edits, OCR-confirmed inserts, and corrections alike.
-- ============================================================================

create table if not exists public.audit_log (
    id             bigserial primary key,
    table_name     text not null,
    row_id         uuid not null,
    baby_id        uuid,                         -- de-normalized so we can RLS and query cheaply
    operation      text not null check (operation in ('INSERT','UPDATE','DELETE')),
    column_name    text,                         -- null on INSERT/DELETE header rows
    original_value jsonb,                        -- previous value (null for inserts)
    edited_value   jsonb,                        -- new value (null for deletes)
    edited_by      uuid references auth.users(id),
    edited_at      timestamptz not null default now()
);
create index if not exists idx_audit_row on public.audit_log(table_name, row_id, edited_at desc);
create index if not exists idx_audit_baby on public.audit_log(baby_id, edited_at desc);

-- Generic change-tracking trigger function.
-- It diffs OLD vs NEW for UPDATE, and writes one summary row for INSERT/DELETE.
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_baby  uuid;
  v_old   jsonb := to_jsonb(old);
  v_new   jsonb := to_jsonb(new);
  k text;
begin
  -- Pick baby_id off the row if present. Special-case for tables that don't
  -- carry baby_id directly (none today, but safe for the future).
  if tg_op in ('INSERT','UPDATE') then
    v_baby := nullif(v_new->>'baby_id','')::uuid;
  else
    v_baby := nullif(v_old->>'baby_id','')::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.audit_log(table_name,row_id,baby_id,operation,column_name,original_value,edited_value,edited_by)
    values (tg_table_name,(v_new->>'id')::uuid,v_baby,'INSERT',null,null,v_new,v_actor);
    return new;

  elsif tg_op = 'DELETE' then
    insert into public.audit_log(table_name,row_id,baby_id,operation,column_name,original_value,edited_value,edited_by)
    values (tg_table_name,(v_old->>'id')::uuid,v_baby,'DELETE',null,v_old,null,v_actor);
    return old;

  else -- UPDATE
    for k in select jsonb_object_keys(v_new) loop
      if k in ('updated_at') then continue; end if;                     -- noise
      if (v_old->k) is distinct from (v_new->k) then
        insert into public.audit_log(table_name,row_id,baby_id,operation,column_name,original_value,edited_value,edited_by)
        values (tg_table_name,(v_new->>'id')::uuid,v_baby,'UPDATE',k,v_old->k,v_new->k,v_actor);
      end if;
    end loop;
    return new;
  end if;
end; $$;

-- Attach to every mutable domain table
do $$
declare t text;
begin
  for t in select unnest(array[
    'babies','feedings','stool_logs','medications','medication_logs','measurements'
  ])
  loop
    execute format('drop trigger if exists trg_audit_%I on public.%I;', t, t);
    execute format('create trigger trg_audit_%I
                    after insert or update or delete on public.%I
                    for each row execute function public.audit_row_change();', t, t);
  end loop;
end $$;

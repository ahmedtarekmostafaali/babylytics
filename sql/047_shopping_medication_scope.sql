-- 047: Shopping list — medication scope + pharmacy read access + linker RPC
-- ============================================================================
-- 1. Widen shopping_list_items.scope to include 'medication'.
-- 2. Add medication_id FK so a refill row links back to the medication it
--    came from (for the "ordered" → "decrement low-stock alert" hookup).
-- 3. Re-scope RLS: parents see all scopes, pharmacy sees ONLY medication
--    scope (matches their existing read on medications + stock).
-- 4. add_medication_to_shopping(med_id, quantity, notes) — convenience RPC
--    so the medications page + stock page can one-tap a refill into the
--    shopping list without the client knowing about scope semantics.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Widen scope check
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shopping_list_items drop constraint if exists shopping_list_items_scope_check;
alter table public.shopping_list_items add constraint shopping_list_items_scope_check
  check (scope in ('baby','pregnancy','medication'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Optional FK to the medication that triggered the shopping entry. Soft
--    link — kept on delete set null so removing the prescription doesn't
--    wipe out the shopping history.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shopping_list_items
  add column if not exists medication_id uuid references public.medications(id) on delete set null;
create index if not exists shopping_list_items_medication_idx
  on public.shopping_list_items (medication_id) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — pharmacy sees ONLY medication-scoped items
-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the old broad has_baby_access SELECT (which would now exclude pharmacy
-- because we narrowed has_baby_access in 046) and replace with two policies:
--   a. members (parent/doctor/nurse/viewer) see all rows
--   b. pharmacy sees only rows where scope = 'medication'
drop policy if exists shopping_list_items_member_select on public.shopping_list_items;
create policy shopping_list_items_member_select on public.shopping_list_items
  for select using (public.has_baby_access(baby_id));

drop policy if exists shopping_list_items_pharmacy_select on public.shopping_list_items;
create policy shopping_list_items_pharmacy_select on public.shopping_list_items
  for select using (
    scope = 'medication'
    and exists (
      select 1 from public.baby_users
      where baby_id = shopping_list_items.baby_id
        and user_id = auth.uid()
        and role = 'pharmacy'
    )
  );

-- Writes stay restricted to has_baby_write (parent/owner) — pharmacy is
-- read-only on shopping. Existing policy already does this.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Convenience RPC: add a medication refill to the shopping list. The
--    client sends just the medication_id; we look up name/dosage/baby_id
--    and write a properly-scoped row. Returns the new shopping item id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_medication_to_shopping(
  p_med_id   uuid,
  p_quantity text default null,
  p_notes    text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_baby uuid;
  v_name text;
  v_dose text;
  v_id   uuid;
begin
  select baby_id, name, dosage into v_baby, v_name, v_dose
    from public.medications where id = p_med_id and deleted_at is null;
  if v_baby is null then raise exception 'medication not found'; end if;
  if not public.has_baby_write(v_baby) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.shopping_list_items
    (baby_id, scope, name, category, quantity, notes, priority, medication_id, created_by)
       values (
         v_baby, 'medication',
         v_name || coalesce(' · ' || v_dose, ''),
         'Medication',
         coalesce(p_quantity, 'refill'),
         p_notes,
         'normal',
         p_med_id,
         auth.uid()
       )
    returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.add_medication_to_shopping(uuid, text, text) to authenticated;

commit;

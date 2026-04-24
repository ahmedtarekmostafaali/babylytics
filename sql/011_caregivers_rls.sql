-- ============================================================================
-- Babylytics — migration 011
-- Loosen baby_users RLS so parents (not just owners) can see and manage the
-- caregiver list. Only owners can change the owner's role or remove the last
-- owner — those invariants are still enforced in the RPCs, not at the policy
-- level.
-- ============================================================================

drop policy if exists baby_users_select on public.baby_users;
create policy baby_users_select on public.baby_users
  for select using (
       user_id = auth.uid()
    or public.is_baby_parent(baby_id)
  );

-- Parents may insert caregivers into babies they already belong to. Owner-only
-- checks (no promoting someone to owner without being owner) stay inside the
-- `invite_caregiver` RPC.
drop policy if exists baby_users_insert on public.baby_users;
create policy baby_users_insert on public.baby_users
  for insert with check (public.is_baby_parent(baby_id));

-- Parents may change roles on other caregivers. The "you can't transfer
-- ownership unless you're the owner" rule is enforced in set_caregiver_role.
drop policy if exists baby_users_update on public.baby_users;
create policy baby_users_update on public.baby_users
  for update using (public.is_baby_parent(baby_id))
  with check (public.is_baby_parent(baby_id));

-- Parents may remove caregivers (but RPC enforces "can't remove last owner").
drop policy if exists baby_users_delete on public.baby_users;
create policy baby_users_delete on public.baby_users
  for delete using (
       public.is_baby_parent(baby_id)
    or user_id = auth.uid()
  );

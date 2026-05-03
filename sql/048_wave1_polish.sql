-- 048: Wave 1 polish — pharmacy invite fix + stage transitions + cycle naming
-- ============================================================================
-- 1. Fix invite_caregiver — its hard-coded role whitelist didn't include
--    'pharmacy', so the caregiver invite UI threw "invalid role pharmacy".
-- 2. Add transition_to_pregnancy(baby_id, edd, lmp) — moves a planning
--    profile into the pregnancy stage while preserving cycle history.
-- 3. Cycle data audit-friendliness: nothing schema-wise; just a comment
--    that menstrual_cycles stays attached to the baby_id permanently so
--    historical context survives every transition (planning → pregnancy →
--    born, etc.).
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Pharmacy invite fix
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.invite_caregiver(p_baby uuid, p_email text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_actor uuid := auth.uid();
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may invite caregivers';
  end if;
  -- Widened in 048 to include 'pharmacy' (added by 046 batch).
  if p_role not in ('owner','parent','doctor','nurse','caregiver','viewer','pharmacy') then
    raise exception 'invalid role %', p_role;
  end if;
  if p_role = 'owner' and not public.is_baby_owner(p_baby) then
    raise exception 'only the current owner can transfer ownership';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then raise exception 'no user with email %', p_email; end if;

  insert into public.baby_users(baby_id, user_id, role, invited_by)
    values (p_baby, v_user, p_role, v_actor)
    on conflict (baby_id, user_id) do update set role = excluded.role;
end; $$;
grant execute on function public.invite_caregiver(uuid,text,text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. transition_to_pregnancy — promote a planning profile into pregnancy
-- ─────────────────────────────────────────────────────────────────────────────
-- Two scenarios covered:
--   a. The user got pregnant while using the cycle planner. Their
--      menstrual_cycles + symptom history stays attached to the same
--      baby_id, just with stage flipped to 'pregnancy' + EDD/LMP set.
--   b. They later mark-as-born → MarkAsBornDialog already exists for
--      pregnancy → newborn. No change needed there; cycle rows continue
--      to live under the baby_id.
create or replace function public.transition_to_pregnancy(
  p_baby uuid,
  p_edd date default null,
  p_lmp date default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may change stage';
  end if;
  if p_edd is null and p_lmp is null then
    raise exception 'provide either EDD or LMP';
  end if;

  update public.babies
    set lifecycle_stage = 'pregnancy',
        edd = coalesce(p_edd, edd),
        lmp = coalesce(p_lmp, lmp),
        updated_at = now()
    where id = p_baby;
end; $$;
grant execute on function public.transition_to_pregnancy(uuid, date, date) to authenticated;

commit;

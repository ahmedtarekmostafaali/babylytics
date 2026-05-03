-- 049: Wave 2 — per-area caregiver visibility + user feature prefs + transition guards
-- ============================================================================
-- 1. baby_users.allowed_areas text[] — null = all areas (default), or a
--    specific list of area keys ('feedings','stool','sleep',...). Used by
--    server-side page guards + the sidebar to hide what a caregiver isn't
--    allowed to see. Writes still gated by has_baby_write — these toggles
--    are for visibility only.
--
-- 2. user_preferences.enabled_features jsonb — per-user, per-stage feature
--    visibility. Shape: {planning:[...], pregnancy:[...], baby:[...]}.
--    Empty arrays mean "default everything"; explicit arrays narrow to
--    just those features. Picked at registration, editable in /preferences.
--
-- 3. SQL helpers:
--    - my_allowed_areas(baby_id) → text[] | null
--    - my_enabled_features(stage) → text[] | null
--
-- 4. Audit: every stage transition (planning → pregnancy → newborn → ...)
--    preserves data because every existing FK lives on baby_id which
--    survives stage flips. Confirmed; no schema changes needed for #5.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. baby_users.allowed_areas
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.baby_users
  add column if not exists allowed_areas text[];

comment on column public.baby_users.allowed_areas is
  'Caregiver visibility: null = full access (default); otherwise array of area '
  'keys like {feedings,stool,sleep}. Writes still gated by has_baby_write.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_preferences.enabled_features
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.user_preferences
  add column if not exists enabled_features jsonb not null default '{}'::jsonb;

comment on column public.user_preferences.enabled_features is
  'Per-stage feature visibility shaped {planning:[...],pregnancy:[...],baby:[...]}. '
  'Empty / missing key = default visibility. Set during registration in the '
  'feature picker, editable on /preferences.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.my_allowed_areas(p_baby uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select allowed_areas from public.baby_users
  where baby_id = p_baby and user_id = auth.uid()
  limit 1;
$$;
grant execute on function public.my_allowed_areas(uuid) to authenticated;

create or replace function public.my_enabled_features(p_stage text)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
           when (enabled_features ? p_stage)
             then array(select jsonb_array_elements_text(enabled_features -> p_stage))
           else null
         end
  from public.user_preferences
  where user_id = auth.uid()
  limit 1;
$$;
grant execute on function public.my_enabled_features(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. set_caregiver_areas RPC — parents change a caregiver's area list
-- ─────────────────────────────────────────────────────────────────────────────
-- Pass null to reset to "full access". Only the baby's parent/owner can
-- call. Pharmacy users can never gain non-medication access via this RPC
-- (guarded below).
create or replace function public.set_caregiver_areas(
  p_baby uuid,
  p_user uuid,
  p_areas text[] default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_role text;
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may change caregiver permissions';
  end if;
  select role into v_role from public.baby_users
   where baby_id = p_baby and user_id = p_user;
  if v_role is null then raise exception 'no such caregiver'; end if;
  if v_role = 'pharmacy' then
    -- Pharmacy is locked to medication area regardless of what's passed.
    update public.baby_users
       set allowed_areas = array['medications','medication_stock','shopping']
     where baby_id = p_baby and user_id = p_user;
    return;
  end if;
  update public.baby_users
     set allowed_areas = p_areas
   where baby_id = p_baby and user_id = p_user;
end;
$$;
grant execute on function public.set_caregiver_areas(uuid, uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Re-extend invite_caregiver to accept p_areas in one call. Falls back
--    to the 3-arg overload via default null. Pharmacy role still gets its
--    fixed area set regardless of what's passed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.invite_caregiver(
  p_baby uuid,
  p_email text,
  p_role text,
  p_areas text[] default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_actor uuid := auth.uid();
  v_areas text[] := p_areas;
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may invite caregivers';
  end if;
  if p_role not in ('owner','parent','doctor','nurse','caregiver','viewer','pharmacy') then
    raise exception 'invalid role %', p_role;
  end if;
  if p_role = 'owner' and not public.is_baby_owner(p_baby) then
    raise exception 'only the current owner can transfer ownership';
  end if;
  if p_role = 'pharmacy' then
    -- Force pharmacy area scope regardless of whatever the client sent.
    v_areas := array['medications','medication_stock','shopping'];
  end if;

  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then raise exception 'no user with email %', p_email; end if;

  insert into public.baby_users(baby_id, user_id, role, invited_by, allowed_areas)
       values (p_baby, v_user, p_role, v_actor, v_areas)
  on conflict (baby_id, user_id) do update
       set role = excluded.role,
           allowed_areas = excluded.allowed_areas;
end; $$;
grant execute on function public.invite_caregiver(uuid, text, text, text[]) to authenticated;

commit;

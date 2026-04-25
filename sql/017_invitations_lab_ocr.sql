-- ============================================================================
-- Babylytics — migration 017
-- Invitations (email or shareable link, pre-assigned role) + a small
-- helper RPC for the OCR-fed lab panel auto-create flow.
-- ============================================================================

-- 1. invitations --------------------------------------------------------------
-- Each invitation is a UUID token. The parent who creates it picks a role
-- + optional pre-filled email + optional welcome message. Anyone with the
-- link can accept it (authenticated only) within 14 days.
create table if not exists public.invitations (
    id           uuid primary key default gen_random_uuid(),
    baby_id      uuid not null references public.babies(id) on delete cascade,
    role         text not null check (role in ('parent','doctor','nurse','caregiver','viewer')),
    email        text,
    message      text,
    invited_by   uuid not null references auth.users(id),
    expires_at   timestamptz not null default (now() + interval '14 days'),
    accepted_at  timestamptz,
    accepted_by  uuid references auth.users(id),
    revoked_at   timestamptz,
    created_at   timestamptz not null default now()
);
create index if not exists idx_invitations_baby on public.invitations(baby_id, created_at desc)
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;

drop policy if exists invitations_parent_select on public.invitations;
create policy invitations_parent_select on public.invitations
  for select using (public.is_baby_parent(baby_id));

drop policy if exists invitations_parent_write on public.invitations;
create policy invitations_parent_write on public.invitations
  for all using (public.is_baby_parent(baby_id))
  with check (public.is_baby_parent(baby_id));

-- 2. peek_invitation ---------------------------------------------------------
-- Lets ANY authenticated user peek at an invitation by its UUID token to see
-- the baby name and assigned role before accepting. SECURITY DEFINER bypasses
-- RLS — the token itself is the auth.
create or replace function public.peek_invitation(p_token uuid)
returns table (
  baby_id     uuid,
  baby_name   text,
  role        text,
  expires_at  timestamptz,
  valid       boolean,
  reason      text
) language plpgsql stable security definer set search_path = public as $$
declare v_inv record; v_baby_name text;
begin
  select * into v_inv from public.invitations where id = p_token limit 1;
  if not found then
    return query select null::uuid, null::text, null::text, null::timestamptz, false, 'not_found'::text;
    return;
  end if;
  if v_inv.revoked_at is not null then
    return query select v_inv.baby_id, null::text, v_inv.role, v_inv.expires_at, false, 'revoked'::text;
    return;
  end if;
  if v_inv.accepted_at is not null then
    return query select v_inv.baby_id, null::text, v_inv.role, v_inv.expires_at, false, 'accepted'::text;
    return;
  end if;
  if v_inv.expires_at < now() then
    return query select v_inv.baby_id, null::text, v_inv.role, v_inv.expires_at, false, 'expired'::text;
    return;
  end if;
  select name into v_baby_name from public.babies where id = v_inv.baby_id and deleted_at is null;
  return query select v_inv.baby_id, v_baby_name, v_inv.role, v_inv.expires_at, true, null::text;
end; $$;
grant execute on function public.peek_invitation(uuid) to authenticated;

-- 3. accept_invitation -------------------------------------------------------
create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv record; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;

  select * into v_inv from public.invitations where id = p_token for update;
  if not found                       then raise exception 'invitation_not_found'; end if;
  if v_inv.revoked_at  is not null   then raise exception 'invitation_revoked'; end if;
  if v_inv.accepted_at is not null   then raise exception 'invitation_already_accepted'; end if;
  if v_inv.expires_at  < now()       then raise exception 'invitation_expired'; end if;

  insert into public.baby_users(baby_id, user_id, role, invited_by)
    values (v_inv.baby_id, v_actor, v_inv.role, v_inv.invited_by)
    on conflict (baby_id, user_id) do update set role = excluded.role;

  update public.invitations set accepted_at = now(), accepted_by = v_actor where id = p_token;

  return v_inv.baby_id;
end; $$;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- 4. revoke_invitation -------------------------------------------------------
create or replace function public.revoke_invitation(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_baby uuid;
begin
  select baby_id into v_baby from public.invitations where id = p_token;
  if not found                      then raise exception 'invitation_not_found'; end if;
  if not public.is_baby_parent(v_baby) then raise exception 'forbidden'; end if;
  update public.invitations set revoked_at = now() where id = p_token;
end; $$;
grant execute on function public.revoke_invitation(uuid) to authenticated;

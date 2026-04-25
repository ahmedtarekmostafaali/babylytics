-- ============================================================================
-- Babylytics — migration 019
-- (5) doctors.user_id link so a doctor caregiver only sees their own row.
-- ============================================================================

alter table public.doctors
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_doctors_user_id on public.doctors(user_id) where deleted_at is null;

-- Replace the parent-only select policy so doctor users can see THEIR own row
-- on the babies they have access to. Parents/owners still see everything.
drop policy if exists doctors_parent_select on public.doctors;
create policy doctors_member_select on public.doctors
  for select using (
    public.is_baby_parent(baby_id)
    or (user_id = auth.uid() and public.has_baby_access(baby_id))
  );

-- Auto-link the doctors row when a 'doctor' role accepts a share-link
-- invitation by matching email (best-effort; harmless when no match).
-- We extend accept_invitation rather than adding a separate trigger.
create or replace function public.accept_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv record; v_actor uuid := auth.uid(); v_email text;
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

  -- If the invite role is doctor, try to match an existing doctors row by
  -- email so the new user can see their own card going forward.
  if v_inv.role = 'doctor' then
    select email into v_email from auth.users where id = v_actor;
    if v_email is not null then
      update public.doctors
         set user_id = v_actor
       where baby_id = v_inv.baby_id
         and user_id is null
         and lower(email) = lower(v_email)
         and deleted_at is null;
    end if;
  end if;

  return v_inv.baby_id;
end; $$;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- (4) overdue / due-soon medications RPC — used by the notifications popup
-- so the bell shows real-time content without us hand-rolling another query
-- in TypeScript. Builds on the existing schedule logic in 012.
create or replace function public.due_medications(p_baby uuid)
returns table (
  medication_id uuid,
  name          text,
  dosage        text,
  due_at        timestamptz,
  is_overdue    boolean,
  minutes_off   integer
) language sql stable security definer set search_path = public as $$
  with active_meds as (
    select id, name, dosage, frequency_hours, starts_at, ends_at
      from public.medications
     where baby_id = p_baby
       and deleted_at is null
       and (ends_at is null or ends_at >= now())
       and frequency_hours is not null
  ), last_taken as (
    select medication_id, max(medication_time) as last_at
      from public.medication_logs
     where baby_id = p_baby and deleted_at is null and status = 'taken'
     group by medication_id
  )
  select m.id,
         m.name,
         m.dosage,
         coalesce(lt.last_at + (m.frequency_hours || ' hours')::interval, m.starts_at) as due_at,
         (coalesce(lt.last_at + (m.frequency_hours || ' hours')::interval, m.starts_at) < now()) as is_overdue,
         (extract(epoch from (now() - coalesce(lt.last_at + (m.frequency_hours || ' hours')::interval, m.starts_at))) / 60)::integer as minutes_off
    from active_meds m
    left join last_taken lt on lt.medication_id = m.id
   where coalesce(lt.last_at + (m.frequency_hours || ' hours')::interval, m.starts_at) < (now() + interval '12 hours')
   order by 4 asc;
$$;
grant execute on function public.due_medications(uuid) to authenticated;

-- Helper: mark all a user's notifications for a baby as read.
create or replace function public.mark_notifications_read(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.has_baby_access(p_baby) then raise exception 'forbidden'; end if;

  with updated as (
    update public.notifications
       set read_at = now()
     where baby_id = p_baby
       and (user_id = auth.uid() or user_id is null)
       and read_at is null
     returning 1
  )
  select count(*)::integer into v_count from updated;

  return coalesce(v_count, 0);
end; $$;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- Helper: clear (soft-mark-read for) all notifications for a baby — same as
-- mark_notifications_read but kept as a separate name for the UI "Clear all"
-- button in case we want to harden the semantics later.
create or replace function public.clear_notifications(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.mark_notifications_read(p_baby);
end; $$;
grant execute on function public.clear_notifications(uuid) to authenticated;

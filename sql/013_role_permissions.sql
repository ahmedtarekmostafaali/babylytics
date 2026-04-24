-- ============================================================================
-- Babylytics — migration 013
-- Tighten role permissions:
--   owner/parent  → full write on everything, uploads, reports, settings
--   doctor        → read logs + files; add comments; no write on logs/files
--   nurse         → read logs + files only; no writes, no comments
--   caregiver     → treated as `nurse` (the role is folded; existing rows
--                   migrated to `nurse`, but the check constraint keeps the
--                   literal around for backward compatibility)
--   viewer        → read only; UI restricts to overview
--
-- `has_baby_write` now returns true ONLY for owners and parents. A new
-- `has_baby_comment` helper allows doctors to post comments.
-- ============================================================================

-- 1. Fold caregiver → nurse (so the permission model has five distinct levels).
update public.baby_users set role = 'nurse' where role = 'caregiver';

-- 2. has_baby_write = owner/parent only (legacy 'editor' kept as parent alias)
create or replace function public.has_baby_write(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid()
      and role in ('owner','parent','editor')
  );
$$;

-- 3. has_baby_comment = owner/parent + doctor
create or replace function public.has_baby_comment(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid()
      and role in ('owner','parent','editor','doctor')
  );
$$;
grant execute on function public.has_baby_comment(uuid) to authenticated;

-- 4. Rewrite comments policies so only owners/parents/doctors can POST.
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (public.has_baby_comment(baby_id) and author = auth.uid());

-- Author still owns their own comments; no change to update/delete/select.

-- 5. Storage: uploads belong to parents only. Existing storage_insert policy
--    uses has_baby_write(), which now means owner/parent — so doctors,
--    nurses, and viewers can no longer drop files into the bucket.
--    Nothing to change here; re-state for clarity.
--    (storage_select/update/delete remain access-gated via has_baby_access/
--     has_baby_write as before — the new, tighter write semantics apply
--     automatically.)

-- 6. Log tables: all existing write policies use has_baby_write(). They
--    now mean "owner or parent" automatically. Nothing else to do here.

-- 7. Convenience: role names for the UI, kept in sync so the dropdown and
--    the RLS agree. (Not used by SQL but kept as a reference.)
comment on column public.baby_users.role is
  'One of: owner, parent, doctor, nurse, viewer (+ legacy: editor→parent, caregiver→nurse)';

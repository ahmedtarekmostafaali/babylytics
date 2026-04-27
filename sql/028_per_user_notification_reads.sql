-- 028: Per-user notification read state.
--
-- Bug:  the existing notifications.read_at column is a single field on the row.
--       For broadcast notifications (user_id IS NULL — every caregiver of the
--       baby sees them), one user marking them as read flipped read_at for
--       everyone else too. The dashboard's unread badge then drifted out of
--       sync per user.
-- Fix:  introduce notification_reads(notification_id, user_id) — one row per
--       (broadcast, user) marked as read. Personal notifications still use
--       notifications.read_at directly. mark_notifications_read writes to the
--       new table for broadcasts and updates read_at for personal rows.
--
-- Also: extend the notifications.kind check to include 'app_update' so the
--       upcoming /updates page can broadcast a notification on each release.

-- New table — one row per (notification_id, user_id) the user has dismissed.
create table if not exists public.notification_reads (
    notification_id uuid not null references public.notifications(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    read_at         timestamptz not null default now(),
    primary key (notification_id, user_id)
);

create index if not exists idx_notification_reads_user
  on public.notification_reads(user_id, notification_id);

-- RLS — a user can only see/insert their own read marks.
alter table public.notification_reads enable row level security;

drop policy if exists notif_reads_select_own on public.notification_reads;
create policy notif_reads_select_own on public.notification_reads
  for select using (user_id = auth.uid());

drop policy if exists notif_reads_insert_own on public.notification_reads;
create policy notif_reads_insert_own on public.notification_reads
  for insert with check (user_id = auth.uid());

-- Allow 'app_update' as a kind. ALTER TABLE / DROP CONSTRAINT is idempotent
-- under the IF EXISTS guard.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add  constraint notifications_kind_check
  check (kind in (
    'medication_due','medication_missed','low_ocr_confidence',
    'file_ready','feeding_alert','stool_alert',
    'app_update'
  ));

-- Helper: returns true if the calling user has unread access to this row.
-- - personal row (user_id = me): unread iff read_at is null
-- - broadcast row (user_id is null): unread iff no notification_reads row for me
create or replace function public.notification_unread_for_user(
  p_notification public.notifications,
  p_user uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_notification.user_id = p_user then p_notification.read_at is null
    when p_notification.user_id is null  then not exists (
      select 1 from public.notification_reads r
      where r.notification_id = p_notification.id and r.user_id = p_user
    )
    else false
  end;
$$;
grant execute on function public.notification_unread_for_user(public.notifications, uuid) to authenticated;

-- Re-define mark_notifications_read so broadcasts get a per-user notification_reads
-- row instead of stomping read_at globally. Personal rows still update read_at.
create or replace function public.mark_notifications_read(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
        v_personal integer;
        v_broadcast integer;
begin
  if not public.has_baby_access(p_baby) then raise exception 'forbidden'; end if;

  -- Personal notifications addressed to this user only.
  with upd as (
    update public.notifications
       set read_at = now()
     where baby_id = p_baby
       and user_id = v_user
       and read_at is null
     returning 1
  )
  select count(*)::integer into v_personal from upd;

  -- Broadcast notifications — record per-user reads. Skip ones already marked.
  with ins as (
    insert into public.notification_reads (notification_id, user_id, read_at)
    select n.id, v_user, now()
      from public.notifications n
     where n.baby_id = p_baby
       and n.user_id is null
       and not exists (
         select 1 from public.notification_reads r
         where r.notification_id = n.id and r.user_id = v_user
       )
    returning 1
  )
  select count(*)::integer into v_broadcast from ins;

  return coalesce(v_personal, 0) + coalesce(v_broadcast, 0);
end; $$;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- clear_notifications was an alias — keep it that way so the UI keeps working.
create or replace function public.clear_notifications(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.mark_notifications_read(p_baby);
end; $$;
grant execute on function public.clear_notifications(uuid) to authenticated;

-- Single-row dismiss helper used by the bell's per-item Mark-read button.
-- Same semantics as mark_notifications_read but scoped to one notification.
create or replace function public.mark_one_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
        v_user_id uuid;
        v_baby_id uuid;
begin
  select n.user_id, n.baby_id into v_user_id, v_baby_id
    from public.notifications n where n.id = p_id;
  if not found then return; end if;
  if not public.has_baby_access(v_baby_id) then raise exception 'forbidden'; end if;

  if v_user_id = v_user then
    update public.notifications set read_at = now() where id = p_id and read_at is null;
  elsif v_user_id is null then
    insert into public.notification_reads (notification_id, user_id, read_at)
      values (p_id, v_user, now())
      on conflict (notification_id, user_id) do nothing;
  end if;
end; $$;
grant execute on function public.mark_one_notification_read(uuid) to authenticated;

-- View used by the dashboard + bell to filter unread per-user. The Supabase
-- client filters on this view with .or(...) etc. We expose a thin wrapper
-- function to make the per-user check simple at the SQL layer.
create or replace function public.my_unread_notifications(p_baby uuid default null)
returns setof public.notifications
language sql stable security definer set search_path = public as $$
  select n.*
    from public.notifications n
   where (p_baby is null or n.baby_id = p_baby)
     and (n.user_id = auth.uid() or n.user_id is null)
     and public.notification_unread_for_user(n, auth.uid())
   order by n.created_at desc;
$$;
grant execute on function public.my_unread_notifications(uuid) to authenticated;

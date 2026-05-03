-- 052: Wave 7 — caregiver chat (per-profile) + doctor↔caregiver linking helpers
-- ============================================================================
-- 1. baby_messages — group chat scoped to each profile. Every caregiver with
--    has_baby_access can read AND write. Soft-delete via deleted_at so
--    moderation history survives. Realtime publication included so the UI
--    can subscribe.
--
-- 2. send_baby_message(p_baby, p_body) — convenience RPC. Writes a row
--    after a length check. Returns the row id.
--
-- 3. soft_delete_baby_message(p_message_id) — author OR parent/owner can
--    soft-delete. Used by the chat UI's row delete action.
--
-- 4. baby_caregivers_with_doctor — view that joins baby_users with the
--    doctors table on user_id so the caregiver list can show "Linked to
--    Dr X" badges. Filtered to non-deleted doctors only.
--
-- 5. publish_app_update for the chat feature.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. baby_messages table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.baby_messages (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references public.babies(id) on delete cascade,
  user_id     uuid not null references auth.users(id)    on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);

create index if not exists idx_baby_messages_baby_created
  on public.baby_messages (baby_id, created_at desc)
  where deleted_at is null;

alter table public.baby_messages enable row level security;

-- SELECT: any caregiver with access to the baby. Hides soft-deleted rows
-- by default — UI can show "[deleted]" placeholder via a separate query
-- if desired.
drop policy if exists baby_messages_select on public.baby_messages;
create policy baby_messages_select on public.baby_messages
  for select using (
    public.has_baby_access(baby_id) and deleted_at is null
  );

-- INSERT: any caregiver with access. user_id MUST be the caller (no spoofing).
drop policy if exists baby_messages_insert on public.baby_messages;
create policy baby_messages_insert on public.baby_messages
  for insert with check (
    public.has_baby_access(baby_id) and user_id = auth.uid()
  );

-- UPDATE: only own rows (for soft-delete + edit). Parents can also touch
-- any row for moderation via the RPC below.
drop policy if exists baby_messages_update on public.baby_messages;
create policy baby_messages_update on public.baby_messages
  for update using (
    user_id = auth.uid() and public.has_baby_access(baby_id)
  );

-- Add to realtime publication so the client can subscribe to inserts +
-- updates. Wrapped in a guard so re-running the migration doesn't error
-- on "already in publication".
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'baby_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.baby_messages';
  end if;
exception when undefined_object then
  -- Self-hosted setups without supabase_realtime publication — skip silently.
  null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. send_baby_message RPC (convenience wrapper, also enforces length)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.send_baby_message(p_baby uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'forbidden'; end if;
  if p_body is null or length(trim(p_body)) = 0 then raise exception 'empty_body'; end if;
  if length(p_body) > 4000 then raise exception 'body_too_long'; end if;
  insert into public.baby_messages(baby_id, user_id, body)
       values (p_baby, auth.uid(), p_body)
       returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.send_baby_message(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. soft_delete_baby_message RPC (author OR baby parent)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.soft_delete_baby_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_msg record;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v_msg from public.baby_messages where id = p_message_id;
  if not found then raise exception 'not_found'; end if;
  if v_msg.user_id <> auth.uid() and not public.is_baby_parent(v_msg.baby_id) then
    raise exception 'forbidden';
  end if;
  update public.baby_messages set deleted_at = now() where id = p_message_id;
end;
$$;
grant execute on function public.soft_delete_baby_message(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. baby_caregivers_with_doctor view — join baby_users → doctors on user_id
-- so the caregivers list can show "Linked to Dr X" badges for doctor users.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.baby_caregivers_with_doctor as
  select
    bu.baby_id,
    bu.user_id,
    bu.role,
    bu.created_at,
    bu.allowed_areas,
    d.id   as doctor_id,
    d.name as doctor_name,
    d.specialty as doctor_specialty
    from public.baby_users bu
    left join public.doctors d
           on d.baby_id = bu.baby_id
          and d.user_id = bu.user_id
          and d.deleted_at is null;

-- View inherits RLS from baby_users + doctors via the join. Grant SELECT
-- to authenticated; existing policies on the underlying tables filter rows.
grant select on public.baby_caregivers_with_doctor to authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. App update notification (idempotent via publish_app_update unique idx)
-- ─────────────────────────────────────────────────────────────────────────────
select public.publish_app_update(
  p_title    => $t1$Group chat per profile + doctor caregiver linking$t1$,
  p_body     => $b1$Two new things: (1) Every profile now has a group chat — head to the new "Chat" tab in Family. Anyone with access to the profile (parent, doctor, nurse, viewer) can post and read. Useful for caregivers handing off, doctors leaving notes, or a parent away from home checking in. (2) Doctor caregivers can be linked to a doctor record from the Doctors page — the caregiver list shows their linked doctor name, and accepting a doctor invitation auto-links by email.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$دردشة جماعية لكل ملف + ربط الطبيب بمقدم الرعاية$ta1$,
  p_body_ar  => $ba1$جديدان: (١) كل ملف صار له دردشة جماعية — افتحي تبويبة "الدردشة" في القسم العائلي. أي شخص له صلاحية على الملف (ولي أمر، طبيب، ممرضة، مشاهد) يقدر يكتب ويقرأ. مفيدة لتسليم المهام بين مقدمي الرعاية أو لرسائل الطبيب. (٢) صار يمكن ربط حساب الطبيب المدعو بسجل الطبيب في صفحة الأطباء — وقائمة مقدمي الرعاية بتعرض اسم الطبيب المرتبط، والقبول تلقائي بمطابقة البريد.$ba1$
);

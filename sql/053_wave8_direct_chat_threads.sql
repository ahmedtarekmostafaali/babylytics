-- 053: Wave 8 — direct/private chat threads (foundation for doctor consults)
-- ============================================================================
-- The existing baby_messages table (sql/052) is a single GROUP chat per
-- profile that everyone with has_baby_access can see. This wave adds
-- explicit-participant THREADS so two people (e.g. parent + doctor) can
-- have a private conversation that other caregivers don't see.
--
-- 1. chat_threads — one row per private thread. baby_id scopes the thread
--    to a profile so the same two people can have separate conversations
--    on different babies. `kind`:
--      - 'direct'  → 1:1 thread between two people
--      - 'consult' → reserved for the future verified-doctor consultation
--                    feature (extra metadata can hang off this row)
--
-- 2. chat_thread_participants — composite (thread_id, user_id) PK. Includes
--    last_read_at so the UI can show unread counts.
--
-- 3. chat_thread_messages — individual posts. Soft-delete via deleted_at.
--
-- 4. is_thread_participant(thread_id) helper used by RLS policies.
--
-- 5. RPCs:
--      - start_or_get_direct_thread(p_baby, p_other_user) → uuid
--          Looks up an existing 1:1 thread between caller + p_other_user
--          on this baby. Creates it if missing. Returns thread id.
--          Both participants must have access to the baby.
--      - send_thread_message(p_thread, p_body) → uuid
--          Posts a message + bumps last_message_at on the thread.
--      - soft_delete_thread_message(p_message_id) → void
--      - mark_thread_read(p_thread) → void
--
-- 6. Realtime publication entries for the new tables.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. chat_threads
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_threads (
  id              uuid primary key default gen_random_uuid(),
  baby_id         uuid not null references public.babies(id) on delete cascade,
  kind            text not null default 'direct'
                     check (kind in ('direct', 'consult')),
  title           text,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references auth.users(id),
  last_message_at timestamptz not null default now()
);
create index if not exists idx_chat_threads_baby_lastmsg
  on public.chat_threads (baby_id, last_message_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. chat_thread_participants
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_thread_participants (
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists idx_chat_participants_user
  on public.chat_thread_participants (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. chat_thread_messages
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.chat_thread_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.chat_threads(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 4000),
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz
);
create index if not exists idx_thread_msgs_thread_created
  on public.chat_thread_messages (thread_id, created_at desc)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. is_thread_participant helper (used by all RLS policies below)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_thread_participant(p_thread uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.chat_thread_participants
     where thread_id = p_thread and user_id = auth.uid()
  );
$$;
grant execute on function public.is_thread_participant(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — thread / participant / message policies
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.chat_threads              enable row level security;
alter table public.chat_thread_participants  enable row level security;
alter table public.chat_thread_messages      enable row level security;

drop policy if exists chat_threads_select on public.chat_threads;
create policy chat_threads_select on public.chat_threads
  for select using ( public.is_thread_participant(id) );

-- INSERT/UPDATE/DELETE on chat_threads goes through RPCs (security definer).
-- No direct policy needed beyond SELECT.

drop policy if exists chat_participants_select on public.chat_thread_participants;
create policy chat_participants_select on public.chat_thread_participants
  for select using (
    -- Participants can see the participant list of their own threads.
    public.is_thread_participant(thread_id)
  );

drop policy if exists chat_thread_msgs_select on public.chat_thread_messages;
create policy chat_thread_msgs_select on public.chat_thread_messages
  for select using ( public.is_thread_participant(thread_id) and deleted_at is null );

drop policy if exists chat_thread_msgs_insert on public.chat_thread_messages;
create policy chat_thread_msgs_insert on public.chat_thread_messages
  for insert with check (
    public.is_thread_participant(thread_id) and user_id = auth.uid()
  );

drop policy if exists chat_thread_msgs_update on public.chat_thread_messages;
create policy chat_thread_msgs_update on public.chat_thread_messages
  for update using ( user_id = auth.uid() and public.is_thread_participant(thread_id) );

-- Realtime: add the three tables to supabase_realtime publication so the
-- client can subscribe to live inserts.
do $pub$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime'
                   and schemaname='public' and tablename='chat_thread_messages') then
    execute 'alter publication supabase_realtime add table public.chat_thread_messages';
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime'
                   and schemaname='public' and tablename='chat_threads') then
    execute 'alter publication supabase_realtime add table public.chat_threads';
  end if;
exception when undefined_object then null;
end $pub$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- start_or_get_direct_thread — idempotent. Looks for an existing 'direct'
-- thread on this baby that has EXACTLY the two participants {auth.uid(),
-- p_other_user}. If found, returns its id. Otherwise creates a new thread
-- and inserts both participants.
create or replace function public.start_or_get_direct_thread(p_baby uuid, p_other_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_thread uuid;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_other_user is null or p_other_user = v_me then
    raise exception 'invalid_other_user';
  end if;
  -- Both participants must have access to this baby (RLS-equivalent guard
  -- — has_baby_access checks the caller; we also check the other user
  -- explicitly via baby_users membership).
  if not public.has_baby_access(p_baby) then raise exception 'forbidden'; end if;
  if not exists (
    select 1 from public.baby_users
     where baby_id = p_baby and user_id = p_other_user
  ) then
    raise exception 'other_user_not_a_caregiver';
  end if;

  -- Look for an existing direct thread between these two on this baby.
  select t.id into v_thread
    from public.chat_threads t
   where t.baby_id = p_baby and t.kind = 'direct'
     and exists (select 1 from public.chat_thread_participants p
                  where p.thread_id = t.id and p.user_id = v_me)
     and exists (select 1 from public.chat_thread_participants p
                  where p.thread_id = t.id and p.user_id = p_other_user)
     and (select count(*) from public.chat_thread_participants p
            where p.thread_id = t.id) = 2
   limit 1;
  if v_thread is not null then return v_thread; end if;

  -- Otherwise create one + add both participants.
  insert into public.chat_threads(baby_id, kind, created_by)
       values (p_baby, 'direct', v_me)
       returning id into v_thread;
  insert into public.chat_thread_participants(thread_id, user_id)
       values (v_thread, v_me), (v_thread, p_other_user);
  return v_thread;
end;
$$;
grant execute on function public.start_or_get_direct_thread(uuid, uuid) to authenticated;

-- send_thread_message — posts to a thread the caller participates in,
-- bumps last_message_at so the thread surfaces at the top of the list.
create or replace function public.send_thread_message(p_thread uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_thread_participant(p_thread) then raise exception 'forbidden'; end if;
  if p_body is null or length(trim(p_body)) = 0 then raise exception 'empty_body'; end if;
  if length(p_body) > 4000 then raise exception 'body_too_long'; end if;
  insert into public.chat_thread_messages(thread_id, user_id, body)
       values (p_thread, auth.uid(), p_body)
       returning id into v_id;
  update public.chat_threads set last_message_at = now() where id = p_thread;
  return v_id;
end;
$$;
grant execute on function public.send_thread_message(uuid, text) to authenticated;

-- soft_delete_thread_message — author OR baby parent.
create or replace function public.soft_delete_thread_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_msg record; v_baby uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select m.*, t.baby_id into v_msg
    from public.chat_thread_messages m
    join public.chat_threads t on t.id = m.thread_id
   where m.id = p_message_id;
  if not found then raise exception 'not_found'; end if;
  if v_msg.user_id <> auth.uid() and not public.is_baby_parent(v_msg.baby_id) then
    raise exception 'forbidden';
  end if;
  update public.chat_thread_messages set deleted_at = now() where id = p_message_id;
end;
$$;
grant execute on function public.soft_delete_thread_message(uuid) to authenticated;

-- mark_thread_read — bumps caller's last_read_at on a thread to now().
-- Used to drive unread-message counts in the thread list.
create or replace function public.mark_thread_read(p_thread uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.chat_thread_participants
     set last_read_at = now()
   where thread_id = p_thread and user_id = auth.uid();
end;
$$;
grant execute on function public.mark_thread_read(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Private 1:1 chat between caregivers$t1$,
  p_body     => $b1$Each caregiver row in the Caregivers page now has a "Message" button. Click it to open a private 1:1 chat with that person, separate from the group chat. Useful for parent ↔ doctor conversations no one else needs to see. Foundation for the upcoming verified doctor consultation feature.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$دردشة خاصة بين مقدمي الرعاية$ta1$,
  p_body_ar  => $ba1$في صفحة مقدمي الرعاية، صار لكل صف زر "مراسلة" يفتح دردشة خاصة بينك وبين الشخص فقط، منفصلة عن الدردشة الجماعية. مفيدة للحديث بين الوالدين والطبيب بدون أن يرى الباقون. الأساس لميزة الاستشارة الطبية المعتمدة القادمة.$ba1$
);

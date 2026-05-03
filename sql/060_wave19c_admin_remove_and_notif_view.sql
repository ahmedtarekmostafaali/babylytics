-- 060: Wave 19c — admin remove + mark-thread-read helper
-- ============================================================================
-- Two small additions that close the Wave 19b gaps:
--
-- 1. admin_soft_delete_forum_thread / admin_soft_delete_forum_reply —
--    SECURITY DEFINER RPCs gated on is_platform_admin(). Lets the
--    moderation queue's "Remove" action actually take the post down,
--    bypassing the author-only RLS policy on forum_threads/replies.
--
-- 2. mark_thread_replies_read — convenience RPC that flips every unread
--    user_notification of kind 'forum_reply' for the caller targeting the
--    given thread to read_at = now(). Called from the thread detail page
--    on view so the count clears as soon as the user actually opens the
--    discussion.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. admin_soft_delete_forum_thread / _reply
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_soft_delete_forum_thread(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  update public.forum_threads set deleted_at = now() where id = p_id;
end;
$$;
grant execute on function public.admin_soft_delete_forum_thread(uuid) to authenticated;

create or replace function public.admin_soft_delete_forum_reply(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_thread uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden'; end if;
  update public.forum_replies set deleted_at = now()
   where id = p_id returning thread_id into v_thread;
  if v_thread is not null then
    update public.forum_threads
       set reply_count = greatest(0, reply_count - 1)
     where id = v_thread;
  end if;
end;
$$;
grant execute on function public.admin_soft_delete_forum_reply(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. mark_thread_replies_read — clear forum_reply notifications for one thread
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_thread_replies_read(p_thread_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int;
begin
  if auth.uid() is null then return 0; end if;
  with up as (
    update public.user_notifications
       set read_at = now()
     where user_id = auth.uid()
       and kind = 'forum_reply'
       and read_at is null
       and (payload->>'thread_id')::uuid = p_thread_id
     returning 1
  )
  select count(*)::int into v_n from up;
  return coalesce(v_n, 0);
end;
$$;
grant execute on function public.mark_thread_replies_read(uuid) to authenticated;

commit;

-- 071: Wave 30 — forum subscriptions (follow a thread to get reply pings)
-- ============================================================================
-- Wave 19b's notify_forum_reply trigger pings the thread author + every
-- prior replier. That works for the natural case but means lurkers who
-- read but don't reply have no way to follow a thread, AND prior
-- repliers can't unsubscribe without unposting their reply.
--
-- This wave introduces explicit subscriptions:
--
--   1. forum_subscriptions table — one row per (thread, user). Unique
--      enforced. RLS lets each user manage their own.
--
--   2. Auto-subscribe rules preserve the existing behavior:
--        - When you post a thread → auto-subscribed.
--        - When you post a reply → auto-subscribed (if not already).
--      This means existing pre-Wave-30 OPs + repliers don't need to
--      explicitly follow anything to keep getting pinged. New behavior
--      only matters for lurkers who want pings, or repliers who want
--      out.
--
--   3. notify_forum_reply trigger rewritten to read forum_subscriptions
--      as the source of truth (instead of joining forum_threads.author_id
--      + forum_replies.author_id). The new author's subscription is
--      filtered out so they don't ping themselves.
--
--   4. toggle_forum_subscription(p_thread_id) RPC — atomic flip,
--      returns true when now subscribed, false when now unsubscribed.
--
--   5. forum_thread_with_meta view grows an i_subscribe boolean column
--      so the thread page can render the right "Follow" / "Following"
--      state without a separate fetch.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. forum_subscriptions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_subscriptions (
  thread_id  uuid not null references public.forum_threads(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists idx_forum_subscriptions_user
  on public.forum_subscriptions (user_id, created_at desc);

alter table public.forum_subscriptions enable row level security;

drop policy if exists forum_subs_select on public.forum_subscriptions;
create policy forum_subs_select on public.forum_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists forum_subs_insert on public.forum_subscriptions;
create policy forum_subs_insert on public.forum_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists forum_subs_delete on public.forum_subscriptions;
create policy forum_subs_delete on public.forum_subscriptions
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill subscriptions for existing threads + replies so users
--    who already participated keep getting pings under the new model.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.forum_subscriptions (thread_id, user_id, created_at)
  select t.id, t.author_id, t.created_at
    from public.forum_threads t
    where t.author_id is not null
  on conflict do nothing;

insert into public.forum_subscriptions (thread_id, user_id, created_at)
  select distinct r.thread_id, r.author_id, min(r.created_at)
    from public.forum_replies r
    where r.author_id is not null and r.deleted_at is null
    group by r.thread_id, r.author_id
  on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-subscribe triggers — thread author + reply author.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.auto_subscribe_thread_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is not null then
    insert into public.forum_subscriptions (thread_id, user_id)
    values (new.id, new.author_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_subscribe_thread_author on public.forum_threads;
create trigger trg_auto_subscribe_thread_author
  after insert on public.forum_threads
  for each row execute function public.auto_subscribe_thread_author();

create or replace function public.auto_subscribe_reply_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is not null then
    insert into public.forum_subscriptions (thread_id, user_id)
    values (new.thread_id, new.author_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_subscribe_reply_author on public.forum_replies;
create trigger trg_auto_subscribe_reply_author
  after insert on public.forum_replies
  for each row execute function public.auto_subscribe_reply_author();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Rewrite notify_forum_reply to read forum_subscriptions.
--    Filter the new reply's author out so they don't ping themselves.
--    is_op is preserved so the banner can keep its "In your thread:"
--    label for OPs.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_forum_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread record;
begin
  select t.id, t.author_id, t.title
    into v_thread
    from public.forum_threads t where t.id = new.thread_id;
  if v_thread is null then return new; end if;

  insert into public.user_notifications (user_id, kind, payload)
  select s.user_id,
         'forum_reply',
         jsonb_build_object(
           'thread_id',    new.thread_id,
           'thread_title', v_thread.title,
           'reply_id',     new.id,
           'is_op',        (s.user_id = v_thread.author_id)
         )
    from public.forum_subscriptions s
   where s.thread_id = new.thread_id
     and s.user_id  <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid);

  return new;
end;
$$;

-- Trigger itself was created in 059, which still binds notify_forum_reply.
-- Re-attach defensively in case 059 was never applied on a fresh DB.
drop trigger if exists trg_notify_forum_reply on public.forum_replies;
create trigger trg_notify_forum_reply
  after insert on public.forum_replies
  for each row execute function public.notify_forum_reply();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. toggle_forum_subscription RPC
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.toggle_forum_subscription(
  p_thread_id uuid
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_existing boolean;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  -- Reject toggles on missing/deleted threads.
  perform 1 from public.forum_threads
    where id = p_thread_id and deleted_at is null;
  if not found then raise exception 'thread_not_found'; end if;

  select true into v_existing
    from public.forum_subscriptions
    where thread_id = p_thread_id and user_id = v_actor;

  if v_existing then
    delete from public.forum_subscriptions
      where thread_id = p_thread_id and user_id = v_actor;
    return false;
  else
    insert into public.forum_subscriptions (thread_id, user_id)
    values (p_thread_id, v_actor)
    on conflict do nothing;
    return true;
  end if;
end;
$$;
grant execute on function public.toggle_forum_subscription(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. forum_thread_with_meta view — add i_subscribe boolean.
--    Re-creates the Wave 24 view with one extra column. Keep all the
--    Wave 19/24 columns intact.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.forum_thread_with_meta as
  select
    t.id,
    t.category_id,
    t.author_id,
    t.anonymous,
    t.title,
    t.body,
    t.created_at,
    t.edited_at,
    t.last_reply_at,
    t.reply_count,
    case when t.anonymous
      then public.forum_anon_handle(t.author_id)
      else coalesce(p.display_name, split_part(p.email, '@', 1))
    end as author_display,
    coalesce(
      (select jsonb_object_agg(kind, k_count)
       from (
         select kind, count(*) as k_count
         from public.forum_reactions
         where target_type = 'thread' and target_id = t.id
         group by kind
       ) s
      ),
      '{}'::jsonb
    ) as reaction_counts,
    coalesce(
      (select array_agg(kind order by kind)
       from public.forum_reactions
       where target_type = 'thread' and target_id = t.id
         and created_by = auth.uid()
      ),
      '{}'::text[]
    ) as my_reactions,
    exists (
      select 1 from public.forum_subscriptions s
      where s.thread_id = t.id and s.user_id = auth.uid()
    ) as i_subscribe
  from public.forum_threads t
  left join public.profiles p on p.id = t.author_id
  where t.deleted_at is null;
grant select on public.forum_thread_with_meta to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Forum subscriptions: follow a thread without replying$t1$,
  p_body     => $b1$You can now follow any thread to get pinged on new replies — even if you've never posted in it. The new "Follow" / "Following" button on each thread toggles your subscription. When you post a thread or reply you're auto-subscribed (so the existing notification flow doesn't change). The unsubscribe path that mattered before — "I replied once, please stop pinging me" — now works too: tap "Following" to mute. Backfill ran for every existing thread you've started or replied to, so nothing changes for past activity.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$اشتراكات المنتدى: تابعي موضوع بدون رد$ta1$,
  p_body_ar  => $ba1$يمكنك الآن متابعة أي موضوع لتصلك إشعارات الردود الجديدة — حتى لو لم تردي عليه. زر «متابعة» / «تتابعينه» على كل موضوع يُفعّل أو يُلغي الاشتراك. عند بدء موضوع أو الرد عليه، يتم اشتراكك تلقائياً (لذا الإشعارات القديمة لا تتغير). الجديد: إلغاء الاشتراك من المواضيع التي رددتِ عليها سابقاً وتريدين إيقاف الإشعارات منها — اضغطي «تتابعينه» للكتم. تم تطبيق الاشتراك على كل المواضيع التي شاركتِ فيها سابقاً.$ba1$
);

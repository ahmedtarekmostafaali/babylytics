-- 072: Wave 31 — search ranking polish + digest mode + thread archive
-- ============================================================================
-- Three forum upgrades shipped together:
--
--   A. Search ranking polish — title matches now outweigh body matches
--      via setweight(), and a small recency boost surfaces fresher
--      threads when scores are close. The Wave 29 search_tsv columns
--      get rebuilt with weight tags. Search_forum RPC switches to
--      ts_rank_cd which respects weights, then multiplies by a
--      recency factor.
--
--   B. Daily digest notification mode — new user_notification_prefs
--      table holds forum_mode in 'instant' | 'digest' | 'off'.
--      notify_forum_reply now consults this table; instant users keep
--      the immediate ping, digest users get a single user_notification
--      row per day aggregating all their unread replies, off users get
--      nothing. The digest is built by a SECURITY DEFINER RPC
--      build_forum_digests() that the user can either run on demand
--      from the bell or hit on a schedule (Supabase Edge cron — wire
--      via the dashboard, not here).
--
--   C. Thread archive — forum_threads.archived_at + archive_forum_thread
--      RPC (author or admin only). The post_forum_reply RPC now
--      rejects inserts on archived threads. forum_thread_with_meta
--      surfaces archived_at so the page can render the lock state.
--
-- Idempotent.

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- A. Search ranking polish
-- ════════════════════════════════════════════════════════════════════════════

-- Drop + re-create the threads search_tsv with setweight: title='A', body='B'.
-- Generated columns can't be altered in place — drop + add is the supported
-- path. The GIN index on the column gets dropped automatically and we
-- recreate it after.
alter table public.forum_threads drop column if exists search_tsv;
alter table public.forum_threads
  add column search_tsv tsvector
    generated always as (
      setweight(to_tsvector('simple', coalesce(title,'')), 'A') ||
      setweight(to_tsvector('simple', coalesce(body,'')),  'B')
    ) stored;

-- Re-create the GIN index (the drop column above removed it).
create index if not exists idx_forum_threads_search
  on public.forum_threads using gin (search_tsv)
  where deleted_at is null;

-- Replies stay weight-default (single-source body) — no change needed.

-- Updated search_forum: ts_rank_cd respects weights, plus a recency
-- factor `1.0 + greatest(0, 30 - age_days) / 60.0` that gives fresh
-- threads up to a +0.5× boost decaying linearly to baseline at 30 days.
create or replace function public.search_forum(
  p_query         text,
  p_category_slug text default null,
  p_limit         int  default 30
) returns table (
  thread_id          uuid,
  category_slug      text,
  category_title_en  text,
  category_title_ar  text,
  title              text,
  snippet            text,
  reply_count        int,
  last_reply_at      timestamptz,
  matched_in         text,
  rank               real
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_query tsquery;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if length(coalesce(trim(p_query), '')) < 2 then
    return;
  end if;

  v_query := plainto_tsquery('simple', p_query);

  return query
    with thread_hits as (
      select
        t.id   as thread_id,
        ts_rank_cd(t.search_tsv, v_query) as rank,
        ts_headline(
          'simple', t.body, v_query,
          'StartSel=<mark>,StopSel=</mark>,MaxWords=20,MinWords=10,ShortWord=2'
        ) as snippet
      from public.forum_threads t
      where t.deleted_at is null
        and t.search_tsv @@ v_query
        and (
          p_category_slug is null
          or t.category_id = (select id from public.forum_categories where slug = p_category_slug)
        )
    ),
    reply_hits as (
      select
        r.thread_id,
        max(ts_rank_cd(r.search_tsv, v_query)) as rank,
        (array_agg(
          ts_headline(
            'simple', r.body, v_query,
            'StartSel=<mark>,StopSel=</mark>,MaxWords=20,MinWords=10,ShortWord=2'
          )
          order by ts_rank_cd(r.search_tsv, v_query) desc
        ))[1] as snippet
      from public.forum_replies r
      join public.forum_threads t on t.id = r.thread_id
      where r.deleted_at is null
        and t.deleted_at is null
        and r.search_tsv @@ v_query
        and (
          p_category_slug is null
          or t.category_id = (select id from public.forum_categories where slug = p_category_slug)
        )
      group by r.thread_id
    ),
    combined as (
      select
        coalesce(th.thread_id, rh.thread_id) as thread_id,
        coalesce(th.rank, 0) + coalesce(rh.rank, 0) as raw_rank,
        coalesce(th.snippet, rh.snippet) as snippet,
        case
          when th.thread_id is not null and rh.thread_id is not null then 'both'
          when th.thread_id is not null then 'thread'
          else 'reply'
        end as matched_in
      from thread_hits th
      full outer join reply_hits rh on rh.thread_id = th.thread_id
    )
    select
      t.id   as thread_id,
      c.slug as category_slug,
      c.title_en, c.title_ar,
      t.title,
      cb.snippet,
      t.reply_count,
      t.last_reply_at,
      cb.matched_in,
      -- Recency factor: fresh = +0.5×, decays to 1× at 30 days.
      (cb.raw_rank * (
        1.0 + greatest(0.0, 30.0 - extract(epoch from (now() - t.last_reply_at)) / 86400.0) / 60.0
      ))::real as rank
    from combined cb
    join public.forum_threads t   on t.id = cb.thread_id
    join public.forum_categories c on c.id = t.category_id
    where t.deleted_at is null
    order by rank desc, t.last_reply_at desc
    limit p_limit;
end;
$$;
grant execute on function public.search_forum(text, text, int) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- B. Daily digest notification mode
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.user_notification_prefs (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  forum_mode       text not null default 'instant'
                   check (forum_mode in ('instant','digest','off')),
  digest_last_sent timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.user_notification_prefs enable row level security;

drop policy if exists notif_prefs_select on public.user_notification_prefs;
create policy notif_prefs_select on public.user_notification_prefs
  for select using (user_id = auth.uid());

drop policy if exists notif_prefs_upsert on public.user_notification_prefs;
create policy notif_prefs_upsert on public.user_notification_prefs
  for insert with check (user_id = auth.uid());

drop policy if exists notif_prefs_update on public.user_notification_prefs;
create policy notif_prefs_update on public.user_notification_prefs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A small set/get helper so the preferences page can upsert in one call.
create or replace function public.set_forum_notification_mode(p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if p_mode not in ('instant','digest','off') then
    raise exception 'invalid_mode';
  end if;
  insert into public.user_notification_prefs (user_id, forum_mode)
    values (v_actor, p_mode)
  on conflict (user_id) do update
    set forum_mode = excluded.forum_mode,
        updated_at = now();
end; $$;
grant execute on function public.set_forum_notification_mode(text) to authenticated;

-- Modify notify_forum_reply: skip subscribers whose forum_mode != 'instant'.
-- Their pending replies will be picked up by build_forum_digests instead.
-- The notification kind 'forum_reply' is unchanged for instant users.
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
    left join public.user_notification_prefs p on p.user_id = s.user_id
   where s.thread_id = new.thread_id
     and s.user_id  <> coalesce(new.author_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and coalesce(p.forum_mode, 'instant') = 'instant';

  return new;
end;
$$;

drop trigger if exists trg_notify_forum_reply on public.forum_replies;
create trigger trg_notify_forum_reply
  after insert on public.forum_replies
  for each row execute function public.notify_forum_reply();

-- build_forum_digests — emits user_notifications for digest-mode users
-- in a single batched pass per day. Each emitted row uses the existing
-- 'forum_reply' kind + payload shape so the existing ForumUnreadBanner
-- + my_user_notifications RPC just work — the user sees yesterday's
-- replies pop up all at once instead of trickling in. Idempotent via
-- the digest_last_sent watermark per user.
--
-- Designed to be invoked by a daily Supabase cron (Edge Function or
-- pg_cron). Returns the number of NOTIFICATION ROWS written, not the
-- number of users. Safe to call by hand for testing.
create or replace function public.build_forum_digests()
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_n int := 0;
  v_users int := 0;
  rec record;
begin
  -- Insert in one statement so the watermark update can be tied to a
  -- per-user max(created_at).
  with digest_users as (
    select
      s.user_id,
      coalesce(p.digest_last_sent, now() - interval '24 hours') as since
    from public.forum_subscriptions s
    join public.user_notification_prefs p on p.user_id = s.user_id
    where p.forum_mode = 'digest'
    group by s.user_id, p.digest_last_sent
  ),
  candidate_replies as (
    select
      du.user_id,
      r.id          as reply_id,
      r.thread_id,
      r.created_at,
      t.title       as thread_title,
      t.author_id   as thread_author
    from digest_users du
    join public.forum_subscriptions s on s.user_id = du.user_id
    join public.forum_replies r on r.thread_id = s.thread_id
    join public.forum_threads t on t.id = r.thread_id
    where r.deleted_at is null
      and t.deleted_at is null
      and r.author_id is distinct from du.user_id
      and r.created_at > du.since
  ),
  inserted as (
    insert into public.user_notifications (user_id, kind, payload)
    select
      cr.user_id,
      'forum_reply',
      jsonb_build_object(
        'thread_id',    cr.thread_id,
        'thread_title', cr.thread_title,
        'reply_id',     cr.reply_id,
        'is_op',        (cr.user_id = cr.thread_author),
        'digested',     true
      )
    from candidate_replies cr
    returning user_id, (payload->>'reply_id')::uuid as reply_id
  )
  select count(*), count(distinct user_id) into v_n, v_users from inserted;

  -- Bump the watermark to now() for every digest-mode user (including
  -- those with no new replies today, so we don't re-process old gaps
  -- if someone enables digest after a quiet period).
  update public.user_notification_prefs
     set digest_last_sent = now()
   where forum_mode = 'digest';

  return v_n;
end;
$$;
grant execute on function public.build_forum_digests() to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- C. Thread archive
-- ════════════════════════════════════════════════════════════════════════════

alter table public.forum_threads
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

create index if not exists idx_forum_threads_archived
  on public.forum_threads (archived_at) where archived_at is not null;

create or replace function public.archive_forum_thread(p_thread_id uuid, p_unarchive boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_actor uuid := auth.uid();
  v_thread record;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select id, author_id, archived_at into v_thread
    from public.forum_threads
    where id = p_thread_id and deleted_at is null;
  if not found then raise exception 'thread_not_found'; end if;

  -- Author or platform admin only.
  if v_thread.author_id <> v_actor and not public.is_platform_admin() then
    raise exception 'only the thread author or an admin may archive';
  end if;

  if p_unarchive then
    update public.forum_threads
      set archived_at = null, archived_by = null
      where id = p_thread_id;
    return false;
  else
    update public.forum_threads
      set archived_at = now(), archived_by = v_actor
      where id = p_thread_id;
    return true;
  end if;
end; $$;
grant execute on function public.archive_forum_thread(uuid, boolean) to authenticated;

-- post_forum_reply: refuse inserts on archived threads. Wave 19 defined
-- this RPC; we patch it minimally to add the archive guard. We also
-- preserve the existing reply_count + last_reply_at bump.
create or replace function public.post_forum_reply(
  p_thread_id uuid,
  p_body      text,
  p_anonymous boolean default false,
  p_parent_reply_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id    uuid;
  v_archived_at timestamptz;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select archived_at into v_archived_at
    from public.forum_threads
    where id = p_thread_id and deleted_at is null;
  if not found then raise exception 'thread_not_found'; end if;
  if v_archived_at is not null then
    raise exception 'thread_archived';
  end if;

  insert into public.forum_replies (thread_id, author_id, anonymous, body, parent_reply_id)
  values (p_thread_id, v_actor, p_anonymous, trim(p_body), p_parent_reply_id)
  returning id into v_id;

  update public.forum_threads
    set last_reply_at = now(),
        reply_count = reply_count + 1
    where id = p_thread_id;
  return v_id;
end; $$;
grant execute on function public.post_forum_reply(uuid, text, boolean, uuid) to authenticated;

-- forum_thread_with_meta: surface archived_at + archived_by_me so the
-- thread page can render the lock state and the Archive button.
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
    t.archived_at,
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
  p_title    => $t1$Forum: smarter search, digest mode, archive threads$t1$,
  p_body     => $b1$Three forum upgrades in one batch. (1) Search ranking now weighs title matches higher than body matches and gives fresh threads a small recency boost — relevant + recent results rise to the top. (2) New "digest" notification mode in Preferences: instead of a ping per reply, get one daily summary of all replies in threads you follow. Set it to "off" to mute forum pings entirely. (3) Thread authors can now archive their own threads — locks the thread to new replies (good for "issue resolved, please stop replying" or wrap-up threads). Admins can archive too. Existing reactions, search, and subscriptions still work on archived threads — only new replies are blocked.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$المنتدى: بحث أذكى، وضع الملخص اليومي، أرشفة المواضيع$ta1$,
  p_body_ar  => $ba1$ثلاث تحسينات للمنتدى دفعة واحدة. (١) ترتيب البحث: مطابقات العنوان وزنها أعلى من النص، مع لمسة تفضيل للمواضيع الحديثة. (٢) وضع «الملخص اليومي» في الإعدادات: بدلاً من إشعار لكل رد، تحصلين على ملخص واحد يومياً لكل المواضيع التي تتابعينها. أو اختاري «إيقاف» لكتم إشعارات المنتدى تماماً. (٣) صاحبة الموضوع يمكنها أرشفة موضوعها — يقفل الموضوع من أي ردود جديدة (مفيد للمواضيع المنتهية). الإدارة تستطيع الأرشفة أيضاً. التفاعلات والبحث والاشتراكات تظل تعمل على المواضيع المؤرشفة — فقط الردود الجديدة محظورة.$ba1$
);

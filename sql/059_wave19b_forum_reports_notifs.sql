-- 059: Wave 19b — forum reports + reply notifications
-- ============================================================================
-- Two production-safety additions that make Wave 19's forum healthier:
--
-- 1. forum_reports — anyone can flag a thread or reply; only platform
--    admins see the queue and resolve them. Soft-flag pattern: reports
--    don't auto-hide content, they just surface it for review.
--
-- 2. Reply notifications — when someone posts a reply, a notification
--    pings the thread author + every other distinct replier in the
--    thread. Uses the existing notifications table; new kind 'forum_reply'.
--    Notification payload carries enough context for the bell + the
--    /forum/[slug]/[threadId] link.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. forum_reports
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('thread','reply')),
  target_id    uuid not null,
  reported_by  uuid not null references auth.users(id) on delete cascade,
  reason       text not null check (reason in (
                  'spam','harassment','off_topic','medical_misinformation',
                  'self_harm','other'
                )),
  detail       text check (detail is null or length(detail) <= 1000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null,
  resolution   text check (resolution is null or resolution in
                  ('removed','warned','dismissed')),
  unique (target_type, target_id, reported_by)  -- one report per user per item
);
create index if not exists idx_forum_reports_open
  on public.forum_reports (created_at desc) where resolved_at is null;

alter table public.forum_reports enable row level security;

-- INSERT: any authenticated user can report. reported_by must = caller.
drop policy if exists forum_reports_insert on public.forum_reports;
create policy forum_reports_insert on public.forum_reports
  for insert with check (auth.uid() is not null and reported_by = auth.uid());

-- SELECT: only platform admins. Regular users never see the queue.
drop policy if exists forum_reports_select_admin on public.forum_reports;
create policy forum_reports_select_admin on public.forum_reports
  for select using (public.is_platform_admin());

-- UPDATE: only platform admins (resolve / dismiss).
drop policy if exists forum_reports_update_admin on public.forum_reports;
create policy forum_reports_update_admin on public.forum_reports
  for update using (public.is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Notifications: extend kind check + add a trigger on forum_replies.
-- ─────────────────────────────────────────────────────────────────────────────
-- The notifications table currently constrains kind via a check. Last
-- extended in sql/054 (added 'med_low_stock'); add 'forum_reply'.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add  constraint notifications_kind_check
  check (kind in (
    'medication_due','medication_missed','low_ocr_confidence',
    'file_ready','feeding_alert','stool_alert',
    'app_update','med_low_stock','forum_reply'
  ));

-- The notifications row needs a baby_id (FK NOT NULL). Forum replies
-- aren't baby-scoped; we tag them with a synthetic "forum" baby. We
-- handle this by NOT inserting a row at all for forum_reply notifications
-- — instead we use a separate table optimised for global / non-baby
-- pings. Cleaner than fighting the schema constraint.

create table if not exists public.user_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_user_notifications_user_unread
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists user_notif_select on public.user_notifications;
create policy user_notif_select on public.user_notifications
  for select using (user_id = auth.uid());

drop policy if exists user_notif_update on public.user_notifications;
create policy user_notif_update on public.user_notifications
  for update using (user_id = auth.uid());

-- Trigger: on forum_replies insert, fan out a notification to the thread
-- author + every other distinct replier (excluding the new reply's
-- author). Soft-delete and edit don't trigger.
create or replace function public.notify_forum_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_thread record;
  v_targets uuid[];
begin
  select t.id, t.author_id, t.title
    into v_thread
    from public.forum_threads t where t.id = new.thread_id;
  if v_thread is null then return new; end if;

  -- Build distinct list of users who might want a ping:
  --   - thread author
  --   - everyone else who has previously replied
  -- Minus the user who just replied (no self-pings).
  select array_agg(distinct uid) into v_targets
    from (
      select v_thread.author_id as uid
      union
      select author_id from public.forum_replies
       where thread_id = new.thread_id and deleted_at is null
    ) all_uids
   where uid is not null and uid <> new.author_id;

  if v_targets is null or array_length(v_targets, 1) = 0 then return new; end if;

  insert into public.user_notifications (user_id, kind, payload)
  select unnest(v_targets),
         'forum_reply',
         jsonb_build_object(
           'thread_id',   new.thread_id,
           'thread_title', v_thread.title,
           'reply_id',    new.id,
           'is_op',       (uid = v_thread.author_id)
         )
    from unnest(v_targets) as uid;

  return new;
end;
$$;

drop trigger if exists trg_notify_forum_reply on public.forum_replies;
create trigger trg_notify_forum_reply
  after insert on public.forum_replies
  for each row execute function public.notify_forum_reply();

-- Convenience RPCs for the user-facing bell / badge.
create or replace function public.my_user_notifications()
returns table (
  id          uuid,
  kind        text,
  payload     jsonb,
  read_at     timestamptz,
  created_at  timestamptz
)
language sql stable security definer set search_path = public
as $$
  select id, kind, payload, read_at, created_at
    from public.user_notifications
   where user_id = auth.uid()
   order by created_at desc
   limit 50;
$$;
grant execute on function public.my_user_notifications() to authenticated;

create or replace function public.mark_user_notification_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.user_notifications set read_at = now()
   where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;

create or replace function public.mark_all_user_notifications_read()
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with up as (
    update public.user_notifications set read_at = now()
     where user_id = auth.uid() and read_at is null
     returning 1
  )
  select count(*)::int into v_n from up;
  return coalesce(v_n, 0);
end;
$$;
grant execute on function public.mark_all_user_notifications_read() to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Forum: report button + reply notifications$t1$,
  p_body     => $b1$Two safety/engagement additions: (1) Report button on every thread and reply — flag spam, harassment, off-topic, medical misinformation, self-harm, or "other". Reports are reviewed by platform admins; nothing auto-hides. (2) When someone replies to a thread, the original poster and every other replier get a notification — so you come back when the conversation continues.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$المنتدى: زر إبلاغ + إشعارات الردود$ta1$,
  p_body_ar  => $ba1$إضافتان للسلامة والتفاعل: (١) زر إبلاغ على كل موضوع ورد — يمكن الإبلاغ عن سبام، تحرش، خروج عن الموضوع، معلومات طبية مضللة، إيذاء النفس، أو "آخر". الإبلاغات يراجعها مدراء المنصة، ولا شيء يختفي تلقائيًا. (٢) عند الرد على موضوع، يصل إشعار لصاحبة الموضوع ولكل من ردّ سابقًا — لتعودي حين تستمر المحادثة.$ba1$
);

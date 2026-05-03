-- 065: Wave 24 — forum reactions (heart / hug / me_too / thanks)
-- ============================================================================
-- Lightweight engagement signal under each thread + reply. Four kinds
-- (heart, hug, me_too, thanks) keep the surface area small and the UX
-- legible — no infinite emoji palette, no comment spam.
--
-- Design:
--
--   1. forum_reactions table — one row per (target, kind, user). Unique
--      constraint enforces a user can't double-tap the same kind.
--
--   2. RLS — SELECT open to all authenticated (counts are a public
--      engagement signal); INSERT/DELETE only own row.
--
--   3. toggle_forum_reaction(p_target_type, p_target_id, p_kind) RPC
--      that atomically toggles the caller's reaction for a given kind.
--      Returns the new total count for that kind on that target.
--
--   4. The forum_thread_with_meta + forum_reply_with_meta views grow
--      two extra columns:
--        - reaction_counts jsonb  → {"heart": 5, "hug": 2}
--        - my_reactions    text[] → kinds the caller has reacted with
--      Both compute via correlated subqueries against forum_reactions
--      so no separate fetch is needed in the page renderer.
--
--   5. Author of a thread/reply does NOT receive a notification when
--      someone reacts — reactions are intentionally low-friction. If
--      we ever want notifications it's a separate trigger.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. forum_reactions
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_reactions (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('thread','reply')),
  target_id    uuid not null,
  kind         text not null check (kind in ('heart','hug','me_too','thanks')),
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create unique index if not exists uq_forum_reactions_one_per_kind
  on public.forum_reactions (target_type, target_id, created_by, kind);

create index if not exists idx_forum_reactions_target
  on public.forum_reactions (target_type, target_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.forum_reactions enable row level security;

drop policy if exists forum_reactions_select on public.forum_reactions;
create policy forum_reactions_select on public.forum_reactions
  for select using (auth.uid() is not null);

drop policy if exists forum_reactions_insert on public.forum_reactions;
create policy forum_reactions_insert on public.forum_reactions
  for insert with check (created_by = auth.uid());

drop policy if exists forum_reactions_delete on public.forum_reactions;
create policy forum_reactions_delete on public.forum_reactions
  for delete using (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. toggle_forum_reaction RPC
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.toggle_forum_reaction(
  p_target_type text,
  p_target_id   uuid,
  p_kind        text
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_existing uuid;
  v_count int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if p_target_type not in ('thread','reply') then
    raise exception 'invalid target_type %', p_target_type;
  end if;
  if p_kind not in ('heart','hug','me_too','thanks') then
    raise exception 'invalid kind %', p_kind;
  end if;

  -- Verify the target actually exists (and isn't soft-deleted) — keeps
  -- the table clean if a reply was removed mid-tap. Not strictly needed
  -- for correctness but avoids orphan rows.
  if p_target_type = 'thread' then
    perform 1 from public.forum_threads where id = p_target_id and deleted_at is null;
  else
    perform 1 from public.forum_replies where id = p_target_id and deleted_at is null;
  end if;
  if not found then raise exception 'target_not_found'; end if;

  select id into v_existing
  from public.forum_reactions
  where target_type = p_target_type
    and target_id   = p_target_id
    and created_by  = v_actor
    and kind        = p_kind;

  if v_existing is not null then
    delete from public.forum_reactions where id = v_existing;
  else
    insert into public.forum_reactions(target_type, target_id, kind, created_by)
    values (p_target_type, p_target_id, p_kind, v_actor);
  end if;

  select count(*) into v_count
  from public.forum_reactions
  where target_type = p_target_type
    and target_id   = p_target_id
    and kind        = p_kind;

  return v_count;
end;
$$;
grant execute on function public.toggle_forum_reaction(text, uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Extend the meta views with reaction_counts + my_reactions
-- ─────────────────────────────────────────────────────────────────────────────
-- jsonb_object_agg(kind, count) builds {"heart": 5, "hug": 2}; if no
-- rows match it returns null, so we coalesce to an empty object so the
-- frontend can always read .heart / .hug without null guards.
-- my_reactions is the array of kinds the *caller* has reacted with.
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
    ) as my_reactions
  from public.forum_threads t
  left join public.profiles p on p.id = t.author_id
  where t.deleted_at is null;
grant select on public.forum_thread_with_meta to authenticated;

create or replace view public.forum_reply_with_meta as
  select
    r.id,
    r.thread_id,
    r.author_id,
    r.anonymous,
    r.body,
    r.created_at,
    r.edited_at,
    r.parent_reply_id,
    case when r.anonymous
      then public.forum_anon_handle(r.author_id)
      else coalesce(p.display_name, split_part(p.email, '@', 1))
    end as author_display,
    coalesce(
      (select jsonb_object_agg(kind, k_count)
       from (
         select kind, count(*) as k_count
         from public.forum_reactions
         where target_type = 'reply' and target_id = r.id
         group by kind
       ) s
      ),
      '{}'::jsonb
    ) as reaction_counts,
    coalesce(
      (select array_agg(kind order by kind)
       from public.forum_reactions
       where target_type = 'reply' and target_id = r.id
         and created_by = auth.uid()
      ),
      '{}'::text[]
    ) as my_reactions
  from public.forum_replies r
  left join public.profiles p on p.id = r.author_id
  where r.deleted_at is null;
grant select on public.forum_reply_with_meta to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Forum reactions: ❤️ 🤗 ✋ 🙏$t1$,
  p_body     => $b1$Threads and replies now have a row of reaction chips: heart, hug, "me too", and thanks. One tap to react, tap again to remove. Counts show next to each chip so you can see what resonated. Reactions stay quiet — the author is not pinged when you react. Use them to say "I see you" without writing a full reply.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$تفاعلات المنتدى: ❤️ 🤗 ✋ 🙏$ta1$,
  p_body_ar  => $ba1$المواضيع والردود الآن فيها صف من أزرار التفاعل: قلب، حضن، «أنا كمان»، شكراً. ضغطة لتتفاعلي، ضغطة أخرى لإلغاء التفاعل. الأرقام بجانب كل زر تُظهر ما لاقى صدى. التفاعلات هادئة — صاحبة الموضوع لا تتلقى إشعاراً. استعمليها لتقولي «أراكِ» بدون كتابة رد كامل.$ba1$
);

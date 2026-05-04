-- 070: Wave 29 — forum search (threads + replies, optional category scope)
-- ============================================================================
-- Postgres full-text search via tsvector + GIN. Uses the 'simple' text
-- search config so it works for both English and Arabic without
-- needing language-specific dictionaries — matches are token-level
-- (whitespace + punctuation split) which is good enough for a small
-- support forum and avoids stemming-mismatch headaches between EN/AR.
--
-- Components:
--
--   1. forum_threads.search_tsv   — generated column (title + body)
--   2. forum_replies.search_tsv   — generated column (body)
--   3. GIN indexes on both
--   4. search_forum(p_query, p_category_slug, p_limit) RPC that searches
--      both tables in one call and returns threads (with category slug
--      so the UI can deep-link). Each result includes:
--        - thread metadata
--        - rank score (combined from any title/body/reply matches)
--        - snippet (first matching reply or thread body slice)
--
-- Soft-deleted threads/replies are excluded.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. tsvector generated columns
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.forum_threads
  add column if not exists search_tsv tsvector
    generated always as (
      to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))
    ) stored;

alter table public.forum_replies
  add column if not exists search_tsv tsvector
    generated always as (
      to_tsvector('simple', coalesce(body,''))
    ) stored;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. GIN indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_forum_threads_search
  on public.forum_threads using gin (search_tsv)
  where deleted_at is null;

create index if not exists idx_forum_replies_search
  on public.forum_replies using gin (search_tsv)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. search_forum RPC
--
--   p_query — user query (raw text, plainto_tsquery handles parsing
--             so users can just type "iron supplement" and we tokenize)
--   p_category_slug — optional, narrows to one category
--   p_limit — top-N (default 30)
--
-- Strategy: search threads + replies separately, union, then aggregate
-- per thread so each thread appears once with its best rank + snippet.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.search_forum(
  p_query         text,
  p_category_slug text default null,
  p_limit         int  default 30
) returns table (
  thread_id       uuid,
  category_slug   text,
  category_title_en text,
  category_title_ar text,
  title           text,
  snippet         text,
  reply_count     int,
  last_reply_at   timestamptz,
  matched_in      text,    -- 'thread' | 'reply' | 'both'
  rank            real
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_query tsquery;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if length(coalesce(trim(p_query), '')) < 2 then
    -- Empty / single-char queries return nothing — keeps the GIN scan
    -- from degrading to a near-full table walk on broad terms.
    return;
  end if;

  v_query := plainto_tsquery('simple', p_query);

  return query
    with thread_hits as (
      select
        t.id           as thread_id,
        ts_rank(t.search_tsv, v_query) as rank,
        ts_headline(
          'simple',
          t.body,
          v_query,
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
        max(ts_rank(r.search_tsv, v_query)) as rank,
        -- pick the snippet from the highest-ranked matching reply
        (array_agg(
          ts_headline(
            'simple',
            r.body,
            v_query,
            'StartSel=<mark>,StopSel=</mark>,MaxWords=20,MinWords=10,ShortWord=2'
          )
          order by ts_rank(r.search_tsv, v_query) desc
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
        coalesce(th.rank, 0) + coalesce(rh.rank, 0) as rank,
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
      t.id                 as thread_id,
      c.slug               as category_slug,
      c.title_en           as category_title_en,
      c.title_ar           as category_title_ar,
      t.title              as title,
      cb.snippet           as snippet,
      t.reply_count        as reply_count,
      t.last_reply_at      as last_reply_at,
      cb.matched_in        as matched_in,
      cb.rank              as rank
    from combined cb
    join public.forum_threads t on t.id = cb.thread_id
    join public.forum_categories c on c.id = t.category_id
    where t.deleted_at is null
    order by cb.rank desc, t.last_reply_at desc
    limit p_limit;
end;
$$;
grant execute on function public.search_forum(text, text, int) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Forum search: find any thread or reply by keyword$t1$,
  p_body     => $b1$There's now a search bar at the top of the forum and inside each category. Type any keyword and you'll see matching threads ranked by relevance — the matched word is highlighted in the snippet preview, and the result tells you whether it matched in the thread itself, in a reply, or both. The search is scoped to the current category by default (so a search inside "TTC" doesn't pollute results from "Newborn"), and global from the forum index. Works for both English and Arabic queries.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$بحث المنتدى: ابحثي في المواضيع والردود بكلمة مفتاحية$ta1$,
  p_body_ar  => $ba1$شريط البحث الآن متاح أعلى المنتدى وداخل كل قسم. اكتبي أي كلمة مفتاحية وستظهر المواضيع المطابقة مرتبة حسب الصلة — الكلمة المطابقة مُظللة في معاينة المقتطف، والنتيجة تخبرك إن كانت المطابقة في الموضوع نفسه أو في رد أو في كليهما. البحث محدود بالقسم الحالي افتراضياً، وعام من صفحة المنتدى الرئيسية. يعمل بالعربي والإنجليزي.$ba1$
);

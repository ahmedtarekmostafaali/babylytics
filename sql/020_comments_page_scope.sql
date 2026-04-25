-- ============================================================================
-- Babylytics — migration 020
-- Each list page now has its own comment thread separate from the per-row
-- threads. Adds an optional `page_scope` text column to `comments`. When
-- null, behaves as today (per-row). When set (e.g. 'feedings_list',
-- 'prenatal_visits_list'), filters/tags comments to that specific page.
-- ============================================================================

alter table public.comments add column if not exists page_scope text;

create index if not exists idx_comments_page_scope
  on public.comments(baby_id, target_table, target_id, page_scope)
  where deleted_at is null;

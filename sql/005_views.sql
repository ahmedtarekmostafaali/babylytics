-- ============================================================================
-- Babylytics — Views
-- ============================================================================
-- These are convenience views for the dashboard. They are NOT materialized
-- for v1 (small scale: < 100 babies). When scale grows, convert the two
-- _daily views to materialized views with a refresh cron.
-- ============================================================================

-- Per-baby latest-measurement snapshot
create or replace view public.baby_latest_measurement as
select distinct on (baby_id)
  baby_id, measured_at, weight_kg, height_cm, head_circ_cm
from public.measurements
where deleted_at is null
order by baby_id, measured_at desc;

-- Feeding totals per day per baby
create or replace view public.feeding_daily as
select
  baby_id,
  (feeding_time at time zone 'UTC')::date as day,
  count(*) as feed_count,
  sum(quantity_ml) as total_ml,
  sum(kcal) as total_kcal
from public.feedings
where deleted_at is null
group by baby_id, (feeding_time at time zone 'UTC')::date;

-- Stool totals per day per baby
create or replace view public.stool_daily as
select
  baby_id,
  (stool_time at time zone 'UTC')::date as day,
  count(*) as stool_count,
  sum(quantity_ml) as total_ml,
  count(*) filter (where quantity_category = 'small') as small_count,
  count(*) filter (where quantity_category = 'medium') as medium_count,
  count(*) filter (where quantity_category = 'large') as large_count
from public.stool_logs
where deleted_at is null
group by baby_id, (stool_time at time zone 'UTC')::date;

-- Unread notifications per user (used by the header bell)
create or replace view public.my_unread_notifications as
select n.*
from public.notifications n
where (n.user_id = auth.uid() or n.user_id is null)
  and read_at is null;

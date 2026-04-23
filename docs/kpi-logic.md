# KPI logic

All dashboard KPIs are computed server-side via SQL RPCs. Client code never does the math.

## Feeding KPIs — `feeding_kpis(baby_id, start, end)`

| Metric                | Definition |
|-----------------------|-----------|
| `total_feed_ml`       | `SUM(quantity_ml)` over window |
| `avg_feed_ml`         | `total / count_where_quantity_not_null`, rounded to 0.1 ml |
| `feed_count`          | count of feedings in window |
| `recommended_feed_ml` | `round(current_weight_kg * feeding_factor_ml_per_kg_per_day, 1)` |
| `remaining_feed_ml`   | `max(recommended − total, 0)` |
| `feeding_percentage`  | `100 * total / recommended` (0 when recommended = 0) |

`current_weight_kg` = latest non-null `measurements.weight_kg` → fallback to `babies.birth_weight_kg`.

`feeding_factor_ml_per_kg_per_day` is stored per-baby (default 150) and editable on baby creation.

## Stool KPIs — `stool_kpis(baby_id, start, end)`

`stool_count`, `total_ml`, counts per `quantity_category` (`small / medium / large`), `last_stool_at`.

## Medication KPIs — `medication_kpis(baby_id, start, end)`

`total_doses` is **expected doses in the window**, computed by integrating each active prescription:

```
slots_per_rx = floor(
  epoch(least(ends_at, window_end) − greatest(starts_at, window_start))
  / (frequency_hours * 3600)
)
total_doses  = Σ slots_per_rx  (over active medications in window)
taken        = count(medication_logs WHERE status='taken')
missed       = count(medication_logs WHERE status='missed')
remaining    = max(total_doses − taken − missed, 0)
adherence_%  = 100 * taken / total_doses   (100 if no doses expected)
```

## Growth KPIs

- Current weight via `current_weight_kg(baby_id)`.
- Full series via `weight_trend(baby_id, days)` — weight + height + head circumference in chronological order.

## Time-series helpers

- `daily_feeding_series(baby_id, days)` — one row per day: `(day, total_ml, recommended_ml)`.
- `daily_stool_series(baby_id, days)` — one row per day: `(day, stool_count, total_ml)`.

Both fill missing days with zero via `generate_series`. Safe for the dashboard chart to just pass through.

## Window semantics

All windows are half-open `[start, end)` on `TIMESTAMPTZ`. The defaults in each RPC are "today in server time":

```sql
p_start default date_trunc('day', now())
p_end   default date_trunc('day', now()) + interval '1 day'
```

Client code should pass explicit windows when using a user's local timezone (see `lib/dates.ts → todayWindow()`).

## Why not materialized views?

At the target scale (< 100 babies, < 500 users) the per-request cost of these aggregations is tiny — Postgres returns in single-digit milliseconds. If a baby ever accumulates > ~100k feedings, switch `feeding_daily` and `stool_daily` to MV with a 5-minute refresh.

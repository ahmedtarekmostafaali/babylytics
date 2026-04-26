// Feed-pace KPI helpers. The "average so far" comparison answers:
// > By the same time-of-day, has my baby been fed more or less today
// > than over the past 7 days on average?
//
// All math runs in Africa/Cairo time so day boundaries match the rest of the
// dashboard. Timezone is hard-coded for now — when the user-prefs timezone
// formatter rolls out, accept a tz param and thread it through.

const TIMEZONE = 'Africa/Cairo';

type FeedRow = { feeding_time: string; quantity_ml: number | string | null };

/** Components of an ISO datetime in the configured timezone. */
function partsIn(iso: string): { y: number; m: number; day: number; h: number; min: number } {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return {
    y: Number(p.year), m: Number(p.month), day: Number(p.day),
    h: Number(p.hour === '24' ? '0' : p.hour), min: Number(p.minute),
  };
}

function dayKey(iso: string): string {
  const p = partsIn(iso);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function minutesIntoDay(iso: string): number {
  const p = partsIn(iso);
  return p.h * 60 + p.min;
}

export type FeedPaceComparison = {
  today_ml:        number;   // sum of today's feeds (all of today, not "so far")
  today_so_far_ml: number;   // sum of today's feeds before the cutoff time
  avg_so_far_ml:   number;   // average across past N days of feeds before the same time-of-day
  delta_ml:        number;   // today_so_far_ml - avg_so_far_ml
  delta_pct:       number | null;  // % vs the average; null when baseline is 0
  baseline_days:   number;   // how many of the past N days had any feed data
  cutoff_label:    string;   // e.g. "by 7:42 PM"
};

/**
 * Given a set of feed rows from the past `windowDays` days (NOT including
 * today), compare today's "so-far" accumulation to the same-time-of-day
 * accumulation averaged across that window.
 *
 * @param todayFeeds  All of today's feeds (Cairo-day rows from the dashboard).
 * @param historyFeeds Feeds from the past `windowDays` days (not today).
 * @param now         Reference timestamp — usually `new Date()`.
 * @param windowDays  Default 7.
 */
export function compareTodayVsRollingAvg(
  todayFeeds: FeedRow[],
  historyFeeds: FeedRow[],
  now: Date = new Date(),
  windowDays = 7,
): FeedPaceComparison {
  const cutoff = minutesIntoDay(now.toISOString());

  const today_ml = todayFeeds.reduce((acc, r) => acc + Number(r.quantity_ml || 0), 0);
  const today_so_far_ml = todayFeeds
    .filter(r => minutesIntoDay(r.feeding_time) <= cutoff)
    .reduce((acc, r) => acc + Number(r.quantity_ml || 0), 0);

  // Bucket historical feeds by Cairo-day → cumulative ml up to cutoff.
  const dayBuckets = new Map<string, number>();
  for (const r of historyFeeds) {
    const m = minutesIntoDay(r.feeding_time);
    if (m > cutoff) continue;
    const k = dayKey(r.feeding_time);
    dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + Number(r.quantity_ml || 0));
  }

  const sums = Array.from(dayBuckets.values()).slice(-windowDays);
  const baselineDays = sums.length;
  const avg_so_far_ml = baselineDays > 0
    ? sums.reduce((a, b) => a + b, 0) / baselineDays
    : 0;

  const delta_ml = today_so_far_ml - avg_so_far_ml;
  const delta_pct = avg_so_far_ml > 0 ? (delta_ml / avg_so_far_ml) * 100 : null;

  // Render cutoff in the user's locale (12h with AM/PM is what matches the
  // rest of the dashboard while we're still on the legacy formatter).
  const cutoffLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(now);

  return {
    today_ml: Math.round(today_ml),
    today_so_far_ml: Math.round(today_so_far_ml),
    avg_so_far_ml: Math.round(avg_so_far_ml),
    delta_ml: Math.round(delta_ml),
    delta_pct,
    baseline_days: baselineDays,
    cutoff_label: `by ${cutoffLabel}`,
  };
}

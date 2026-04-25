import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Timezone used across all formatters. Pick once and stick with it — all users
 * of this app today are in Egypt. If that ever changes, pull this from the
 * profile/baby settings instead.
 */
export const TIMEZONE = 'Africa/Cairo';

/**
 * Internal: produces a formatted string with the fixed timezone regardless of
 * whether we're on the server (UTC) or in a browser in another zone.
 */
function fmt(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, ...opts }).format(d);
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  // Output: "Apr 24, 2026 · 2:30 PM" in Cairo time
  const date = fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = fmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

export function fmtDate(iso: string | null | undefined) {
  return fmt(iso, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtTime(iso: string | null | undefined) {
  return fmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  // addSuffix picks "in 2 hours" vs "2 hours ago" automatically based on whether
  // the given date is in the future or the past.
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** Components of a date in the configured timezone, regardless of caller's TZ. */
function partsIn(tz: string, d: Date): { y: number; m: number; day: number; h: number; min: number } {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
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

/** Convert a "YYYY-MM-DDTHH:mm" wall-clock value (assumed to be in TIMEZONE)
 *  into a correct UTC ISO string. */
function wallClockToUtcIso(y: number, m: number, day: number, h: number, min: number): string {
  // We need to find the UTC timestamp that, when shown in TIMEZONE, displays
  // exactly (y, m, day, h, min). Do it by iterative correction: build a naive
  // UTC date from the parts, then compute what TIMEZONE would show for it and
  // subtract the difference. One round is enough in practice.
  const naive = Date.UTC(y, m - 1, day, h, min, 0, 0);
  const tzParts = partsIn(TIMEZONE, new Date(naive));
  const tzNaive = Date.UTC(tzParts.y, tzParts.m - 1, tzParts.day, tzParts.h, tzParts.min, 0, 0);
  const offset = tzNaive - naive;
  return new Date(naive - offset).toISOString();
}

/** Return "now" expressed as TIMEZONE-local parts. */
function nowInTz() {
  return partsIn(TIMEZONE, new Date());
}

/** Rolling windows — these are zone-agnostic (just a number of hours/days from now). */
export function todayWindow() {
  // 00:00 → 24:00 of "today" in the configured timezone
  const n = nowInTz();
  const startIso = wallClockToUtcIso(n.y, n.m, n.day, 0, 0);
  const endIso   = wallClockToUtcIso(n.y, n.m, n.day + 1, 0, 0);
  return { start: startIso, end: endIso };
}

/** Rolling 24-hour window ending now. */
export function last24hWindow() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Rolling N-day window ending now. */
export function lastNDaysWindow(n: number) {
  const end = new Date();
  const start = new Date(end.getTime() - n * 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type RangeKey = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface RangeResult {
  start: string;
  end:   string;
  label: string;
  key:   RangeKey;
  days:  number;
}

export function parseRangeParam(sp: { range?: string; start?: string; end?: string } | undefined): RangeResult {
  const s = sp ?? {};
  if (s.start && s.end) {
    const d = Math.max(1, Math.round((new Date(s.end).getTime() - new Date(s.start).getTime()) / (86400000)));
    return { start: s.start, end: s.end, label: 'Custom range', key: 'custom', days: d };
  }
  const end = new Date();
  const table: Record<Exclude<RangeKey, 'custom'>, { days: number; label: string }> = {
    '24h': { days: 1,  label: 'Last 24 hours' },
    '7d':  { days: 7,  label: 'Last 7 days'   },
    '30d': { days: 30, label: 'Last 30 days'  },
    '90d': { days: 90, label: 'Last 90 days'  },
  };
  const key = (s.range && s.range in table ? s.range : '24h') as Exclude<RangeKey, 'custom'>;
  const t = table[key];
  const start = new Date(end.getTime() - t.days * 86400000);
  return { start: start.toISOString(), end: end.toISOString(), label: t.label, key, days: t.days };
}

/** Start and next-day boundaries of a given calendar day in the configured TZ. */
export function dayWindow(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return {
    start: wallClockToUtcIso(y, m ?? 1, d ?? 1, 0, 0),
    end:   wallClockToUtcIso(y, m ?? 1, (d ?? 1) + 1, 0, 0),
  };
}

/** "YYYY-MM-DD" for today in the configured timezone (NOT server local). */
export function todayLocalDate(): string {
  const n = nowInTz();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.y}-${pad(n.m)}-${pad(n.day)}`;
}

/** "YYYY-MM-DD" for yesterday in the configured timezone. */
export function yesterdayLocalDate(): string {
  const today = todayLocalDate();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) - 1));
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * "YYYY-MM-DD" of the given ISO string in the configured timezone. Use this
 * for bucketing log entries by the day they happened, NOT
 * `iso.slice(0,10)` — that gives UTC and breaks for entries near midnight.
 */
export function localDayKey(iso: string): string {
  const p = partsIn(TIMEZONE, new Date(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.day)}`;
}

/**
 * Whole calendar days between dob and today, both expressed in the configured
 * timezone. Was previously `floor(ms / 86400000)`, which is a 24-hour window
 * count and therefore returned the wrong number when the baby was born late
 * in the day or when DST shifted by an hour.
 *
 * Now null-safe — returns 0 for null/empty dob (pregnancy-stage babies). Most
 * callers should also gate by `effectiveStage(...)` before reaching age math.
 */
export function ageInDays(dob: string | null | undefined): number {
  if (!dob) return 0;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return 0;
  const dobP = partsIn(TIMEZONE, parsed);
  const nowP = nowInTz();
  // Count days from dob's local-midnight to today's local-midnight.
  const dobMidnightUtc = Date.UTC(dobP.y, dobP.m - 1, dobP.day);
  const todayMidnightUtc = Date.UTC(nowP.y, nowP.m - 1, nowP.day);
  return Math.max(0, Math.round((todayMidnightUtc - dobMidnightUtc) / 86400000));
}

/** Convert a `<input type="datetime-local">` value (user typed it in TIMEZONE)
 *  to a correct UTC ISO. */
export function localInputToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  return wallClockToUtcIso(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]));
}

/** ISO → "YYYY-MM-DDTHH:mm" in TIMEZONE, for <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = partsIn(TIMEZONE, d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.day)}T${pad(p.h)}:${pad(p.min)}`;
}

/** "Now" in TIMEZONE, as `datetime-local`. */
export function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}

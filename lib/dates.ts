import { format, formatDistanceToNow, startOfDay, endOfDay } from 'date-fns';

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy · HH:mm');
}
export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy');
}
export function fmtRelative(iso: string | null | undefined) {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}
export function todayWindow() {
  const now = new Date();
  return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
}

/** Rolling 24-hour window ending now. Use this on Server Components where we
 *  can't know the user's local timezone reliably — sidesteps day-boundary
 *  problems by just looking at "the last day" rather than "today". */
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
  days:  number;  // useful for chart/series length
}

/** Parse URL searchParams into a canonical time window.
 *  Accepts: ?range=24h|7d|30d|90d  OR  ?start=ISO&end=ISO (takes precedence).
 *  Default: last 24 hours. */
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

/** Start of a given day and the next day (UTC). Used by the daily report page. */
export function dayWindow(isoDate: string) {
  // isoDate = 'YYYY-MM-DD' (interpret as local midnight → UTC)
  const [y, m, d] = isoDate.split('-').map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
  const end   = new Date(start.getTime() + 86400000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** "YYYY-MM-DD" for today in the user's local timezone. */
export function todayLocalDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function ageInDays(dob: string) {
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / 86400000);
}

/** Convert a <input type="datetime-local"> value into an ISO TIMESTAMPTZ
 *  the server can parse. Returns null if empty. */
export function localInputToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Inverse of the above — ISO → "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Return "now" as a datetime-local string suitable for <input type="datetime-local">. */
export function nowLocalInput(): string {
  return isoToLocalInput(new Date().toISOString());
}

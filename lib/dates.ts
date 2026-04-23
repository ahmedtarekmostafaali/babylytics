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

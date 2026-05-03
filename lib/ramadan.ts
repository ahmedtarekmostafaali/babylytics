// Ramadan helpers — pre-computed start/end dates so we can flag the
// holy month without an Islamic-calendar dependency, and detect "today"
// without server-side timezone gymnastics.
//
// Dates are calendar approximations published by major calendars (Saudi
// Arabia + Egypt agree most years). They may shift by a day in either
// direction depending on local moon-sighting. The UI uses these as a
// soft signal — never as a hard rule.
//
// Maintained through 2030; refresh annually or move to a server-side
// computation if longer horizon is needed.

export interface RamadanRange {
  start: string;  // YYYY-MM-DD (first day of Ramadan)
  end:   string;  // YYYY-MM-DD (last day of Ramadan, inclusive)
}

const RAMADAN_RANGES: RamadanRange[] = [
  { start: '2024-03-11', end: '2024-04-09' },
  { start: '2025-02-28', end: '2025-03-29' },
  { start: '2026-02-17', end: '2026-03-19' },
  { start: '2027-02-07', end: '2027-03-08' },
  { start: '2028-01-28', end: '2028-02-25' },
  { start: '2029-01-16', end: '2029-02-13' },
  { start: '2030-01-05', end: '2030-02-03' },
];

/** Today's date in the user's local timezone, formatted YYYY-MM-DD. */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns the active Ramadan range if today falls inside it, else null. */
export function activeRamadan(today = todayLocal()): RamadanRange | null {
  for (const r of RAMADAN_RANGES) {
    if (today >= r.start && today <= r.end) return r;
  }
  return null;
}

/** Day number in Ramadan (1-30) if active, else null. */
export function dayOfRamadan(today = todayLocal()): number | null {
  const r = activeRamadan(today);
  if (!r) return null;
  const start = new Date(r.start + 'T00:00:00Z');
  const now   = new Date(today + 'T00:00:00Z');
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1);
}

/** Days until Ramadan starts (or 0 if active, null if next range > 1y away). */
export function daysUntilRamadan(today = todayLocal()): number | null {
  for (const r of RAMADAN_RANGES) {
    if (today >= r.start && today <= r.end) return 0;
    if (today < r.start) {
      const diff = (new Date(r.start + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000;
      return Math.round(diff);
    }
  }
  return null;
}

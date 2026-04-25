// Lifecycle stage helpers for the Pregnancy → Newborn → Infant → ... evolution.
// See docs/lifecycle_extension_spec.md for the full design.

export type LifecycleStage = 'pregnancy' | 'newborn' | 'infant' | 'toddler' | 'child' | 'archived';

/**
 * Compute the effective stage from stored stage + dob. Mirrors the SQL
 * `effective_lifecycle_stage()` RPC so the UI can derive without an extra
 * round-trip when it already has the babies row.
 */
export function effectiveStage(stored: LifecycleStage | null | undefined, dob: string | null | undefined): LifecycleStage {
  if (stored === 'pregnancy') return 'pregnancy';
  if (stored === 'archived')  return 'archived';
  if (!dob) return 'pregnancy';

  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) return stored ?? 'infant';

  const diffDays = Math.floor((Date.now() - dobDate.getTime()) / 86400000);
  if (diffDays <= 28)   return 'newborn';
  if (diffDays <= 365)  return 'infant';
  if (diffDays <= 1095) return 'toddler';
  return 'child';
}

export function isPregnancy(stage: LifecycleStage): boolean {
  return stage === 'pregnancy';
}

/** Compute gestational age in {weeks, days} from EDD or LMP. */
export function gestationalAge(edd: string | null | undefined, lmp: string | null | undefined): { weeks: number; days: number; total_days: number } | null {
  let totalDays: number | null = null;

  if (lmp) {
    const lmpDate = new Date(lmp);
    if (!Number.isNaN(lmpDate.getTime())) {
      totalDays = Math.floor((Date.now() - lmpDate.getTime()) / 86400000);
    }
  }
  if (totalDays == null && edd) {
    const eddDate = new Date(edd);
    if (!Number.isNaN(eddDate.getTime())) {
      const distance = Math.floor((eddDate.getTime() - Date.now()) / 86400000);
      totalDays = 280 - distance;
    }
  }
  if (totalDays == null) return null;
  if (totalDays < 0) totalDays = 0;
  if (totalDays > 315) totalDays = 315; // cap at 45w to avoid silly numbers

  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    total_days: totalDays,
  };
}

/** "22w 4d" or "—" */
export function fmtGestationalAge(edd: string | null | undefined, lmp: string | null | undefined): string {
  const ga = gestationalAge(edd, lmp);
  if (!ga) return '—';
  return `${ga.weeks}w ${ga.days}d`;
}

/** Trimester from gestational age (in days). */
export function trimester(totalDays: number): 1 | 2 | 3 {
  if (totalDays <= 91)  return 1; // weeks 0–13
  if (totalDays <= 195) return 2; // weeks 14–27
  return 3;                       // weeks 28+
}

/** Compute EDD from LMP. Naegele's rule = LMP + 280 days. */
export function eddFromLmp(lmp: string): string {
  const d = new Date(lmp);
  d.setDate(d.getDate() + 280);
  return d.toISOString().slice(0, 10);
}

/** Days from now to the EDD. Negative = past due. Returns null if no EDD. */
export function eddDistanceDays(edd: string | null | undefined): number | null {
  if (!edd) return null;
  const e = new Date(edd);
  if (Number.isNaN(e.getTime())) return null;
  // Use date-only math in the Cairo TZ for consistency.
  const today = new Date();
  const utcMid = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utcMid(e) - utcMid(today)) / 86400000);
}

/** Pretty stage label for UI badges. */
export function prettyStage(stage: LifecycleStage): string {
  switch (stage) {
    case 'pregnancy': return 'Expecting';
    case 'newborn':   return 'Newborn';
    case 'infant':    return 'Infant';
    case 'toddler':   return 'Toddler';
    case 'child':     return 'Child';
    case 'archived':  return 'Archived';
  }
}

/** Color tint for the stage badge. */
export function stageTint(stage: LifecycleStage): 'coral' | 'mint' | 'brand' | 'peach' | 'lavender' | 'slate' {
  switch (stage) {
    case 'pregnancy': return 'lavender';
    case 'newborn':   return 'coral';
    case 'infant':    return 'brand';
    case 'toddler':   return 'mint';
    case 'child':     return 'peach';
    case 'archived':  return 'slate';
  }
}

/** Categorize BP per AHA/ACOG. */
export function bpCategory(sys: number | null | undefined, dia: number | null | undefined): 'normal' | 'elevated' | 'hypertensive' | null {
  if (sys == null || dia == null) return null;
  if (sys >= 140 || dia >= 90)    return 'hypertensive';
  if (sys >= 120 || dia >= 80)    return 'elevated';
  return 'normal';
}

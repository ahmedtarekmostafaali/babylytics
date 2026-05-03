// Per-baby area visibility helpers. An "area" maps roughly to a sidebar
// nav item. Caregivers can be restricted to a subset via baby_users.allowed_areas.
// User-level preference (per stage) is stored in user_preferences.enabled_features.

import type { LifecycleStage } from '@/lib/lifecycle';

/** All known area keys. Keep in sync with the AREA_GROUPS below + sidebar. */
export const ALL_AREAS = [
  // Cycle
  'planner',
  // Vital signs
  'feedings', 'stool', 'sleep', 'temperature', 'measurements',
  'vitals', 'blood_sugar', 'vomiting',
  // Care
  'medications', 'medication_stock', 'vaccinations', 'labs',
  'doctors', 'appointments',
  // Pregnancy-specific
  'prenatal_visits', 'ultrasounds', 'kicks', 'maternal_vitals', 'symptoms',
  // Development
  'activities', 'teething', 'speaking', 'screen_time',
  // Records
  'files', 'medical_profile', 'reports', 'shopping',
] as const;
export type Area = typeof ALL_AREAS[number];

/** Stage → which areas are even relevant. Used by the per-stage feature
 *  picker so we don't show baby-only options to a planning user. */
export const STAGE_AREAS: Record<'planning'|'pregnancy'|'baby', readonly Area[]> = {
  planning: [
    'planner', 'medications', 'medication_stock', 'labs', 'doctors',
    'appointments', 'files', 'medical_profile', 'shopping',
    'maternal_vitals', 'symptoms', 'vitals', 'blood_sugar',
  ],
  pregnancy: [
    'prenatal_visits', 'ultrasounds', 'kicks', 'maternal_vitals', 'symptoms',
    'medications', 'medication_stock', 'labs', 'doctors', 'appointments',
    'files', 'medical_profile', 'reports', 'shopping',
    'vitals', 'blood_sugar',
  ],
  baby: [
    'feedings', 'stool', 'sleep', 'temperature', 'measurements',
    'vomiting', 'vitals', 'blood_sugar',
    'medications', 'medication_stock', 'vaccinations', 'labs',
    'doctors', 'appointments',
    'activities', 'teething', 'speaking', 'screen_time',
    'files', 'medical_profile', 'reports', 'shopping',
  ],
};

/** Pretty labels for the picker UI. */
export const AREA_LABELS: Record<Area, string> = {
  planner:          'Cycle calendar',
  feedings:         'Feedings',
  stool:            'Stool / diapers',
  sleep:            'Sleep',
  temperature:      'Temperature',
  measurements:     'Growth (measurements)',
  vitals:           'BP & oxygen',
  blood_sugar:      'Blood sugar',
  vomiting:         'Vomiting',
  medications:      'Medications',
  medication_stock: 'Medication stock',
  vaccinations:     'Vaccinations',
  labs:             'Labs & scans',
  doctors:          'Doctors',
  appointments:     'Appointments',
  prenatal_visits:  'Prenatal visits',
  ultrasounds:      'Ultrasounds',
  kicks:            'Kick counter',
  maternal_vitals:  'Maternal vitals',
  symptoms:         'Symptoms',
  activities:       'Activities',
  teething:         'Teething',
  speaking:         'Speaking / words',
  screen_time:      'Screen time',
  files:            'Files / OCR',
  medical_profile:  'Medical profile',
  reports:          'Reports',
  shopping:         'Shopping list',
};

/** Compute the effective area-visibility set:
 *  - Caregiver allowed_areas (baby-level) — null = unrestricted
 *  - User enabled_features (user-level, per-stage) — null = unrestricted
 *  Result: intersection of both, or "all" if neither restricts.
 *  Returns null when the user can see everything.
 */
export function effectiveAreas(opts: {
  allowedAreas: string[] | null;
  enabledFeatures: string[] | null;
}): Set<Area> | null {
  const a = opts.allowedAreas;
  const f = opts.enabledFeatures;
  if (!a && !f) return null;
  const base = new Set<Area>(ALL_AREAS);
  if (a) for (const x of base) if (!a.includes(x)) base.delete(x);
  if (f) for (const x of base) if (!f.includes(x)) base.delete(x);
  return base;
}

/** Quick check used by sidebar + page guards. */
export function canSeeArea(visible: Set<Area> | null, area: Area): boolean {
  return visible == null || visible.has(area);
}

/** Map a lifecycle stage (storage value) to the planning|pregnancy|baby key
 *  used by STAGE_AREAS + user enabled_features. */
export function stageBucket(stage: LifecycleStage | null | undefined): 'planning'|'pregnancy'|'baby' {
  if (stage === 'planning')  return 'planning';
  if (stage === 'pregnancy') return 'pregnancy';
  return 'baby';
}

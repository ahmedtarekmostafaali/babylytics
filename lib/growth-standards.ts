// Static reference data for the dashboard's growth-insights strip.
// All medians are WHO Child Growth Standards (2006), 50th percentile.
// Minimums are WHO 3rd percentile (lower bound of the typical range).
// Source: WHO Multicentre Growth Reference Study, weight-for-age and
// length-for-age tables. We carry just the median + 3rd percentile so the
// comparison stays simple and deterministic — the parent always sees the
// central trend AND the lower healthy bound. Doctors who want the full
// curves can read the raw measurements out of the database.
//
// Data is intentionally LITE — no third-party data files, no AI calls. Every
// helper here runs in Cairo time so age math matches the rest of the app.

export type Sex = 'male' | 'female' | 'other' | 'unspecified';

type Row = { months: number; weight_kg: number; length_cm: number; head_cm: number };

// WHO median values, boys (kg / cm).
const BOYS: Row[] = [
  { months: 0,  weight_kg: 3.3,  length_cm: 49.9, head_cm: 34.5 },
  { months: 1,  weight_kg: 4.5,  length_cm: 54.7, head_cm: 37.3 },
  { months: 2,  weight_kg: 5.6,  length_cm: 58.4, head_cm: 39.1 },
  { months: 3,  weight_kg: 6.4,  length_cm: 61.4, head_cm: 40.5 },
  { months: 4,  weight_kg: 7.0,  length_cm: 63.9, head_cm: 41.6 },
  { months: 5,  weight_kg: 7.5,  length_cm: 65.9, head_cm: 42.6 },
  { months: 6,  weight_kg: 7.9,  length_cm: 67.6, head_cm: 43.3 },
  { months: 7,  weight_kg: 8.3,  length_cm: 69.2, head_cm: 44.0 },
  { months: 8,  weight_kg: 8.6,  length_cm: 70.6, head_cm: 44.5 },
  { months: 9,  weight_kg: 8.9,  length_cm: 72.0, head_cm: 45.0 },
  { months: 10, weight_kg: 9.2,  length_cm: 73.3, head_cm: 45.4 },
  { months: 11, weight_kg: 9.4,  length_cm: 74.5, head_cm: 45.8 },
  { months: 12, weight_kg: 9.6,  length_cm: 75.7, head_cm: 46.1 },
  { months: 15, weight_kg: 10.3, length_cm: 79.1, head_cm: 46.8 },
  { months: 18, weight_kg: 10.9, length_cm: 82.3, head_cm: 47.4 },
  { months: 21, weight_kg: 11.5, length_cm: 85.1, head_cm: 47.9 },
  { months: 24, weight_kg: 12.2, length_cm: 87.8, head_cm: 48.3 },
  { months: 36, weight_kg: 14.3, length_cm: 96.1, head_cm: 49.5 },
];

// WHO median values, girls (kg / cm).
const GIRLS: Row[] = [
  { months: 0,  weight_kg: 3.2,  length_cm: 49.1, head_cm: 33.9 },
  { months: 1,  weight_kg: 4.2,  length_cm: 53.7, head_cm: 36.5 },
  { months: 2,  weight_kg: 5.1,  length_cm: 57.1, head_cm: 38.3 },
  { months: 3,  weight_kg: 5.8,  length_cm: 59.8, head_cm: 39.5 },
  { months: 4,  weight_kg: 6.4,  length_cm: 62.1, head_cm: 40.6 },
  { months: 5,  weight_kg: 6.9,  length_cm: 64.0, head_cm: 41.5 },
  { months: 6,  weight_kg: 7.3,  length_cm: 65.7, head_cm: 42.2 },
  { months: 7,  weight_kg: 7.6,  length_cm: 67.3, head_cm: 42.8 },
  { months: 8,  weight_kg: 7.9,  length_cm: 68.7, head_cm: 43.4 },
  { months: 9,  weight_kg: 8.2,  length_cm: 70.1, head_cm: 43.8 },
  { months: 10, weight_kg: 8.5,  length_cm: 71.5, head_cm: 44.2 },
  { months: 11, weight_kg: 8.7,  length_cm: 72.8, head_cm: 44.6 },
  { months: 12, weight_kg: 8.9,  length_cm: 74.0, head_cm: 44.9 },
  { months: 15, weight_kg: 9.6,  length_cm: 77.5, head_cm: 45.7 },
  { months: 18, weight_kg: 10.2, length_cm: 80.7, head_cm: 46.2 },
  { months: 21, weight_kg: 10.9, length_cm: 83.7, head_cm: 46.7 },
  { months: 24, weight_kg: 11.5, length_cm: 86.4, head_cm: 47.2 },
  { months: 36, weight_kg: 13.9, length_cm: 95.1, head_cm: 48.5 },
];

// WHO 3rd percentile, boys — the lower bound of the typical range.
// Below these values the pediatrician usually flags for follow-up.
const BOYS_MIN: Row[] = [
  { months: 0,  weight_kg: 2.5,  length_cm: 46.3, head_cm: 32.1 },
  { months: 1,  weight_kg: 3.4,  length_cm: 51.1, head_cm: 34.9 },
  { months: 2,  weight_kg: 4.4,  length_cm: 54.7, head_cm: 36.8 },
  { months: 3,  weight_kg: 5.1,  length_cm: 57.6, head_cm: 38.1 },
  { months: 4,  weight_kg: 5.6,  length_cm: 60.0, head_cm: 39.2 },
  { months: 5,  weight_kg: 6.1,  length_cm: 61.9, head_cm: 40.1 },
  { months: 6,  weight_kg: 6.4,  length_cm: 63.6, head_cm: 40.9 },
  { months: 7,  weight_kg: 6.7,  length_cm: 65.1, head_cm: 41.5 },
  { months: 8,  weight_kg: 7.0,  length_cm: 66.5, head_cm: 42.0 },
  { months: 9,  weight_kg: 7.2,  length_cm: 67.7, head_cm: 42.5 },
  { months: 10, weight_kg: 7.5,  length_cm: 69.0, head_cm: 42.9 },
  { months: 11, weight_kg: 7.7,  length_cm: 70.2, head_cm: 43.2 },
  { months: 12, weight_kg: 7.8,  length_cm: 71.3, head_cm: 43.5 },
  { months: 15, weight_kg: 8.4,  length_cm: 74.5, head_cm: 44.2 },
  { months: 18, weight_kg: 8.9,  length_cm: 77.5, head_cm: 44.7 },
  { months: 21, weight_kg: 9.4,  length_cm: 80.1, head_cm: 45.2 },
  { months: 24, weight_kg: 9.9,  length_cm: 82.5, head_cm: 45.5 },
  { months: 36, weight_kg: 11.4, length_cm: 89.9, head_cm: 46.6 },
];

// WHO 3rd percentile, girls.
const GIRLS_MIN: Row[] = [
  { months: 0,  weight_kg: 2.4,  length_cm: 45.6, head_cm: 31.7 },
  { months: 1,  weight_kg: 3.2,  length_cm: 50.0, head_cm: 34.2 },
  { months: 2,  weight_kg: 4.0,  length_cm: 53.2, head_cm: 36.0 },
  { months: 3,  weight_kg: 4.6,  length_cm: 55.8, head_cm: 37.2 },
  { months: 4,  weight_kg: 5.1,  length_cm: 58.0, head_cm: 38.2 },
  { months: 5,  weight_kg: 5.5,  length_cm: 59.9, head_cm: 39.0 },
  { months: 6,  weight_kg: 5.8,  length_cm: 61.5, head_cm: 39.7 },
  { months: 7,  weight_kg: 6.1,  length_cm: 63.0, head_cm: 40.4 },
  { months: 8,  weight_kg: 6.3,  length_cm: 64.3, head_cm: 40.9 },
  { months: 9,  weight_kg: 6.6,  length_cm: 65.6, head_cm: 41.3 },
  { months: 10, weight_kg: 6.8,  length_cm: 66.8, head_cm: 41.7 },
  { months: 11, weight_kg: 7.0,  length_cm: 68.0, head_cm: 42.0 },
  { months: 12, weight_kg: 7.1,  length_cm: 69.2, head_cm: 42.3 },
  { months: 15, weight_kg: 7.7,  length_cm: 72.4, head_cm: 43.0 },
  { months: 18, weight_kg: 8.2,  length_cm: 75.4, head_cm: 43.5 },
  { months: 21, weight_kg: 8.7,  length_cm: 78.0, head_cm: 44.0 },
  { months: 24, weight_kg: 9.2,  length_cm: 80.5, head_cm: 44.3 },
  { months: 36, weight_kg: 11.0, length_cm: 88.5, head_cm: 45.4 },
];

function pickTable(sex: Sex): Row[] {
  if (sex === 'male')   return BOYS;
  if (sex === 'female') return GIRLS;
  // For 'other' / 'unspecified' (legacy rows), average the two so we never bias one way.
  return BOYS.map((b, i) => {
    const g = GIRLS[i]!;
    return {
      months: b.months,
      weight_kg: (b.weight_kg + g.weight_kg) / 2,
      length_cm: (b.length_cm + g.length_cm) / 2,
      head_cm:   (b.head_cm   + g.head_cm)   / 2,
    };
  });
}

function pickMinTable(sex: Sex): Row[] {
  if (sex === 'male')   return BOYS_MIN;
  if (sex === 'female') return GIRLS_MIN;
  return BOYS_MIN.map((b, i) => {
    const g = GIRLS_MIN[i]!;
    return {
      months: b.months,
      weight_kg: (b.weight_kg + g.weight_kg) / 2,
      length_cm: (b.length_cm + g.length_cm) / 2,
      head_cm:   (b.head_cm   + g.head_cm)   / 2,
    };
  });
}

/** Linear-interpolate a WHO value for a given age in months. */
function interpolate(table: Row[], months: number, key: 'weight_kg'|'length_cm'|'head_cm'): number | null {
  if (months < 0) return null;
  if (months <= table[0]!.months) return table[0]![key];
  if (months >= table[table.length - 1]!.months) return table[table.length - 1]![key];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1]!;
    const b = table[i]!;
    if (months >= a.months && months <= b.months) {
      const t = (months - a.months) / (b.months - a.months);
      return a[key] + t * (b[key] - a[key]);
    }
  }
  return null;
}

export type WhoExpectation = {
  weight_kg_median: number | null;
  length_cm_median: number | null;
  head_cm_median:   number | null;
};

export type WhoMinimum = {
  weight_kg_min: number | null;
  length_cm_min: number | null;
  head_cm_min:   number | null;
};

export function whoMedianFor(ageDays: number, sex: Sex): WhoExpectation {
  const months = ageDays / 30.4375;
  const table = pickTable(sex);
  return {
    weight_kg_median: interpolate(table, months, 'weight_kg'),
    length_cm_median: interpolate(table, months, 'length_cm'),
    head_cm_median:   interpolate(table, months, 'head_cm'),
  };
}

export function whoMinFor(ageDays: number, sex: Sex): WhoMinimum {
  const months = ageDays / 30.4375;
  const table = pickMinTable(sex);
  return {
    weight_kg_min: interpolate(table, months, 'weight_kg'),
    length_cm_min: interpolate(table, months, 'length_cm'),
    head_cm_min:   interpolate(table, months, 'head_cm'),
  };
}

// ---------------------------------------------------------------------------
// Growth spurts — the typical windows when feeding clusters and sleep
// regressions show up. Used to surface "spurt incoming" copy.
// ---------------------------------------------------------------------------

const SPURT_WINDOWS: { label: string; from_days: number; to_days: number; sub: string }[] = [
  { label: '7–10 days',  from_days: 6,   to_days: 12,   sub: 'first cluster — feed on demand'  },
  { label: '2–3 weeks',  from_days: 13,  to_days: 24,   sub: 'expect more frequent feeds'      },
  { label: '4–6 weeks',  from_days: 25,  to_days: 47,   sub: 'fussier evenings are normal'     },
  { label: '3 months',   from_days: 75,  to_days: 105,  sub: 'sleep regression possible'        },
  { label: '4 months',   from_days: 106, to_days: 135,  sub: 'sleep + feeds shift, rolls start' },
  { label: '6 months',   from_days: 165, to_days: 200,  sub: 'starting solids window'           },
  { label: '8–9 months', from_days: 230, to_days: 280,  sub: 'separation anxiety, crawling'     },
  { label: '12 months',  from_days: 350, to_days: 380,  sub: 'walking, weaning shift'           },
  { label: '18 months',  from_days: 530, to_days: 560,  sub: 'language burst, big-feels phase'  },
];

export type SpurtState = {
  state: 'in' | 'soon' | 'after' | 'far';
  label: string;
  sub: string;
  days_until?: number;
  days_since?: number;
};

/** Where is the baby relative to the closest known spurt window? */
export function spurtStateFor(ageDays: number): SpurtState {
  // First, find any window the baby is currently inside.
  for (const w of SPURT_WINDOWS) {
    if (ageDays >= w.from_days && ageDays <= w.to_days) {
      return { state: 'in', label: w.label, sub: w.sub };
    }
  }
  // Find the next upcoming window.
  const next = SPURT_WINDOWS.find(w => w.from_days > ageDays);
  if (next) {
    const daysUntil = next.from_days - ageDays;
    if (daysUntil <= 14) {
      return { state: 'soon', label: next.label, sub: next.sub, days_until: daysUntil };
    }
    // Look at the previous one to give context too.
    const prev = [...SPURT_WINDOWS].reverse().find(w => w.to_days < ageDays);
    if (prev) {
      return { state: 'after', label: next.label, sub: `next: ${next.sub}`, days_until: daysUntil, days_since: ageDays - prev.to_days };
    }
    return { state: 'far', label: next.label, sub: next.sub, days_until: daysUntil };
  }
  // Past the last known window.
  return { state: 'far', label: 'No more typical spurts on the chart', sub: 'Growth slows and stabilizes after toddlerhood.' };
}

// ---------------------------------------------------------------------------
// Milestones — the headline thing parents are watching for at this age.
// Buckets are intentionally wide; the copy is the "what's typical right now,
// what to look for next" line a pediatrician would offer at a check-up.
// ---------------------------------------------------------------------------

export type Milestone = {
  age_label: string;
  headline: string;
  watch_for: string;
};

const MILESTONES: { from_days: number; to_days: number; m: Milestone }[] = [
  { from_days: 0,   to_days: 30,  m: {
    age_label: '0–1 month',
    headline:  'Eye contact and reflexive grasp.',
    watch_for: 'Lifts head briefly during tummy time, startles to loud sounds.',
  } },
  { from_days: 31,  to_days: 60,  m: {
    age_label: '1–2 months',
    headline:  'Social smiles begin and cooing starts.',
    watch_for: 'Tracks faces side-to-side, holds head steady briefly when upright.',
  } },
  { from_days: 61,  to_days: 90,  m: {
    age_label: '2–3 months',
    headline:  'Strong head control during tummy time.',
    watch_for: 'Reaches for toys, brings hands to mouth, laughs out loud.',
  } },
  { from_days: 91,  to_days: 121, m: {
    age_label: '3–4 months',
    headline:  'First rolls (back to side) and rich babbling.',
    watch_for: 'Pushes up on forearms, watches your face carefully.',
  } },
  { from_days: 122, to_days: 152, m: {
    age_label: '4–5 months',
    headline:  'Sits with support, grabs and shakes toys.',
    watch_for: 'Rolls both ways, brings feet to mouth, blows raspberries.',
  } },
  { from_days: 153, to_days: 183, m: {
    age_label: '5–6 months',
    headline:  'Sits briefly unsupported, ready for first solids.',
    watch_for: 'Transfers objects between hands, mimics expressions.',
  } },
  { from_days: 184, to_days: 244, m: {
    age_label: '6–8 months',
    headline:  'Sits well unsupported and may start crawling.',
    watch_for: 'Says "ba/da/ma" sounds, responds to own name, looks for dropped toys.',
  } },
  { from_days: 245, to_days: 305, m: {
    age_label: '8–10 months',
    headline:  'Crawls, pulls to stand, pincer grasp emerges.',
    watch_for: 'Waves bye-bye, plays peek-a-boo, separation anxiety peaks.',
  } },
  { from_days: 306, to_days: 365, m: {
    age_label: '10–12 months',
    headline:  'Cruising furniture, first words, first steps.',
    watch_for: 'Says one or two words with meaning, points at things, drinks from a cup.',
  } },
  { from_days: 366, to_days: 547, m: {
    age_label: '12–18 months',
    headline:  'Walks well, vocabulary explodes (10–20 words).',
    watch_for: 'Stacks blocks, follows simple commands, scribbles with a crayon.',
  } },
  { from_days: 548, to_days: 730, m: {
    age_label: '18–24 months',
    headline:  'Runs, climbs, two-word combos, ~50 words.',
    watch_for: 'Helps undress, kicks a ball, names familiar objects.',
  } },
  { from_days: 731, to_days: 100000, m: {
    age_label: '2 years +',
    headline:  'Toddler talk: full sentences, big imagination.',
    watch_for: 'Sorts shapes/colors, uses fork & spoon, follows two-step instructions.',
  } },
];

export function milestoneFor(ageDays: number): Milestone {
  const found = MILESTONES.find(b => ageDays >= b.from_days && ageDays <= b.to_days);
  return found?.m ?? MILESTONES[0]!.m;
}

// ---------------------------------------------------------------------------
// Developmental milestone age windows — typical earliest, average and latest.
// Used by the per-baby trackers (teething, speaking, crawling, walking) and
// the "Milestones reference" card in growth insights.
// Values are months unless noted; sources: AAP / WHO / NHS reference ranges.
// ---------------------------------------------------------------------------

export type MilestoneAgeRange = {
  id: 'first_tooth' | 'crawling' | 'first_words' | 'walking' | 'first_sentence' | 'last_tooth';
  label: string;
  emoji: string;
  /** Earliest typical month for this milestone. */
  min_months: number;
  /** Average / typical month. */
  avg_months: number;
  /** WHO/AAP "watch-for" upper bound — past this, talk to pediatrician. */
  max_months: number;
  hint: string;
};

export const MILESTONE_AGES: MilestoneAgeRange[] = [
  { id: 'first_tooth',    label: 'First tooth',     emoji: '🦷',
    min_months: 4,  avg_months: 7,  max_months: 12,
    hint: 'Most babies cut their first tooth around 6–7 months. Anywhere from 4 to 12 is normal.' },
  { id: 'crawling',       label: 'Crawling',        emoji: '🚼',
    min_months: 6,  avg_months: 8,  max_months: 10,
    hint: 'Many babies crawl by 8 months. Some skip crawling and go straight to cruising — that is OK.' },
  { id: 'first_words',    label: 'First words',     emoji: '🗣️',
    min_months: 9,  avg_months: 12, max_months: 14,
    hint: '"Mama" / "Dada" with meaning typically appear around the first birthday.' },
  { id: 'walking',        label: 'Walking',         emoji: '🚶',
    min_months: 9,  avg_months: 12, max_months: 18,
    hint: 'Most kids take their first independent steps between 12 and 15 months.' },
  { id: 'last_tooth',     label: 'Full primary set',emoji: '😁',
    min_months: 22, avg_months: 28, max_months: 33,
    hint: 'All 20 baby teeth typically arrive between 2 and 3 years.' },
  { id: 'first_sentence', label: 'First sentences', emoji: '💬',
    min_months: 18, avg_months: 24, max_months: 30,
    hint: 'Two-word combos ("more milk", "go car") usually emerge around the second birthday.' },
];

/**
 * For a given milestone, classify where the baby sits relative to the typical
 * age window. `actual_months` should be the age (or age at first occurrence)
 * in months; if null, returns 'pending'.
 */
export function classifyMilestone(
  range: MilestoneAgeRange,
  actual_months: number | null,
  current_age_months: number,
): {
  state: 'early' | 'on_time' | 'late' | 'pending' | 'overdue';
  label: string;
} {
  if (actual_months != null) {
    if (actual_months < range.min_months) return { state: 'early',   label: 'Early bird' };
    if (actual_months > range.max_months) return { state: 'late',    label: 'Later than typical' };
    return { state: 'on_time', label: 'Right on schedule' };
  }
  if (current_age_months > range.max_months) return { state: 'overdue', label: 'Past the typical window' };
  return { state: 'pending', label: 'Not yet — and that\'s OK' };
}

// ---------------------------------------------------------------------------
// Comparison helper — formats a "vs WHO median" line and a status hint.
// ---------------------------------------------------------------------------

export function compareToMedian(actual: number | null, median: number | null): {
  delta: number | null;
  pct: number | null;
  status: 'on_track' | 'above' | 'below' | 'unknown';
} {
  if (actual == null || median == null || median <= 0) {
    return { delta: null, pct: null, status: 'unknown' };
  }
  const delta = actual - median;
  const pct = (delta / median) * 100;
  let status: 'on_track' | 'above' | 'below' = 'on_track';
  if      (pct >  10) status = 'above';
  else if (pct < -10) status = 'below';
  return { delta, pct, status };
}

/** Compare an actual measurement against the WHO 3rd percentile (lower bound). */
export function compareToMin(actual: number | null, min: number | null): {
  delta: number | null;
  status: 'above_min' | 'below_min' | 'unknown';
} {
  if (actual == null || min == null) return { delta: null, status: 'unknown' };
  const delta = actual - min;
  return { delta, status: delta >= 0 ? 'above_min' : 'below_min' };
}

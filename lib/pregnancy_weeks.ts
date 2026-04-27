// Static week-by-week pregnancy insights for the dashboard.
// Plain-text copy authored from public OB references — kept short, factual,
// and non-prescriptive. NEVER reach for an LLM here; this is reference material.

export type WeekInsight = {
  week: number;
  trimester: 1 | 2 | 3;
  size: string;          // "size of a poppy seed"
  highlight: string;     // 1-2 sentences on what's developing
  parent_tip?: string;   // optional gentle tip for the parent
  /** Approximate crown-rump (or crown-heel from week 20) length in cm. */
  length_cm?: number;
  /** Approximate fetal weight in grams. */
  weight_g?: number;
  /** Single emoji for the size analogy (rendered next to the fruit name). */
  emoji?: string;
};

// length_cm and weight_g are approximate population averages drawn from
// Hadlock / WHO fetal growth references — used here for a "today, your baby
// is about the size of …" card. NOT a clinical assessment.
const W: WeekInsight[] = [
  { week: 1,  trimester: 1, size: 'a poppy seed',          emoji: '🌱', length_cm: 0.0,  weight_g: 0,    highlight: 'Pregnancy weeks count from your last period, so weeks 1–2 are technically before conception.',                                              parent_tip: 'Start a daily prenatal vitamin with folic acid if you haven\'t already.' },
  { week: 2,  trimester: 1, size: 'a poppy seed',          emoji: '🌱', length_cm: 0.0,  weight_g: 0,    highlight: 'Ovulation happens around now. The fertilized egg begins its journey toward the uterus.',                                                  parent_tip: 'Avoid alcohol, smoking, and limit caffeine.' },
  { week: 3,  trimester: 1, size: 'a pinhead',             emoji: '📍', length_cm: 0.1,  weight_g: 0,    highlight: 'Implantation. The cluster of cells nestles into the uterine lining — sometimes with a little spotting.',                                  parent_tip: 'You may feel nothing yet. That\'s normal.' },
  { week: 4,  trimester: 1, size: 'a poppy seed',          emoji: '🌱', length_cm: 0.2,  weight_g: 0,    highlight: 'A positive pregnancy test is now possible. The neural tube is forming — folic acid matters most these next 4 weeks.' },
  { week: 5,  trimester: 1, size: 'a sesame seed',         emoji: '🌾', length_cm: 0.3,  weight_g: 0,    highlight: 'The heart begins to form and may start fluttering. Major organs are laying their foundations.',                                            parent_tip: 'Schedule your first OB appointment.' },
  { week: 6,  trimester: 1, size: 'a lentil',              emoji: '🫘', length_cm: 0.6,  weight_g: 0,    highlight: 'A faint heartbeat is often visible on ultrasound. Morning sickness can begin.',                                                            parent_tip: 'Eat small, frequent snacks if nausea hits.' },
  { week: 7,  trimester: 1, size: 'a blueberry',           emoji: '🫐', length_cm: 1.0,  weight_g: 1,    highlight: 'Tiny arm and leg buds appear. Brain growth is rapid.' },
  { week: 8,  trimester: 1, size: 'a raspberry',           emoji: '🍇', length_cm: 1.6,  weight_g: 1,    highlight: 'Webbed fingers and toes are forming. The embryo is now officially a fetus.',                                                               parent_tip: 'First prenatal visit — bring questions.' },
  { week: 9,  trimester: 1, size: 'a cherry',              emoji: '🍒', length_cm: 2.3,  weight_g: 2,    highlight: 'Tiny movements begin (you can\'t feel them yet). Eyelids are forming.' },
  { week: 10, trimester: 1, size: 'a strawberry',          emoji: '🍓', length_cm: 3.1,  weight_g: 4,    highlight: 'Most major organs are formed and starting to function. The risk of miscarriage drops sharply.' },
  { week: 11, trimester: 1, size: 'a fig',                 emoji: '🫒', length_cm: 4.1,  weight_g: 7,    highlight: 'Bones are starting to harden. Hair follicles are forming.' },
  { week: 12, trimester: 1, size: 'a lime',                emoji: '🟢', length_cm: 5.4,  weight_g: 14,   highlight: 'Reflexes begin — baby may open and close fingers. NT scan is often done this week.',                                                       parent_tip: 'Many people share the news around now.' },
  { week: 13, trimester: 1, size: 'a peach',               emoji: '🍑', length_cm: 7.4,  weight_g: 23,   highlight: 'Vocal cords are forming. The placenta is now your baby\'s life support.' },

  { week: 14, trimester: 2, size: 'a lemon',               emoji: '🍋', length_cm: 8.7,  weight_g: 43,   highlight: 'Welcome to the second trimester. Energy often returns.',                                                                                   parent_tip: 'Many find this the most comfortable phase.' },
  { week: 15, trimester: 2, size: 'an apple',              emoji: '🍎', length_cm: 10.1, weight_g: 70,   highlight: 'Baby can sense light through your skin. Bones are visible on ultrasound.' },
  { week: 16, trimester: 2, size: 'an avocado',            emoji: '🥑', length_cm: 11.6, weight_g: 100,  highlight: 'Some people feel the first flutters ("quickening") around now, especially in subsequent pregnancies.' },
  { week: 17, trimester: 2, size: 'a turnip',              emoji: '🥔', length_cm: 13.0, weight_g: 140,  highlight: 'A fine layer of fat develops. Baby\'s heart pumps about 100 pints of blood per day.' },
  { week: 18, trimester: 2, size: 'a bell pepper',         emoji: '🫑', length_cm: 14.2, weight_g: 190,  highlight: 'Yawning, hiccupping, and stretching are happening. Ears are positioned and hearing.' },
  { week: 19, trimester: 2, size: 'a mango',               emoji: '🥭', length_cm: 15.3, weight_g: 240,  highlight: 'Vernix — a waxy coating — protects the skin. Brain regions for senses develop.' },
  { week: 20, trimester: 2, size: 'a banana',              emoji: '🍌', length_cm: 25.6, weight_g: 300,  highlight: 'Anatomy scan ultrasound is usually around now. You\'re halfway there.',                                                                    parent_tip: 'Anatomy scan — bring a list of questions.' },
  { week: 21, trimester: 2, size: 'a carrot',              emoji: '🥕', length_cm: 26.7, weight_g: 360,  highlight: 'Baby is swallowing amniotic fluid and tasting flavors from your meals.' },
  { week: 22, trimester: 2, size: 'a small papaya',        emoji: '🥭', length_cm: 27.8, weight_g: 430,  highlight: 'Eyebrows and lashes appear. Baby looks more like a newborn now.' },
  { week: 23, trimester: 2, size: 'a large mango',         emoji: '🥭', length_cm: 28.9, weight_g: 500,  highlight: 'The lungs are practicing breathing motions. Skin is reddish and translucent.' },
  { week: 24, trimester: 2, size: 'a corn cob',            emoji: '🌽', length_cm: 30.0, weight_g: 600,  highlight: 'Viability milestone — survival outside the womb becomes possible with intensive NICU care, but every additional week dramatically helps.' },
  { week: 25, trimester: 2, size: 'a cauliflower',         emoji: '🥦', length_cm: 34.6, weight_g: 660,  highlight: 'Hair color is being determined. Baby responds to your voice.' },
  { week: 26, trimester: 2, size: 'a head of lettuce',     emoji: '🥬', length_cm: 35.6, weight_g: 760,  highlight: 'Eyes open. Brain wave activity for hearing and vision is detectable.' },
  { week: 27, trimester: 2, size: 'a head of cabbage',     emoji: '🥬', length_cm: 36.6, weight_g: 875,  highlight: 'Sleep / wake cycles are becoming regular. Lung surfactant production ramps up.' },

  { week: 28, trimester: 3, size: 'an eggplant',           emoji: '🍆', length_cm: 37.6, weight_g: 1005, highlight: 'Third trimester begins. Baby is gaining weight quickly. Time to start kick counts.',                                                       parent_tip: 'Aim for ≥10 kicks within 2 hours each day.' },
  { week: 29, trimester: 3, size: 'a butternut squash',    emoji: '🎃', length_cm: 38.6, weight_g: 1153, highlight: 'Bones are fully formed but still soft. Baby\'s head circumference is growing fast.' },
  { week: 30, trimester: 3, size: 'a large cabbage',       emoji: '🥬', length_cm: 39.9, weight_g: 1319, highlight: 'Baby is about 1.4 kg and turning toward a head-down position over the next few weeks.' },
  { week: 31, trimester: 3, size: 'a coconut',             emoji: '🥥', length_cm: 41.1, weight_g: 1502, highlight: 'Rapid brain development. The baby can process information from all five senses.' },
  { week: 32, trimester: 3, size: 'a jicama',              emoji: '🥔', length_cm: 42.4, weight_g: 1702, highlight: 'Toenails are visible. Baby practices breathing and may have hiccups you can feel.' },
  { week: 33, trimester: 3, size: 'a pineapple',           emoji: '🍍', length_cm: 43.7, weight_g: 1918, highlight: 'The skull bones stay flexible to ease delivery. Iron stores build up.' },
  { week: 34, trimester: 3, size: 'a cantaloupe',          emoji: '🍈', length_cm: 45.0, weight_g: 2146, highlight: 'Lungs nearly mature. Vernix thickens, lanugo (fine hair) starts shedding.' },
  { week: 35, trimester: 3, size: 'a honeydew',            emoji: '🍈', length_cm: 46.2, weight_g: 2383, highlight: 'Most of the major organs are well-developed. Baby is just gaining weight from here.',                                                      parent_tip: 'Prep a hospital bag. Talk birth plan with your provider.' },
  { week: 36, trimester: 3, size: 'a head of romaine',     emoji: '🥬', length_cm: 47.4, weight_g: 2622, highlight: 'Considered "early term" the next week. The body is ready, but the brain still needs time.',                                                parent_tip: 'GBS test usually happens around 36–37 weeks.' },
  { week: 37, trimester: 3, size: 'a winter melon',        emoji: '🍈', length_cm: 48.6, weight_g: 2859, highlight: 'Early term. Baby is shedding most of the lanugo. Fingernails reach the fingertips.' },
  { week: 38, trimester: 3, size: 'a pumpkin',             emoji: '🎃', length_cm: 49.8, weight_g: 3083, highlight: 'Full term begins next week. Lungs and brain continue maturing right up to delivery.' },
  { week: 39, trimester: 3, size: 'a small watermelon',    emoji: '🍉', length_cm: 50.7, weight_g: 3288, highlight: 'Full term. Baby could arrive any day. Lungs are producing surfactant for the first breath.' },
  { week: 40, trimester: 3, size: 'a watermelon',          emoji: '🍉', length_cm: 51.2, weight_g: 3462, highlight: 'Your due date! Only about 5% of babies arrive on this exact date — most come 1–2 weeks on either side.',                                   parent_tip: 'Tap "Mark as born" the moment baby arrives.' },
  { week: 41, trimester: 3, size: 'a watermelon',          emoji: '🍉', length_cm: 51.7, weight_g: 3597, highlight: 'Late term. Your provider may discuss monitoring or induction options.' },
  { week: 42, trimester: 3, size: 'a watermelon',          emoji: '🍉', length_cm: 51.9, weight_g: 3685, highlight: 'Post-term. Induction is usually recommended around now if labor hasn\'t started spontaneously.' },
];

/** Look up the insight for a given gestational week. Falls back to the closest
 *  available entry. */
export function weekInsight(week: number | null | undefined): WeekInsight | null {
  if (week == null || Number.isNaN(week)) return null;
  const clamped = Math.max(1, Math.min(42, Math.round(week)));
  return W.find(w => w.week === clamped) ?? null;
}

// ---------------------------------------------------------------------------
// IOM weight-gain bands (Institute of Medicine 2009)
// Pre-pregnancy BMI → recommended total weight gain (kg) for a singleton.
// ---------------------------------------------------------------------------
export type IomBand = {
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  min_kg: number;
  max_kg: number;
  /** Recommended weekly gain after week 13 (rough) */
  weekly_min_kg: number;
  weekly_max_kg: number;
};

export function iomBandFromBmi(bmi: number): IomBand {
  if (bmi < 18.5)  return { category: 'underweight', min_kg: 12.5, max_kg: 18,   weekly_min_kg: 0.44, weekly_max_kg: 0.58 };
  if (bmi < 25)    return { category: 'normal',      min_kg: 11.5, max_kg: 16,   weekly_min_kg: 0.35, weekly_max_kg: 0.50 };
  if (bmi < 30)    return { category: 'overweight',  min_kg:  7,   max_kg: 11.5, weekly_min_kg: 0.23, weekly_max_kg: 0.33 };
  return            { category: 'obese',       min_kg:  5,   max_kg:  9,   weekly_min_kg: 0.17, weekly_max_kg: 0.27 };
}

export function bmi(weight_kg: number, height_cm: number): number | null {
  if (!weight_kg || !height_cm) return null;
  const m = height_cm / 100;
  if (m <= 0) return null;
  return weight_kg / (m * m);
}

/**
 * Compare current weight gain to the IOM band given pre-pregnancy weight,
 * height, and gestational week. Returns a tiny status object the UI can
 * surface as a chip ("on track", "below band", "above band").
 */
export function gainStatus(
  current_gain_kg: number | null | undefined,
  pre_weight_kg: number | null | undefined,
  pre_height_cm: number | null | undefined,
  gestational_week: number | null | undefined,
): { band: IomBand | null; status: 'low' | 'on_track' | 'high' | 'unknown'; expected_min: number | null; expected_max: number | null } {
  if (pre_weight_kg == null || pre_height_cm == null) {
    return { band: null, status: 'unknown', expected_min: null, expected_max: null };
  }
  const b = bmi(pre_weight_kg, pre_height_cm);
  if (b == null) return { band: null, status: 'unknown', expected_min: null, expected_max: null };
  const band = iomBandFromBmi(b);
  if (current_gain_kg == null || gestational_week == null) {
    return { band, status: 'unknown', expected_min: null, expected_max: null };
  }
  // First-trimester recommended gain: 0.5–2 kg total. After that, weekly accrual.
  const weeksAfter13 = Math.max(0, gestational_week - 13);
  const expected_min = 0.5 + weeksAfter13 * band.weekly_min_kg;
  const expected_max = 2   + weeksAfter13 * band.weekly_max_kg;
  let status: 'low' | 'on_track' | 'high' = 'on_track';
  if (current_gain_kg < expected_min - 0.5) status = 'low';
  else if (current_gain_kg > expected_max + 1) status = 'high';
  return { band, status, expected_min, expected_max };
}

// ---------------------------------------------------------------------------
// Daily-size interpolation for "today, your baby is about the size of …"
// ---------------------------------------------------------------------------
export type DailySize = {
  week: number;
  day_into_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  size: string;          // fruit/veg analogy from the bracketing week
  emoji: string;
  /** Linearly interpolated length in cm. */
  length_cm: number;
  /** Linearly interpolated weight in grams. */
  weight_g: number;
};

/**
 * Interpolate length / weight between the bracketing week entries so the
 * dashboard can say "today, baby is ~21.5 cm / 380 g" instead of jumping
 * once a week. The fruit analogy comes from the floor week so it stays
 * readable.
 */
export function dailySize(gestationalDays: number | null | undefined): DailySize | null {
  if (gestationalDays == null || Number.isNaN(gestationalDays)) return null;
  if (gestationalDays < 7) return null;
  const weekFloor = Math.max(1, Math.min(42, Math.floor(gestationalDays / 7)));
  const weekCeil  = Math.min(42, weekFloor + 1);
  const dayIntoWeek = Math.max(0, Math.min(6, gestationalDays - weekFloor * 7)) as 0|1|2|3|4|5|6;
  const lo = W.find(w => w.week === weekFloor);
  const hi = W.find(w => w.week === weekCeil) ?? lo;
  if (!lo || !hi) return null;
  const t = dayIntoWeek / 7;
  const length_cm = (lo.length_cm ?? 0) + ((hi.length_cm ?? lo.length_cm ?? 0) - (lo.length_cm ?? 0)) * t;
  const weight_g  = (lo.weight_g  ?? 0) + ((hi.weight_g  ?? lo.weight_g  ?? 0) - (lo.weight_g  ?? 0)) * t;
  return {
    week: weekFloor,
    day_into_week: dayIntoWeek,
    size: lo.size,
    emoji: lo.emoji ?? '👶',
    length_cm: Math.round(length_cm * 10) / 10,
    weight_g: Math.round(weight_g),
  };
}

// ---------------------------------------------------------------------------
// Monthly + trimester rollups
// ---------------------------------------------------------------------------
export type MonthExpectations = {
  month: number;        // 1..10 (lunar months — weeks 1-4 = month 1, 5-8 = 2, etc)
  weeks: [number, number]; // [start, end]
  trimester: 1 | 2 | 3;
  mom: string[];        // 2-4 short bullets about how mom may feel
  baby: string[];       // 2-4 short bullets on baby development
  todos: string[];      // 2-3 practical to-dos
};

export type TrimesterOverview = {
  trimester: 1 | 2 | 3;
  weeks: [number, number];
  headline: string;
  mom: string[];
  baby: string[];
  todos: string[];
};

const MONTHS: MonthExpectations[] = [
  { month: 1, weeks: [1, 4], trimester: 1,
    mom:   ['Often no symptoms yet — pregnancy may still be a surprise.', 'Possible mild fatigue, breast tenderness, or a missed period.'],
    baby:  ['Fertilization, implantation, and the first cells of the embryo.', 'Neural tube and heart begin forming.'],
    todos: ['Start a daily prenatal vitamin (≥400µg folic acid).', 'Avoid alcohol, smoking, and limit caffeine to ≤200mg/day.', 'Confirm pregnancy with a home test or HCG blood test.'] },
  { month: 2, weeks: [5, 8], trimester: 1,
    mom:   ['Morning sickness and nausea peak for many people.', 'Strong food aversions and fatigue are common.', 'Breasts become tender and fuller.'],
    baby:  ['Heart starts beating around week 6.', 'Arm and leg buds, brain, and major organs begin to form.', 'Embryo grows from a sesame seed to a raspberry.'],
    todos: ['Book your first OB visit for around 8 weeks.', 'Eat small frequent meals to manage nausea.'] },
  { month: 3, weeks: [9, 13], trimester: 1,
    mom:   ['Energy may dip; nausea often eases by the end of this month.', 'Mood swings from hormone shifts.', 'Possible spotting around the time of the missed period — usually normal.'],
    baby:  ['All major organs formed by week 10–12.', 'Reflexes appear; baby may suck their thumb.', 'NT scan offered at 11–13 weeks.'],
    todos: ['Schedule the first-trimester (NT) screening scan.', 'Discuss prenatal genetic testing options with your provider.'] },
  { month: 4, weeks: [14, 17], trimester: 2,
    mom:   ['Energy returns — many call this the "honeymoon" phase.', 'Belly may start to show.', 'Round-ligament pain (sharp groin twinges) is normal.'],
    baby:  ['Bones harden, hair follicles form.', 'Baby can hear muffled sounds from outside.', 'Sex may be visible on ultrasound.'],
    todos: ['Plan a maternity wardrobe.', 'Book the 20-week anatomy scan.'] },
  { month: 5, weeks: [18, 22], trimester: 2,
    mom:   ['First flutters ("quickening") usually felt around 18–22 weeks.', 'Heartburn and leg cramps may begin.'],
    baby:  ['Anatomy scan around 20 weeks confirms organ development.', 'Baby is now about banana-sized.', 'Practising swallowing and tasting amniotic fluid.'],
    todos: ['Bring a question list to the anatomy scan.', 'Start sleeping on your side to improve circulation.'] },
  { month: 6, weeks: [23, 27], trimester: 2,
    mom:   ['Belly grows quickly; back pain may begin.', 'Braxton-Hicks (practice contractions) can start.', 'Glucose tolerance test usually around 24–28 weeks.'],
    baby:  ['Lungs start practicing breathing motions.', 'Eyes open and respond to light.', 'Reaches viability around 24 weeks.'],
    todos: ['Do the glucose screening test.', 'Start thinking about a hospital bag and birth plan.'] },
  { month: 7, weeks: [28, 31], trimester: 3,
    mom:   ['Third trimester begins; sleep gets harder.', 'Swelling in feet/ankles is common.', 'Fatigue often returns.'],
    baby:  ['Baby gains weight rapidly — about 1.0 kg by start of 7th month.', 'Brain development is rapid.', 'Begins responding to your voice consistently.'],
    todos: ['Start daily kick counts (≥10 in 2 hours).', 'Book any 3rd-trimester growth scans your provider recommends.'] },
  { month: 8, weeks: [32, 35], trimester: 3,
    mom:   ['Heartburn, shortness of breath, and frequent urination peak.', 'Pelvic pressure increases as baby moves down.'],
    baby:  ['Most major organs are well-developed.', 'Baby usually turns head-down by week 34–36.', 'Iron stores being built up.'],
    todos: ['Tour the hospital / birth centre.', 'Pack the hospital bag.', 'Decide on a paediatrician.'] },
  { month: 9, weeks: [36, 40], trimester: 3,
    mom:   ['Baby drops lower — easier to breathe but more pressure.', 'Mucus plug or "show" can release any time.', 'Weekly OB visits begin around 36 weeks.'],
    baby:  ['Considered full-term at 39 weeks.', 'Lungs producing surfactant for the first breath.', 'Rapid weight gain right up to delivery.'],
    todos: ['Group B strep test around 36–37 weeks.', 'Install the car seat and learn how to use it.', 'Tap "Mark as born" the moment baby arrives.'] },
  { month: 10, weeks: [41, 42], trimester: 3,
    mom:   ['Late- and post-term: provider monitors closely.', 'Induction is usually discussed around 41 weeks.'],
    baby:  ['Continues to grow slowly; placenta begins to age after 41 weeks.'],
    todos: ['Daily kick counts and stay in close touch with your provider.', 'Discuss induction timing.'] },
];

/** What-to-expect for the lunar month containing this gestational week. */
export function monthExpectations(week: number | null | undefined): MonthExpectations | null {
  if (week == null || Number.isNaN(week)) return null;
  const w = Math.max(1, Math.min(42, Math.round(week)));
  return MONTHS.find(m => w >= m.weeks[0] && w <= m.weeks[1]) ?? null;
}

const TRIMESTERS: TrimesterOverview[] = [
  { trimester: 1, weeks: [1, 13],
    headline: 'Building the foundation — the embryo becomes a fetus.',
    mom:   ['Fatigue, nausea, breast tenderness, and food aversions peak.', 'Hormone surges drive frequent mood shifts.', 'Miscarriage risk drops sharply after week 12.'],
    baby:  ['All major organs and limb buds form.', 'Heartbeat detectable on ultrasound from week 6.', 'By week 13 baby is about 7 cm and ~25 g.'],
    todos: ['Confirm pregnancy and book first OB visit.', 'Start prenatal vitamins with folic acid.', 'Complete the NT scan at 11–13 weeks.'] },
  { trimester: 2, weeks: [14, 27],
    headline: 'Often the easiest stretch — energy returns and the bump shows.',
    mom:   ['Energy and appetite often improve.', 'First flutters (quickening) felt around 18–22 weeks.', 'Glucose screening between 24–28 weeks.'],
    baby:  ['Anatomy scan around 20 weeks.', 'Hearing fully develops; baby responds to your voice.', 'Reaches viability at ~24 weeks.'],
    todos: ['Anatomy scan and glucose test.', 'Start sleeping on your side.', 'Start thinking about birth plan and childcare.'] },
  { trimester: 3, weeks: [28, 42],
    headline: 'Final growth and prep for birth — kick counts begin.',
    mom:   ['Heartburn, swelling, and sleep disruption peak.', 'Frequent OB visits — weekly from 36 weeks.', 'Watch for preeclampsia signs (severe headaches, vision changes, sudden swelling).'],
    baby:  ['Rapid weight gain from ~1 kg to ~3.4 kg.', 'Lungs mature; baby practices breathing.', 'Usually turns head-down by week 34–36.'],
    todos: ['Daily kick counts.', 'Hospital bag, car seat, and birth plan.', 'Mark as born the moment baby arrives.'] },
];

export function trimesterOverview(tri: 1 | 2 | 3 | null | undefined): TrimesterOverview | null {
  if (!tri) return null;
  return TRIMESTERS.find(t => t.trimester === tri) ?? null;
}

// Static week-by-week pregnancy insights for the dashboard.
// Plain-text copy authored from public OB references — kept short, factual,
// and non-prescriptive. NEVER reach for an LLM here; this is reference material.

export type WeekInsight = {
  week: number;
  trimester: 1 | 2 | 3;
  size: string;          // "size of a poppy seed"
  highlight: string;     // 1-2 sentences on what's developing
  parent_tip?: string;   // optional gentle tip for the parent
};

const W: WeekInsight[] = [
  { week: 1,  trimester: 1, size: 'a poppy seed',          highlight: 'Pregnancy weeks count from your last period, so weeks 1–2 are technically before conception.',                                              parent_tip: 'Start a daily prenatal vitamin with folic acid if you haven\'t already.' },
  { week: 2,  trimester: 1, size: 'a poppy seed',          highlight: 'Ovulation happens around now. The fertilized egg begins its journey toward the uterus.',                                                  parent_tip: 'Avoid alcohol, smoking, and limit caffeine.' },
  { week: 3,  trimester: 1, size: 'a pinhead',             highlight: 'Implantation. The cluster of cells nestles into the uterine lining — sometimes with a little spotting.',                                  parent_tip: 'You may feel nothing yet. That\'s normal.' },
  { week: 4,  trimester: 1, size: 'a poppy seed',          highlight: 'A positive pregnancy test is now possible. The neural tube is forming — folic acid matters most these next 4 weeks.' },
  { week: 5,  trimester: 1, size: 'a sesame seed',         highlight: 'The heart begins to form and may start fluttering. Major organs are laying their foundations.',                                            parent_tip: 'Schedule your first OB appointment.' },
  { week: 6,  trimester: 1, size: 'a lentil',              highlight: 'A faint heartbeat is often visible on ultrasound. Morning sickness can begin.',                                                            parent_tip: 'Eat small, frequent snacks if nausea hits.' },
  { week: 7,  trimester: 1, size: 'a blueberry',           highlight: 'Tiny arm and leg buds appear. Brain growth is rapid.' },
  { week: 8,  trimester: 1, size: 'a raspberry',           highlight: 'Webbed fingers and toes are forming. The embryo is now officially a fetus.',                                                               parent_tip: 'First prenatal visit — bring questions.' },
  { week: 9,  trimester: 1, size: 'a cherry',              highlight: 'Tiny movements begin (you can\'t feel them yet). Eyelids are forming.' },
  { week: 10, trimester: 1, size: 'a strawberry',          highlight: 'Most major organs are formed and starting to function. The risk of miscarriage drops sharply.' },
  { week: 11, trimester: 1, size: 'a fig',                 highlight: 'Bones are starting to harden. Hair follicles are forming.' },
  { week: 12, trimester: 1, size: 'a lime',                highlight: 'Reflexes begin — baby may open and close fingers. NT scan is often done this week.',                                                       parent_tip: 'Many people share the news around now.' },
  { week: 13, trimester: 1, size: 'a peach',               highlight: 'Vocal cords are forming. The placenta is now your baby\'s life support.' },

  { week: 14, trimester: 2, size: 'a lemon',               highlight: 'Welcome to the second trimester. Energy often returns.',                                                                                   parent_tip: 'Many find this the most comfortable phase.' },
  { week: 15, trimester: 2, size: 'an apple',              highlight: 'Baby can sense light through your skin. Bones are visible on ultrasound.' },
  { week: 16, trimester: 2, size: 'an avocado',            highlight: 'Some people feel the first flutters ("quickening") around now, especially in subsequent pregnancies.' },
  { week: 17, trimester: 2, size: 'a turnip',              highlight: 'A fine layer of fat develops. Baby\'s heart pumps about 100 pints of blood per day.' },
  { week: 18, trimester: 2, size: 'a bell pepper',         highlight: 'Yawning, hiccupping, and stretching are happening. Ears are positioned and hearing.' },
  { week: 19, trimester: 2, size: 'a mango',               highlight: 'Vernix — a waxy coating — protects the skin. Brain regions for senses develop.' },
  { week: 20, trimester: 2, size: 'a banana',              highlight: 'Anatomy scan ultrasound is usually around now. You\'re halfway there.',                                                                    parent_tip: 'Anatomy scan — bring a list of questions.' },
  { week: 21, trimester: 2, size: 'a carrot',              highlight: 'Baby is swallowing amniotic fluid and tasting flavors from your meals.' },
  { week: 22, trimester: 2, size: 'a small papaya',        highlight: 'Eyebrows and lashes appear. Baby looks more like a newborn now.' },
  { week: 23, trimester: 2, size: 'a large mango',         highlight: 'The lungs are practicing breathing motions. Skin is reddish and translucent.' },
  { week: 24, trimester: 2, size: 'a corn cob',            highlight: 'Viability milestone — survival outside the womb becomes possible with intensive NICU care, but every additional week dramatically helps.' },
  { week: 25, trimester: 2, size: 'a cauliflower',         highlight: 'Hair color is being determined. Baby responds to your voice.' },
  { week: 26, trimester: 2, size: 'a head of lettuce',     highlight: 'Eyes open. Brain wave activity for hearing and vision is detectable.' },
  { week: 27, trimester: 2, size: 'a head of cabbage',     highlight: 'Sleep / wake cycles are becoming regular. Lung surfactant production ramps up.' },

  { week: 28, trimester: 3, size: 'an eggplant',           highlight: 'Third trimester begins. Baby is gaining weight quickly. Time to start kick counts.',                                                       parent_tip: 'Aim for ≥10 kicks within 2 hours each day.' },
  { week: 29, trimester: 3, size: 'a butternut squash',    highlight: 'Bones are fully formed but still soft. Baby\'s head circumference is growing fast.' },
  { week: 30, trimester: 3, size: 'a large cabbage',       highlight: 'Baby is about 1.4 kg and turning toward a head-down position over the next few weeks.' },
  { week: 31, trimester: 3, size: 'a coconut',             highlight: 'Rapid brain development. The baby can process information from all five senses.' },
  { week: 32, trimester: 3, size: 'a jicama',              highlight: 'Toenails are visible. Baby practices breathing and may have hiccups you can feel.' },
  { week: 33, trimester: 3, size: 'a pineapple',           highlight: 'The skull bones stay flexible to ease delivery. Iron stores build up.' },
  { week: 34, trimester: 3, size: 'a cantaloupe',          highlight: 'Lungs nearly mature. Vernix thickens, lanugo (fine hair) starts shedding.' },
  { week: 35, trimester: 3, size: 'a honeydew',            highlight: 'Most of the major organs are well-developed. Baby is just gaining weight from here.',                                                      parent_tip: 'Prep a hospital bag. Talk birth plan with your provider.' },
  { week: 36, trimester: 3, size: 'a head of romaine',     highlight: 'Considered "early term" the next week. The body is ready, but the brain still needs time.',                                                parent_tip: 'GBS test usually happens around 36–37 weeks.' },
  { week: 37, trimester: 3, size: 'a winter melon',        highlight: 'Early term. Baby is shedding most of the lanugo. Fingernails reach the fingertips.' },
  { week: 38, trimester: 3, size: 'a pumpkin',             highlight: 'Full term begins next week. Lungs and brain continue maturing right up to delivery.' },
  { week: 39, trimester: 3, size: 'a small watermelon',    highlight: 'Full term. Baby could arrive any day. Lungs are producing surfactant for the first breath.' },
  { week: 40, trimester: 3, size: 'a watermelon',          highlight: 'Your due date! Only about 5% of babies arrive on this exact date — most come 1–2 weeks on either side.',                                   parent_tip: 'Tap "Mark as born" the moment baby arrives.' },
  { week: 41, trimester: 3, size: 'a watermelon',          highlight: 'Late term. Your provider may discuss monitoring or induction options.' },
  { week: 42, trimester: 3, size: 'a watermelon',          highlight: 'Post-term. Induction is usually recommended around now if labor hasn\'t started spontaneously.' },
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

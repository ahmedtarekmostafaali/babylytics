// Structured allergy templates — quick-pick presets for the most common
// pediatric allergens, with a deeper guidance card for cow's-milk allergy
// (CMPA/CMPI), the #1 infant allergy in Egypt and globally.
//
// The keys here are referenced as i18n paths under `forms.allergy_tpl.*`.
// English and Arabic copies live in lib/i18n/messages.{en,ar}.ts.
//
// IMPORTANT: this is general parent education, not medical advice. Every
// template renders a small "Always confirm with your paediatrician" caveat
// on screen.

export type AllergyTemplateKey =
  | 'cow_milk'
  | 'peanut'
  | 'egg'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'tree_nuts'
  | 'sesame'
  | 'penicillin'
  | 'latex';

export type AllergyCategory = 'food' | 'drug' | 'environmental' | 'contact' | 'latex' | 'other';

export type AllergyTemplate = {
  key: AllergyTemplateKey;
  /** Single emoji for the picker chip. */
  emoji: string;
  /** i18n key under `forms.allergy_tpl.<key>.label` */
  label_key: string;
  /** Default category to pre-select. */
  category: AllergyCategory;
  /** Suggested allergen text (free-form) — pre-fills the textbox. */
  allergen_default: string;
  /** Optional default reaction notes — left blank when ambiguous. */
  reaction_key?: string;
  /** Whether this template ships with a deeper guidance panel. */
  has_guidance: boolean;
};

export const TEMPLATES: AllergyTemplate[] = [
  { key: 'cow_milk',   emoji: '🥛', label_key: 'forms.allergy_tpl.cow_milk.label',   category: 'food', allergen_default: "Cow's milk protein", reaction_key: 'forms.allergy_tpl.cow_milk.reaction', has_guidance: true },
  { key: 'peanut',     emoji: '🥜', label_key: 'forms.allergy_tpl.peanut.label',     category: 'food', allergen_default: 'Peanut',             reaction_key: 'forms.allergy_tpl.peanut.reaction',   has_guidance: true },
  { key: 'egg',        emoji: '🥚', label_key: 'forms.allergy_tpl.egg.label',        category: 'food', allergen_default: 'Egg (white/yolk)',   reaction_key: 'forms.allergy_tpl.egg.reaction',      has_guidance: true },
  { key: 'soy',        emoji: '🫘', label_key: 'forms.allergy_tpl.soy.label',        category: 'food', allergen_default: 'Soy',                has_guidance: false },
  { key: 'wheat',      emoji: '🌾', label_key: 'forms.allergy_tpl.wheat.label',      category: 'food', allergen_default: 'Wheat',              has_guidance: false },
  { key: 'fish',       emoji: '🐟', label_key: 'forms.allergy_tpl.fish.label',       category: 'food', allergen_default: 'Fish',               has_guidance: false },
  { key: 'shellfish',  emoji: '🦐', label_key: 'forms.allergy_tpl.shellfish.label',  category: 'food', allergen_default: 'Shellfish',          has_guidance: false },
  { key: 'tree_nuts',  emoji: '🌰', label_key: 'forms.allergy_tpl.tree_nuts.label',  category: 'food', allergen_default: 'Tree nuts',          has_guidance: false },
  { key: 'sesame',     emoji: '🫓', label_key: 'forms.allergy_tpl.sesame.label',     category: 'food', allergen_default: 'Sesame',             has_guidance: false },
  { key: 'penicillin', emoji: '💊', label_key: 'forms.allergy_tpl.penicillin.label', category: 'drug', allergen_default: 'Penicillin',         has_guidance: false },
  { key: 'latex',      emoji: '🧤', label_key: 'forms.allergy_tpl.latex.label',      category: 'latex', allergen_default: 'Latex',             has_guidance: false },
];

/** Return the template matching a typed allergen string, or null. Used to
 *  decide whether to show the guidance panel below the form. */
export function templateForAllergen(s: string): AllergyTemplate | null {
  const norm = s.trim().toLowerCase();
  if (!norm) return null;
  if (/(cow.?s? ?milk|milk protein|cmpa|cmpi|cow milk|dairy)/.test(norm)) return TEMPLATES.find(t => t.key === 'cow_milk') ?? null;
  if (/peanut/.test(norm))       return TEMPLATES.find(t => t.key === 'peanut') ?? null;
  if (/\begg/.test(norm))        return TEMPLATES.find(t => t.key === 'egg') ?? null;
  if (/sesame|tahini/.test(norm))return TEMPLATES.find(t => t.key === 'sesame') ?? null;
  if (/penicillin|amoxi/.test(norm)) return TEMPLATES.find(t => t.key === 'penicillin') ?? null;
  if (/\blatex\b/.test(norm))    return TEMPLATES.find(t => t.key === 'latex') ?? null;
  return null;
}

/**
 * Cow's milk allergy guidance content. Built as a structured shape so the
 * UI can render it with proper headings, lists, and i18n. NOT clinical
 * advice — every screen reminds the parent to confirm with the paediatrician.
 *
 * Sources are general public OB/peds references (NHS, AAP, WAO) — kept
 * generic and short.
 */
export type CowMilkGuidance = {
  intro_key: string;
  /** Symptom buckets with i18n keys. */
  symptom_groups: Array<{ title_key: string; items_key: string }>;
  /** What to avoid (hidden sources). */
  avoid_key: string;
  /** Alternatives (eHF, AAF, soy after 6mo, plant milks for older). */
  alternatives_key: string;
  /** When to seek urgent care. */
  red_flags_key: string;
  /** "Most kids outgrow it" reassurance. */
  outlook_key: string;
};

export const COW_MILK: CowMilkGuidance = {
  intro_key: 'forms.allergy_tpl.cow_milk.guidance.intro',
  symptom_groups: [
    { title_key: 'forms.allergy_tpl.cow_milk.guidance.sym_skin_title',    items_key: 'forms.allergy_tpl.cow_milk.guidance.sym_skin_items' },
    { title_key: 'forms.allergy_tpl.cow_milk.guidance.sym_gut_title',     items_key: 'forms.allergy_tpl.cow_milk.guidance.sym_gut_items' },
    { title_key: 'forms.allergy_tpl.cow_milk.guidance.sym_respir_title',  items_key: 'forms.allergy_tpl.cow_milk.guidance.sym_respir_items' },
  ],
  avoid_key:        'forms.allergy_tpl.cow_milk.guidance.avoid',
  alternatives_key: 'forms.allergy_tpl.cow_milk.guidance.alternatives',
  red_flags_key:    'forms.allergy_tpl.cow_milk.guidance.red_flags',
  outlook_key:      'forms.allergy_tpl.cow_milk.guidance.outlook',
};

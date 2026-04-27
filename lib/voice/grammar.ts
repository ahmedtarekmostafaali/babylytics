// Bilingual voice-command intent parser. Pure functions, no DOM, no
// network — easy to unit-test. The browser SpeechRecognition API
// captures the transcript; this module turns the transcript into a
// structured Intent the dashboard can save.
//
// Design principles:
//   - Always require an explicit confirmation step on the UI side; this
//     parser never auto-saves on its own.
//   - Be permissive — partial transcripts and Arabic dialect variants
//     should still match.
//   - Return null when nothing matches so the UI can show a friendly
//     "Sorry, didn't catch that" message.
//
// Coverage (English + Egyptian Arabic):
//   feeding   — "log a feeding 120 ml bottle"            / "سجل رضعة ١٢٠ مل زجاجة"
//   stool     — "diaper change small"                    / "حفاضة صغيرة"
//   sleep     — "nap one hour" / "sleep 90 minutes"      / "نوم ساعة" / "قيلولة 45 دقيقة"
//   temp      — "temperature 37.5"                       / "حرارة 38"
//   kick      — "kick"                                   / "ركلة"
//   note      — "add a note <free text>"                 / "ملاحظة <نص>"

export type FeedingIntent = {
  kind: 'feeding';
  milk_type: 'breast' | 'bottle' | 'formula' | 'mixed' | 'solid';
  quantity_ml?: number;
  duration_min?: number;
};
export type StoolIntent = {
  kind: 'stool';
  size: 'small' | 'medium' | 'large';
};
export type SleepIntent = {
  kind: 'sleep';
  duration_min: number;
};
export type TemperatureIntent = {
  kind: 'temperature';
  temperature_c: number;
  method?: 'axillary' | 'ear' | 'oral' | 'rectal' | 'forehead';
};
export type KickIntent = { kind: 'kick'; count: number };
export type NoteIntent = { kind: 'note'; text: string };
export type MedicationIntent = {
  kind: 'medication';
  /** Free-form medication name as transcribed (e.g. "panadol",
   *  "augmentin", «بنادول»). Caller fuzzy-matches against the
   *  active prescriptions list — the parser does not. */
  name_query: string;
  status: 'taken' | 'missed' | 'skipped';
  /** Optional dosage string ("5ml", "1 tab", "نصف"). */
  dosage?: string;
};

export type Intent =
  | FeedingIntent | StoolIntent | SleepIntent
  | TemperatureIntent | KickIntent | NoteIntent
  | MedicationIntent;

/** Best-effort number extraction. Handles both Western (123) and
 *  Eastern-Arabic (١٢٣) digits, and English number words up to twenty.
 *  Returns null when no number is present. */
export function parseNumber(s: string): number | null {
  // Eastern Arabic → Western
  const norm = s
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const m = norm.match(/-?\d+(?:[.,]\d+)?/);
  if (m) return Number(m[0].replace(',', '.'));
  // English number words (handful — covers most short commands)
  const WORDS: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
    seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, ninety: 90, hundred: 100,
    half: 0.5, quarter: 0.25,
  };
  const tokens = norm.toLowerCase().split(/\s+/);
  for (const tok of tokens) if (tok in WORDS) return WORDS[tok];
  return null;
}

/** Top-level entry point for a single language — returns null when
 *  nothing matches. Prefer parseVoiceCommandAuto when you don't yet
 *  know whether the speaker used English or Arabic. */
export function parseVoiceCommand(transcriptRaw: string, lang: 'en' | 'ar'): Intent | null {
  if (!transcriptRaw) return null;
  // Normalize: lower-case (Arabic case-folding is a no-op), collapse
  // whitespace, strip sentence-ending punctuation that confuses the
  // matchers. We DO keep `.` and `,` because they appear inside
  // numbers ("37.5", "1,250 ml") and stripping them would corrupt
  // value extraction. Punctuation between digits stays untouched.
  const t = transcriptRaw
    .toLowerCase()
    .replace(/[?!،؟]/g, ' ')
    .replace(/(?<!\d)[.,](?!\d)/g, ' ')   // strip stops only outside numbers
    .replace(/\s+/g, ' ')
    .trim();

  // Try in priority order — feeding / temp / sleep / stool first
  // because they have the most specific keywords. Medication uses
  // verbs like "took / gave" which can ambiguate with feeding ("took
  // bottle") so it sits AFTER feeding. Kicks last because the bare
  // word "kick" is short and could appear in noise.
  return (
    parseFeeding(t, lang)
    ?? parseTemperature(t, lang)
    ?? parseSleep(t, lang)
    ?? parseStool(t, lang)
    ?? parseMedication(t, lang)
    ?? parseNote(t, lang)
    ?? parseKick(t, lang)
    ?? null
  );
}

/**
 * Detect the language of a transcript by counting Arabic-script
 * codepoints. Returns 'ar' when at least one Arabic letter is present,
 * otherwise 'en'. Useful as a tiebreaker when both parsers match
 * (rare — but possible for short commands like "kick" / «ركلة»).
 */
export function detectLang(s: string): 'en' | 'ar' {
  // Arabic block U+0600–U+06FF + Arabic Supplement / Extended-A.
  return /[؀-ۿݐ-ݿࢠ-ࣿ]/.test(s) ? 'ar' : 'en';
}

/**
 * Bilingual auto-detect parser. Runs both English and Arabic grammars
 * against the same transcript and returns whichever matches.
 *
 * The Web Speech API recognizer biases its phonetics toward whatever
 * `lang` you set on it, but the resulting *text* often contains the
 * other language's words verbatim — especially for short, vocab-heavy
 * commands like "feeding 120 ml" or «حفاضة». Running both parsers
 * lets us recover those mixed cases.
 *
 * Tiebreaker order:
 *   1. If only one parser matches → use that one.
 *   2. If both match → pick whichever matches the script of the
 *      transcript itself (Arabic letters present → Arabic intent).
 *   3. Both match and script is ambiguous → default to English.
 */
export function parseVoiceCommandAuto(transcriptRaw: string):
  | { intent: Intent; lang: 'en' | 'ar' }
  | null
{
  const en = parseVoiceCommand(transcriptRaw, 'en');
  const ar = parseVoiceCommand(transcriptRaw, 'ar');
  if (!en && !ar) return null;
  if (en && !ar) return { intent: en, lang: 'en' };
  if (ar && !en) return { intent: ar, lang: 'ar' };
  // Both matched — tie-break on script.
  const script = detectLang(transcriptRaw);
  if (script === 'ar' && ar) return { intent: ar, lang: 'ar' };
  return { intent: en!, lang: 'en' };
}

// ---------- Feeding -------------------------------------------------------
function parseFeeding(t: string, lang: 'en' | 'ar'): FeedingIntent | null {
  const isFeed = lang === 'ar'
    ? /(رضع|رضاعة|رضعة|تغذية|أكل|أكلت|شرب|زجاج|بزاز)/.test(t)
    : /\b(feed(ing)?|bottle|breast|formula|milk|nursed?|drank)\b/.test(t);
  if (!isFeed) return null;

  let milk_type: FeedingIntent['milk_type'] = 'bottle';
  if (lang === 'ar') {
    if (/(صدر|طبيع|رضاعة طبيعية)/.test(t)) milk_type = 'breast';
    else if (/(فورمولا|صناعي)/.test(t)) milk_type = 'formula';
    else if (/(زجاج|بزاز|ببرونة|ببرونه)/.test(t)) milk_type = 'bottle';
    else if (/(مختلط|الاثنين)/.test(t)) milk_type = 'mixed';
    else if (/(طعام|أكل|صلب)/.test(t)) milk_type = 'solid';
  } else {
    if (/\bbreast/.test(t) || /\bnursed?/.test(t)) milk_type = 'breast';
    else if (/\bformula/.test(t)) milk_type = 'formula';
    else if (/\bbottle/.test(t)) milk_type = 'bottle';
    else if (/\bmixed/.test(t)) milk_type = 'mixed';
    else if (/\bsolid/.test(t)) milk_type = 'solid';
  }

  // Volume in ml.
  let quantity_ml: number | undefined;
  const mlMatch = t.match(/(\d+(?:[.,]\d+)?|[٠-٩]+(?:[.,٫][٠-٩]+)?)\s*(ml|مل|ميلي|cc)/i);
  if (mlMatch) {
    const n = parseNumber(mlMatch[1]);
    if (n != null) quantity_ml = n;
  }

  // Breast duration ("15 minutes each side" / "١٥ دقيقة")
  let duration_min: number | undefined;
  if (milk_type === 'breast') {
    const minMatch = t.match(/(\d+|[٠-٩]+)\s*(min|minutes?|دقيق|دقايق|دقيقة)/i);
    if (minMatch) duration_min = parseNumber(minMatch[1]) ?? undefined;
  }

  if (!quantity_ml && !duration_min) {
    // Allow pure "log a bottle feeding" (caregiver fills volume on the
    // confirm card). Caller must show that as "no quantity yet".
    return { kind: 'feeding', milk_type };
  }
  return { kind: 'feeding', milk_type, quantity_ml, duration_min };
}

// ---------- Stool ---------------------------------------------------------
function parseStool(t: string, lang: 'en' | 'ar'): StoolIntent | null {
  const isStool = lang === 'ar'
    ? /(حفاض|حفاظ|براز|كاكا|تبرز|تبرّز|تبول)/.test(t)
    : /\b(diaper|stool|poop|bm|bowel)\b/.test(t);
  if (!isStool) return null;
  let size: StoolIntent['size'] = 'medium';
  if (lang === 'ar') {
    if (/(صغير|قليل)/.test(t)) size = 'small';
    else if (/(كبير|كثير)/.test(t)) size = 'large';
  } else {
    if (/\bsmall\b/.test(t)) size = 'small';
    else if (/\b(large|big)\b/.test(t)) size = 'large';
  }
  return { kind: 'stool', size };
}

// ---------- Sleep ---------------------------------------------------------
function parseSleep(t: string, lang: 'en' | 'ar'): SleepIntent | null {
  const isSleep = lang === 'ar'
    ? /(نام|نوم|قيلول|نمت)/.test(t)
    : /\b(sleep|slept|nap)\b/.test(t);
  if (!isSleep) return null;
  // Pull first quantity + unit pair.
  const m = t.match(/(\d+(?:[.,]\d+)?|[٠-٩]+(?:[.,٫][٠-٩]+)?)\s*(hours?|hrs?|h|min(?:utes?)?|m|ساع|ساعات|ساعة|دقيق|دقايق|دقيقة)/i);
  if (!m) {
    // "an hour" / "half an hour"
    if (/(half (an )?hour|نص ساعة)/.test(t)) return { kind: 'sleep', duration_min: 30 };
    if (/(an hour|one hour|ساعة)/.test(t))    return { kind: 'sleep', duration_min: 60 };
    return null;
  }
  const n = parseNumber(m[1]);
  if (n == null) return null;
  const unit = m[2].toLowerCase();
  const isHours = /^(h|hr|hour|ساع)/.test(unit);
  const duration_min = Math.round(isHours ? n * 60 : n);
  if (duration_min < 1 || duration_min > 24 * 60) return null;
  return { kind: 'sleep', duration_min };
}

// ---------- Temperature --------------------------------------------------
function parseTemperature(t: string, lang: 'en' | 'ar'): TemperatureIntent | null {
  const isTemp = lang === 'ar'
    ? /(حرار|حمى|سخون|درجة)/.test(t)
    : /\b(temp(erature)?|fever)\b/.test(t);
  if (!isTemp) return null;
  // Look for a value between 30 and 45 °C (covers infants).
  const m = t.match(/(\d{2}(?:[.,]\d+)?|[٠-٩]{2}(?:[.,٫][٠-٩]+)?)/);
  if (!m) return null;
  const n = parseNumber(m[1]);
  if (n == null || n < 30 || n > 45) return null;
  let method: TemperatureIntent['method'] | undefined;
  if (lang === 'ar') {
    if (/(تحت ابط|إبط)/.test(t)) method = 'axillary';
    else if (/(أذن|اذن)/.test(t)) method = 'ear';
    else if (/(فم)/.test(t)) method = 'oral';
    else if (/(جبه|جبين)/.test(t)) method = 'forehead';
    else if (/(شرج)/.test(t)) method = 'rectal';
  } else {
    if (/\baxillary|under arm|underarm/.test(t)) method = 'axillary';
    else if (/\bear/.test(t)) method = 'ear';
    else if (/\boral|mouth/.test(t)) method = 'oral';
    else if (/\bforehead/.test(t)) method = 'forehead';
    else if (/\brectal/.test(t)) method = 'rectal';
  }
  return { kind: 'temperature', temperature_c: n, method };
}

// ---------- Kicks --------------------------------------------------------
function parseKick(t: string, lang: 'en' | 'ar'): KickIntent | null {
  const isKick = lang === 'ar'
    ? /(ركل|ركلة|حركة الجنين|حركة)/.test(t)
    : /\b(kick(s|ed)?|fetal movement|movement)\b/.test(t);
  if (!isKick) return null;
  const m = t.match(/(\d+|[٠-٩]+)/);
  const count = m ? parseNumber(m[1]) ?? 1 : 1;
  return { kind: 'kick', count: Math.max(1, Math.min(99, count)) };
}

// ---------- Medication ---------------------------------------------------
// Patterns we accept (loose):
//   English:
//     "gave panadol"
//     "took 5ml of augmentin"
//     "skipped the antibiotic"
//     "missed iron drops"
//     "augmentin 5ml dose"
//     "logged the dose of panadol"
//   Egyptian Arabic:
//     «أعطيت بانادول»
//     «جرعة أوجمنتين»
//     «اتاخدت جرعة بنادول»
//     «نسيت دواء الكحة»
//     «خطّيت أوجمنتين»
//     «دواء البنادول»
//
// The parser's job is to (1) confirm the utterance is medication-y,
// (2) decide status, (3) extract optional dosage, and (4) leave the
// remaining noun phrase as the medication name. Matching that name
// to an actual prescription happens in the UI layer.
function parseMedication(t: string, lang: 'en' | 'ar'): MedicationIntent | null {
  const isMed = lang === 'ar'
    ? /(دواء|الدواء|أدوية|جرعة|أعط|إعط|أعطي|اعطيت|اتاخد|اتجرع|تجرع|بنادول|بانادول|أوجمنتين|أوجمنتن|باراسيتام|كلاريتين|سيتال|بروفين|نيوروفين|سيريتايد|نازوكير|نوفالدول|تيلينول|أنتيبيوتيك|مضاد حيوي|قطرة|نقطة|فيتامين|شراب|قرص)/.test(t)
    : /\b(med(ication)?s?|medicine|drug|dose|pill|tablet|tab|capsule|antibiotic|prescription|drops?|suppository|syrup|panadol|tylenol|paracetamol|augmentin|amoxicillin|amoxi|claritin|nurofen|brufen|ibuprofen|tylonel|prednisolone|ventolin|neurofen|gave|administered|took|taken)\b/.test(t);
  if (!isMed) return null;

  // Status — default taken.
  let status: MedicationIntent['status'] = 'taken';
  if (lang === 'ar') {
    if (/(تخطي|خطّ|خطي|تخطّ|تخطيت|اتخطّ)/.test(t))      status = 'skipped';
    else if (/(فات|نسي|ضاع|اتنسي)/.test(t))              status = 'missed';
  } else {
    if (/\b(skipped|skip)\b/.test(t))                     status = 'skipped';
    else if (/\b(missed|miss|forgot|forgotten)\b/.test(t)) status = 'missed';
  }

  // Dosage — match before stripping so the name extraction sees a
  // cleaner string. Common forms: "5ml", "5 ml", "10 mg", "1 tab",
  // "half tab", "2 drops", «نصف»، «ربع»، «نقطة»، «قطرة».
  let dosage: string | undefined;
  let dosageMatch: string | null = null;
  const numUnit = t.match(/(\d+(?:[.,]\d+)?|[٠-٩]+(?:[.,٫][٠-٩]+)?)\s*(ml|مل|ميلي|cc|mg|ملغ|tab(?:let)?s?|cap(?:sule)?s?|drops?|drop|قطرة|نقطة|قطرات|نقطات|قرص|قرصات|كبسولة|كبسولات|spoon|spoons?|ملعقة|ملاعق)/i);
  if (numUnit) {
    const n = parseNumber(numUnit[1]);
    const unit = numUnit[2];
    if (n != null) {
      dosage = `${n}${/^\s*\d/.test(numUnit[0]) ? '' : ''}${unit.toLowerCase().startsWith('ml') ? ' ml' : unit.toLowerCase().startsWith('mg') ? ' mg' : ' ' + unit.replace(/\s+/g, '').toLowerCase()}`;
      dosage = dosage.trim();
      dosageMatch = numUnit[0];
    }
  } else {
    // Fractional doses ("half tab", "نصف ملعقة")
    const halfEn = t.match(/\b(half|quarter)\s+(tab(?:let)?|cap(?:sule)?|spoon|drop|dose)\b/);
    const halfAr = t.match(/(نص|نصف|ربع)\s+(ملعقة|قرص|كبسولة|قطرة)/);
    if (halfEn) { dosage = `${halfEn[1]} ${halfEn[2]}`; dosageMatch = halfEn[0]; }
    else if (halfAr) { dosage = `${halfAr[1]} ${halfAr[2]}`; dosageMatch = halfAr[0]; }
  }

  // Strip the keywords + dosage so the residue becomes the name query.
  let residue = t;
  if (dosageMatch) residue = residue.replace(dosageMatch, ' ');
  // Trigger verbs / particles to remove before name extraction. We
  // intentionally KEEP class nouns ("antibiotic", "vitamin", "drops",
  // "syrup", "دواء") in the residue — when the user says "skipped
  // the antibiotic", the resulting name_query "antibiotic" is what
  // surfaces in the friendly "no match found, please say the name"
  // error. Better than returning null.
  //
  // JS's \b is ASCII-only, so for Arabic we use lookarounds with the
  // Unicode property `\p{L}` (any letter) to define word boundaries.
  const noise = lang === 'ar'
    ? /(?<![\p{L}])(اعطيت|أعطيت|أعطيتى|أعطيتي|اعطيتى|اعطيتي|أعطى|اعط|اتاخد|اتاخدت|اتجرع|تجرع|تخطي|تخطيت|تخطّيت|خطّ|خطي|تخطّ|اتخطّ|اتخطيت|فاتت|فات|نسيت|نسي|سجّل|سجل|سجّلي|سجلي|من)(?![\p{L}])/gu
    : /\b(gave|administered|gives?|takes|took|taken|skipped|skip|missed|miss|forgot|forgotten|logged?|logs?|the|of|a|an|just|now|already|please|i|to|baby|her|his)\b/g;
  residue = residue
    .replace(noise, ' ')
    // Drop standalone digit runs (Western + Eastern Arabic) — keeps
    // any digits that survived as noise from corrupting the name.
    .replace(/\b\d+(?:[.,]\d+)?\b/g, ' ')
    .replace(/[٠-٩]+(?:[.,٫][٠-٩]+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Drop any leading prepositions / particles.
  residue = residue.replace(/^(of|the|a|an|الـ|ال|من)\s+/i, '').trim();

  if (!residue) return null;

  // Cap the name to a reasonable length — anything more than 6 words
  // is almost certainly noise.
  const words = residue.split(/\s+/).slice(0, 6);
  return { kind: 'medication', name_query: words.join(' '), status, dosage };
}

// ---------- Note ---------------------------------------------------------
function parseNote(t: string, lang: 'en' | 'ar'): NoteIntent | null {
  const m = lang === 'ar'
    ? t.match(/^(?:ملاحظ\w*|اكتب|دوّن)\s+(.+)$/i)
    : t.match(/^(?:add\s+a?\s*note|note(?:\s+that)?)\s+(.+)$/i);
  if (!m) return null;
  return { kind: 'note', text: m[1].trim() };
}

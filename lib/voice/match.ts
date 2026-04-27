// Fuzzy matcher for "the name I just spoke" → "an active medication
// in the database". Built specifically for medication name lookups
// in the voice commander but kept generic so we can reuse for other
// nouns later (allergens, doctors).
//
// Strategy:
//   1. Normalise both sides — lowercase, strip Latin accents and
//      Arabic diacritics, drop common prepositions ("the", «الـ», "of").
//   2. Score by, in order:
//        - exact match                → 100
//        - normalised query == normalised name → 100
//        - one contains the other     → 80 - len_diff
//        - Levenshtein distance ≤ 2   → 60 - distance*10
//      Anything below 50 is dropped.
//   3. Sort by score desc, length-difference asc.

const ARTICLES_PARTICLES = /\b(the|of|a|an|من|في|الـ|ال|دواء|الدواء)\b/g;
const DIACRITICS = /[ً-ٰٟۖ-ۭ̀-ͯ]/g;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(/[إأآا]/g, 'ا')   // unify Arabic alef variants
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(ARTICLES_PARTICLES, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance (small strings — naive O(mn) is fine). */
function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export type FuzzyHit<T> = { item: T; score: number; reason: 'exact' | 'contains' | 'levenshtein' };

/**
 * Score a query against an array of candidates and return the
 * passable matches sorted best-first. `getName` extracts the
 * comparable string from each candidate.
 */
export function fuzzyMatchByName<T>(
  query: string,
  candidates: T[],
  getName: (t: T) => string,
): FuzzyHit<T>[] {
  const q = norm(query);
  if (!q) return [];
  const out: FuzzyHit<T>[] = [];
  for (const c of candidates) {
    const raw = getName(c);
    const n = norm(raw);
    if (!n) continue;
    if (n === q) {
      out.push({ item: c, score: 100, reason: 'exact' });
      continue;
    }
    if (n.includes(q) || q.includes(n)) {
      const lenDiff = Math.abs(n.length - q.length);
      out.push({ item: c, score: Math.max(50, 80 - lenDiff), reason: 'contains' });
      continue;
    }
    // Token-level overlap — handle "iron drops" matching "Iron Drops 5mg".
    const qTokens = new Set(q.split(' '));
    const nTokens = new Set(n.split(' '));
    let shared = 0;
    for (const t of qTokens) if (nTokens.has(t)) shared++;
    if (shared > 0) {
      const score = 50 + Math.min(20, shared * 8);
      out.push({ item: c, score, reason: 'contains' });
      continue;
    }
    // Levenshtein for short strings.
    if (q.length <= 16 && n.length <= 16) {
      const d = lev(q, n);
      if (d <= 2) out.push({ item: c, score: 60 - d * 10, reason: 'levenshtein' });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

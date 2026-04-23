// All storage is in metric. Display conversion helpers live here.
// Postgres numeric columns arrive as strings over the wire via supabase-js,
// so every formatter coerces to Number first and bails on NaN.

export const ML_PER_OZ = 29.5735;
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export function mlToOz(ml: number) { return ml / ML_PER_OZ; }
export function ozToMl(oz: number) { return oz * ML_PER_OZ; }
export function kgToLb(kg: number) { return kg / KG_PER_LB; }
export function cmToIn(cm: number) { return cm / CM_PER_IN; }

type Num = number | string | null | undefined;
function num(n: Num): number | null {
  if (n == null || n === '') return null;
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : null;
}

export function fmtMl(v: Num) {
  const n = num(v);
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)} L`;
  return `${Math.round(n)} ml`;
}

export function fmtKg(v: Num) {
  const n = num(v);
  if (n == null) return '—';
  return `${n.toFixed(2)} kg`;
}

export function fmtCm(v: Num) {
  const n = num(v);
  if (n == null) return '—';
  return `${n.toFixed(1)} cm`;
}

export function fmtPct(v: Num) {
  const n = num(v);
  if (n == null) return '—';
  return `${n.toFixed(0)}%`;
}

// Recommended daily feed. Matches the Postgres formula 1:1.
export function recommendedDailyMl(weightKg: Num, factor: Num = 150) {
  const w = num(weightKg); const f = num(factor);
  if (w == null || f == null) return 0;
  return Math.round(w * f);
}

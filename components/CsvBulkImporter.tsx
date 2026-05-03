'use client';

// CsvBulkImporter — Wave 27. One generic CSV bulk-import flow that
// handles seven tabular categories by routing to existing import RPCs:
//
//   - cycles   → import_menstrual_cycles
//   - weight   → import_apple_weight
//   - bbt      → import_apple_bbt
//   - sleep    → import_apple_sleep
//   - bp       → import_apple_bp
//   - glucose  → import_apple_glucose
//   - vitals   → import_vitals_bulk    (full BP + HR + SpO2 row)
//
// User flow:
//   1. Pick a category.
//   2. (Optional) Click "Download template" — gets a CSV with the
//      headers the parser expects + one example row.
//   3. Paste CSV into the textarea OR upload a .csv file (drop-zone +
//      file picker). Both routes feed the same parse step.
//   4. Preview table shows up to 25 rows + total count + any rows that
//      failed validation (highlighted with the reason).
//   5. Click "Import N rows" — server upserts in 200-row chunks.
//
// Idempotency: each row gets a deterministic source_uuid derived from
// its content (e.g. `csv:weight:2024-09-01T00:00:00Z`) so re-importing
// the same file is a no-op via the (baby_id, source, source_uuid)
// partial unique indexes. For cycles, the natural key (baby_id,
// period_start) covers it.
//
// CSV parser is a tiny in-file implementation — splits on newlines,
// then on commas, with simple "quoted field" support. No external
// dependency; the file format is expected to be straightforward.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, Download, Loader2, Check, AlertCircle, ArrowRight,
  Calendar, Heart, Activity, Moon, Droplet, FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Category catalogue. Adding a new category = add a row here + (if not
// yet) a server-side import RPC. The headers array is the source of
// truth for the parser, the template, and the preview columns.
// ─────────────────────────────────────────────────────────────────────────────
type CatKey = 'cycles' | 'weight' | 'bbt' | 'sleep' | 'bp' | 'glucose' | 'vitals';

interface CategoryDef {
  key:     CatKey;
  label:   string;
  ar:      string;
  icon:    React.ComponentType<{ className?: string }>;
  tint:    'coral' | 'lavender' | 'brand' | 'peach' | 'mint';
  rpc:     string;
  /** Headers the CSV must have (in any order, but exact spelling). */
  headers: string[];
  /** Headers that are required (not nullable). */
  required: string[];
  /** One example row joined with commas — used by the template button. */
  example: string;
  /** Build the JSON record that ships to the RPC from a parsed row. */
  build:   (r: Record<string, string>, idx: number) => Record<string, unknown> | null;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'cycles', label: 'Cycle history', ar: 'تاريخ الدورة',
    icon: Calendar, tint: 'coral', rpc: 'import_menstrual_cycles',
    headers:  ['period_start', 'period_end', 'flow_intensity', 'cycle_length', 'symptoms', 'notes'],
    required: ['period_start'],
    example:  '2024-09-03,2024-09-08,medium,28,"cramps, headache","felt tired day 2"',
    build: (r) => {
      if (!r.period_start) return null;
      return {
        period_start:   r.period_start,
        period_end:     r.period_end || null,
        flow_intensity: r.flow_intensity || null,
        cycle_length:   r.cycle_length ? Number(r.cycle_length) : null,
        symptoms:       r.symptoms ? r.symptoms.split(/[,;|]/).map(s => s.trim()).filter(Boolean) : null,
        notes:          r.notes || null,
        source_uuid:    `csv:cycles:${r.period_start}`,
      };
    },
  },
  {
    key: 'weight', label: 'Body weight', ar: 'الوزن',
    icon: Heart, tint: 'peach', rpc: 'import_apple_weight',
    headers:  ['measured_at', 'weight_kg'],
    required: ['measured_at', 'weight_kg'],
    example:  '2024-09-01T08:00:00Z,68.4',
    build: (r) => {
      if (!r.measured_at || !r.weight_kg) return null;
      const v = Number(r.weight_kg);
      if (!Number.isFinite(v) || v <= 0) return null;
      return {
        measured_at: r.measured_at,
        weight_kg:   v,
        source_uuid: `csv:weight:${r.measured_at}`,
      };
    },
  },
  {
    key: 'bbt', label: 'BBT (basal body temp)', ar: 'حرارة الجسم القاعدية',
    icon: Activity, tint: 'brand', rpc: 'import_apple_bbt',
    headers:  ['measured_at', 'celsius'],
    required: ['measured_at', 'celsius'],
    example:  '2024-09-01T05:30:00Z,36.62',
    build: (r) => {
      if (!r.measured_at || !r.celsius) return null;
      const c = Number(r.celsius);
      if (!Number.isFinite(c) || c < 34 || c > 41) return null;
      return {
        measured_at: r.measured_at,
        celsius:     c,
        source_uuid: `csv:bbt:${r.measured_at}`,
      };
    },
  },
  {
    key: 'sleep', label: 'Sleep nights', ar: 'النوم',
    icon: Moon, tint: 'lavender', rpc: 'import_apple_sleep',
    headers:  ['start_at', 'end_at'],
    required: ['start_at', 'end_at'],
    example:  '2024-09-01T23:15:00Z,2024-09-02T07:05:00Z',
    build: (r) => {
      if (!r.start_at || !r.end_at) return null;
      return {
        start_at:    r.start_at,
        end_at:      r.end_at,
        source_uuid: `csv:sleep:${r.start_at}`,
      };
    },
  },
  {
    key: 'bp', label: 'Blood pressure', ar: 'ضغط الدم',
    icon: Heart, tint: 'coral', rpc: 'import_apple_bp',
    headers:  ['measured_at', 'systolic', 'diastolic'],
    required: ['measured_at'],
    example:  '2024-09-01T09:00:00Z,118,76',
    build: (r) => {
      if (!r.measured_at) return null;
      const sys = r.systolic  ? Number(r.systolic)  : null;
      const dia = r.diastolic ? Number(r.diastolic) : null;
      if (sys != null && (sys < 40 || sys > 250)) return null;
      if (dia != null && (dia < 20 || dia > 180)) return null;
      if (sys == null && dia == null) return null;
      return {
        measured_at: r.measured_at,
        systolic:    sys,
        diastolic:   dia,
        source_uuid: `csv:bp:${r.measured_at}`,
      };
    },
  },
  {
    key: 'glucose', label: 'Blood glucose', ar: 'سكر الدم',
    icon: Droplet, tint: 'mint', rpc: 'import_apple_glucose',
    headers:  ['measured_at', 'value_mgdl'],
    required: ['measured_at', 'value_mgdl'],
    example:  '2024-09-01T12:30:00Z,95',
    build: (r) => {
      if (!r.measured_at || !r.value_mgdl) return null;
      const v = Number(r.value_mgdl);
      if (!Number.isFinite(v) || v < 20 || v > 800) return null;
      return {
        measured_at: r.measured_at,
        value_mgdl:  v,
        source_uuid: `csv:glucose:${r.measured_at}`,
      };
    },
  },
  {
    key: 'vitals', label: 'Full vital signs (BP + HR + SpO2)', ar: 'مؤشرات حيوية كاملة',
    icon: Activity, tint: 'coral', rpc: 'import_vitals_bulk',
    headers:  ['measured_at', 'systolic', 'diastolic', 'heart_rate_bpm', 'oxygen_pct', 'position'],
    required: ['measured_at'],
    example:  '2024-09-01T09:00:00Z,118,76,72,98,sitting',
    build: (r) => {
      if (!r.measured_at) return null;
      // The server skips rows where every value column is null.
      return {
        measured_at:    r.measured_at,
        systolic:       r.systolic       || '',
        diastolic:      r.diastolic      || '',
        heart_rate_bpm: r.heart_rate_bpm || '',
        oxygen_pct:     r.oxygen_pct     || '',
        position:       r.position       || '',
        source_uuid:    `csv:vitals:${r.measured_at}`,
      };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function CsvBulkImporter({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [catKey, setCatKey] = useState<CatKey>('cycles');
  const [csv, setCsv]       = useState('');
  const [stage, setStage]   = useState<'idle' | 'importing' | 'done'>('idle');
  const [err, setErr]       = useState<string | null>(null);
  const [imported, setImported] = useState(0);

  const cat = CATEGORIES.find(c => c.key === catKey)!;

  // Parse + validate live so the preview reflects the textarea.
  const parsed = useMemo(() => parseAndBuild(csv, cat), [csv, cat]);

  function downloadTemplate() {
    const text = cat.headers.join(',') + '\n' + cat.example + '\n';
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `babylytics-${cat.key}-template.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function onFile(f: File) {
    setErr(null);
    if (!f.name.toLowerCase().endsWith('.csv') && f.type !== 'text/csv') {
      setErr(isAr ? 'الملف يجب أن يكون .csv' : 'File must be a .csv');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setErr(isAr ? 'الملف أكبر من 10 ميجا' : 'File over 10 MB');
      return;
    }
    const text = await f.text();
    setCsv(text);
  }

  async function commit() {
    if (parsed.records.length === 0) return;
    setStage('importing');
    setErr(null);
    const supabase = createClient();
    const CHUNK = 200;
    let total = 0;
    for (let i = 0; i < parsed.records.length; i += CHUNK) {
      const chunk = parsed.records.slice(i, i + CHUNK);
      const { error } = await supabase.rpc(cat.rpc, { p_baby: babyId, p_records: chunk });
      if (error) {
        setErr(error.message);
        setStage('idle');
        return;
      }
      total += chunk.length;
      setImported(total);
    }
    setStage('done');
    router.refresh();
  }

  if (stage === 'done') {
    return (
      <div className="rounded-2xl border border-mint-200 bg-mint-50/60 p-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-full bg-mint-500 text-white grid place-items-center mb-3">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold text-ink-strong">
          {isAr ? `تم استيراد ${imported} سجل` : `Imported ${imported} ${imported === 1 ? 'row' : 'rows'}`}
        </h3>
        <p className="mt-2 text-sm text-ink-muted">
          {isAr ? 'البيانات الآن متاحة في صفحة الفئة المعنية.' : 'Your data is now live on the relevant log page.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Category picker */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted mb-3">
          {isAr ? '١. اختاري الفئة' : '1. Pick a category'}
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {CATEGORIES.map(c => {
            const active = c.key === catKey;
            const Icon = c.icon;
            return (
              <button key={c.key} type="button" onClick={() => { setCatKey(c.key); setCsv(''); setErr(null); }}
                className={`flex items-center gap-3 rounded-xl border p-3 text-start transition ${
                  active ? 'border-coral-300 bg-coral-50/40' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${tintCls(c.tint)}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-ink-strong">{isAr ? c.ar : c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Template + paste/upload */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? '٢. الصقي CSV أو ارفعي ملف' : '2. Paste CSV or upload a file'}
          </h3>
          <button type="button" onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-ink px-3 py-1.5">
            <Download className="h-3 w-3" /> {isAr ? 'حمّلي القالب' : 'Download template'}
          </button>
        </div>

        <div className="text-[11px] text-ink-muted mb-2 break-words">
          <span className="font-semibold">{isAr ? 'الأعمدة المطلوبة:' : 'Headers expected:'}</span>{' '}
          <code className="font-mono text-ink">{cat.headers.join(',')}</code>
        </div>

        <textarea
          value={csv}
          onChange={e => setCsv(e.target.value)}
          rows={8}
          spellCheck={false}
          dir="ltr"
          placeholder={cat.headers.join(',') + '\n' + cat.example}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-xs font-mono text-ink focus:bg-white focus:border-coral-300 focus:ring-2 focus:ring-coral-100 outline-none" />

        <label className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-ink px-3 py-1.5 cursor-pointer">
          <Upload className="h-3 w-3" /> {isAr ? 'أو ارفعي ملف .csv' : 'Or upload a .csv file'}
          <input type="file" accept=".csv,text/csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      </section>

      {/* Preview */}
      {csv.trim() && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-ink-muted mb-1">
              {isAr ? '٣. المعاينة' : '3. Preview'}
            </h3>
            <p className="text-xs text-ink-muted">
              {isAr
                ? `${parsed.records.length} صف صالح، ${parsed.skipped.length} صف مرفوض${parsed.missingHeaders.length > 0 ? '، أعمدة ناقصة' : ''}`
                : `${parsed.records.length} valid row${parsed.records.length === 1 ? '' : 's'}, ${parsed.skipped.length} skipped${parsed.missingHeaders.length > 0 ? ', missing headers' : ''}`}
            </p>
          </div>

          {parsed.missingHeaders.length > 0 && (
            <div className="m-5 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-700">
              <strong>{isAr ? 'أعمدة ناقصة:' : 'Missing headers:'}</strong>{' '}
              <code className="font-mono">{parsed.missingHeaders.join(', ')}</code>
            </div>
          )}

          {parsed.records.length > 0 && (
            <div className="px-5 pb-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-muted text-[10px] uppercase tracking-wider">
                    {cat.headers.map(h => (
                      <th key={h} className="text-start font-semibold px-2 py-1.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-ink">
                  {parsed.previewRows.slice(0, 25).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {cat.headers.map(h => (
                        <td key={h} className="px-2 py-1.5 font-mono whitespace-nowrap">{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.records.length > 25 && (
                <div className="mt-2 text-[10px] text-ink-muted">
                  {isAr ? `+ ${parsed.records.length - 25} صف آخر…` : `+ ${parsed.records.length - 25} more rows…`}
                </div>
              )}
            </div>
          )}

          {parsed.skipped.length > 0 && (
            <div className="m-5 rounded-xl border border-peach-200 bg-peach-50/60 p-3 text-xs text-peach-700 max-h-40 overflow-y-auto">
              <strong>{isAr ? 'صفوف مرفوضة:' : 'Skipped rows:'}</strong>
              <ul className="mt-1 space-y-0.5">
                {parsed.skipped.slice(0, 10).map((s, i) => (
                  <li key={i}>
                    {isAr ? `سطر ${s.line}` : `Line ${s.line}`}: {s.reason}
                  </li>
                ))}
                {parsed.skipped.length > 10 && (
                  <li>{isAr ? `+ ${parsed.skipped.length - 10} غيرها` : `+ ${parsed.skipped.length - 10} more`}</li>
                )}
              </ul>
            </div>
          )}

          <div className="p-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
            <button type="button" onClick={() => setCsv('')}
              className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
              {isAr ? 'مسح' : 'Clear'}
            </button>
            <button type="button" onClick={commit}
              disabled={parsed.records.length === 0 || stage === 'importing'}
              className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {stage === 'importing'
                ? (<><Loader2 className="h-4 w-4 animate-spin" /> {isAr ? `جارٍ الحفظ ${imported}/${parsed.records.length}` : `Saving ${imported}/${parsed.records.length}`}</>)
                : (<>{isAr ? `استيراد ${parsed.records.length} صف` : `Import ${parsed.records.length} row${parsed.records.length === 1 ? '' : 's'}`} <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </div>
        </section>
      )}

      {err && (
        <div className="rounded-2xl border border-coral-200 bg-coral-50 p-4 text-sm text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs text-ink-muted leading-relaxed">
        <FileText className="h-3.5 w-3.5 inline-block me-1.5" />
        {isAr
          ? 'الملفات والسونار وألواح التحاليل التي فيها عدة نتائج تستخدم صفحات الملفات / التحاليل العادية — هذه الصفحة لبيانات جدولية متكررة فقط.'
          : 'Files, scans, and lab panels with multi-result rows go through the regular Files / Labs pages — this page is for repetitive tabular data only.'}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const TINT_CLS: Record<'coral' | 'lavender' | 'brand' | 'peach' | 'mint', string> = {
  coral:    'bg-coral-100 text-coral-700',
  lavender: 'bg-lavender-100 text-lavender-700',
  brand:    'bg-brand-100 text-brand-700',
  peach:    'bg-peach-100 text-peach-700',
  mint:     'bg-mint-100 text-mint-700',
};
function tintCls(t: 'coral' | 'lavender' | 'brand' | 'peach' | 'mint'): string { return TINT_CLS[t]; }

interface ParseOutput {
  records:        Record<string, unknown>[];
  previewRows:    Record<string, string>[];
  skipped:        { line: number; reason: string }[];
  missingHeaders: string[];
}

/** Parse the CSV into rows + validate against the category. */
function parseAndBuild(csv: string, cat: CategoryDef): ParseOutput {
  if (!csv.trim()) {
    return { records: [], previewRows: [], skipped: [], missingHeaders: [] };
  }
  const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 1) {
    return { records: [], previewRows: [], skipped: [], missingHeaders: cat.headers };
  }

  const header = splitCsvLine(lines[0]).map(h => h.trim());
  const missing = cat.headers.filter(h => cat.required.includes(h) && !header.includes(h));

  const records: Record<string, unknown>[] = [];
  const previewRows: Record<string, string>[] = [];
  const skipped: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim(); });

    // Validate required columns are present in the row.
    const missingCells = cat.required.filter(h => !row[h]);
    if (missingCells.length > 0) {
      skipped.push({ line: i + 1, reason: `missing ${missingCells.join(', ')}` });
      continue;
    }

    const rec = cat.build(row, i);
    if (!rec) {
      skipped.push({ line: i + 1, reason: 'invalid value (out of range or unparseable)' });
      continue;
    }
    records.push(rec);
    previewRows.push(row);
  }

  return { records, previewRows, skipped, missingHeaders: missing };
}

/** Minimal CSV line splitter — handles double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }       // escaped quote
      else if (ch === '"') { inQuote = false; }
      else                 { cur += ch; }
    } else {
      if (ch === ',')      { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuote = true; }
      else                 { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

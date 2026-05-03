'use client';

// AppleHealthImporter — drag-drop the export.zip from Apple Health.
// Parses CLIENT-SIDE so the user's full health data never leaves their
// browser until they confirm the cycle subset. Then submits a compact
// jsonb array to import_menstrual_cycles RPC for upsert.
//
// V1 scope: cycle data only (HKCategoryTypeIdentifierMenstrualFlow).
// Other categories (sleep, BBT, weight, BP, glucose) parse fine but are
// shown as "detected but not yet importable" in the preview so users
// know what's coming next wave.
//
// File-size guard: we hard-cap at 100 MB. Larger exports usually mean
// users have years of workout / heart-rate data we don't ingest anyway —
// a server-side streaming import would be the right move there.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, Loader2, Check, AlertCircle, Calendar, Moon,
  Activity, Heart, Droplet, ArrowRight, Smartphone,
} from 'lucide-react';

interface CycleRecord {
  period_start: string;       // YYYY-MM-DD
  period_end: string | null;
  flow_intensity: 'light' | 'medium' | 'heavy' | null;
  source_uuid: string;
}
interface WeightRecord  { measured_at: string; weight_kg: number;            source_uuid: string; }
interface BbtRecord     { measured_at: string; celsius:  number;             source_uuid: string; }
interface SleepRecord   { start_at: string;   end_at: string | null;         source_uuid: string; }
interface BpRecord      { measured_at: string; systolic: number | null;
                          diastolic: number | null;                          source_uuid: string; }
interface GlucoseRecord { measured_at: string; value_mgdl: number;           source_uuid: string; }

interface ParseResult {
  cycles:   CycleRecord[];
  weights:  WeightRecord[];
  bbts:     BbtRecord[];
  sleeps:   SleepRecord[];
  bps:      BpRecord[];
  glucoses: GlucoseRecord[];
  detected: {
    cycle_days: number;
    sleep_nights: number;
    weight_entries: number;
    bp_entries: number;
    glucose_entries: number;
    bbt_entries: number;
  };
}

const APPLE_FLOW_TO_OUR: Record<string, CycleRecord['flow_intensity']> = {
  HKCategoryValueMenstrualFlowLight:    'light',
  HKCategoryValueMenstrualFlowMedium:   'medium',
  HKCategoryValueMenstrualFlowHeavy:    'heavy',
  HKCategoryValueMenstrualFlowUnspecified: null,
};

export function AppleHealthImporter({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'parsing' | 'preview' | 'importing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  // Wave 21: per-category opt-in. All six importable categories default
  // ON (cycles, weight, BBT, sleep, BP, glucose) — user can untick any
  // before commit.
  const [selected, setSelected] = useState({
    cycles: true, weights: true, bbts: true, sleeps: true, bps: true, glucoses: true,
  });

  async function handleFile(file: File) {
    setErr(null);
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setErr('Please upload your Apple Health export — a .zip file. Health → Profile → Export All Health Data.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setErr('File over 100 MB. Trim your export by date range and try again, or wait for the native app.');
      return;
    }
    setStage('parsing');
    setProgress(5);
    try {
      // Lazy-load JSZip + fast-xml-parser only when the user actually
      // imports — keeps the rest of the app's bundle small.
      const [{ default: JSZip }, { XMLParser }] = await Promise.all([
        import('jszip'),
        import('fast-xml-parser'),
      ]);

      setProgress(15);
      const zip = await JSZip.loadAsync(file);
      const xmlFile = zip.file('apple_health_export/export.xml') ?? zip.file('export.xml');
      if (!xmlFile) {
        throw new Error('export.xml not found in the zip. Make sure you exported from Apple Health (Profile → Export All Health Data).');
      }
      setProgress(30);
      const xmlText = await xmlFile.async('string');
      setProgress(60);

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
        // We only want <Record> elements; skip everything else.
        isArray: (name: string) => name === 'Record',
      });
      const json = parser.parse(xmlText) as { HealthData?: { Record?: AppleRecord[] } };
      const records: AppleRecord[] = json.HealthData?.Record ?? [];

      setProgress(80);
      const result = bucketRecords(records);
      setProgress(100);
      setParsed(result);
      setStage('preview');
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : 'Could not parse the export. Is it the original Apple Health zip?');
      setStage('idle');
    }
  }

  async function commit() {
    if (!parsed) return;
    setStage('importing');
    setErr(null);
    const supabase = createClient();
    const CHUNK = 200;

    // Wave 20: import each enabled category through its own RPC, in
    // chunks. Failure on one category aborts the whole commit and bounces
    // back to preview so the user can retry. Imported counter aggregates
    // across categories so the progress feels like one job.
    let total = 0;
    type Job = { rows: unknown[]; rpc: string; label: string };
    const jobs: Job[] = [];
    if (selected.cycles && parsed.cycles.length)
      jobs.push({ rows: parsed.cycles, rpc: 'import_menstrual_cycles', label: 'cycles' });
    if (selected.weights && parsed.weights.length)
      jobs.push({ rows: parsed.weights, rpc: 'import_apple_weight',     label: 'weight' });
    if (selected.bbts && parsed.bbts.length)
      jobs.push({ rows: parsed.bbts,    rpc: 'import_apple_bbt',        label: 'BBT' });
    if (selected.sleeps && parsed.sleeps.length)
      jobs.push({ rows: parsed.sleeps,  rpc: 'import_apple_sleep',      label: 'sleep' });
    if (selected.bps && parsed.bps.length)
      jobs.push({ rows: parsed.bps,     rpc: 'import_apple_bp',         label: 'BP' });
    if (selected.glucoses && parsed.glucoses.length)
      jobs.push({ rows: parsed.glucoses, rpc: 'import_apple_glucose',   label: 'glucose' });

    if (jobs.length === 0) {
      setStage('preview');
      setErr('Pick at least one category to import.');
      return;
    }

    for (const job of jobs) {
      for (let i = 0; i < job.rows.length; i += CHUNK) {
        const chunk = job.rows.slice(i, i + CHUNK);
        const { error } = await supabase.rpc(job.rpc, {
          p_baby: babyId,
          p_records: chunk,
        });
        if (error) {
          setErr(`${job.label}: ${error.message}`);
          setStage('preview');
          return;
        }
        total += chunk.length;
        setImportedCount(total);
      }
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
        <h3 className="text-xl font-bold text-ink-strong">Imported {importedCount} entries</h3>
        <p className="mt-2 text-sm text-ink-muted">Periods, weight, BBT, sleep, BP and glucose — whatever you ticked is now live across the planner, vital signs, and sugar log.</p>
        <a href={`/babies/${babyId}/planner`}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2.5">
          Back to my cycle <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      {stage === 'idle' && (
        <DropZone onFile={handleFile} />
      )}

      {/* Parsing progress */}
      {stage === 'parsing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-coral-600 animate-spin mb-3" />
          <p className="text-sm text-ink">Reading your export… {progress}%</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100 max-w-xs mx-auto overflow-hidden">
            <div className="h-full bg-coral-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && parsed && (
        <PreviewCard
          parsed={parsed}
          selected={selected}
          onToggle={(k, v) => setSelected(s => ({ ...s, [k]: v }))}
          onCommit={commit}
          onCancel={() => { setStage('idle'); setParsed(null); }}
        />
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-coral-600 animate-spin mb-3" />
          <p className="text-sm text-ink">
            Saving {importedCount} of{' '}
            {parsed
              ? (selected.cycles   ? parsed.cycles.length   : 0)
              + (selected.weights  ? parsed.weights.length  : 0)
              + (selected.bbts     ? parsed.bbts.length     : 0)
              + (selected.sleeps   ? parsed.sleeps.length   : 0)
              + (selected.bps      ? parsed.bps.length      : 0)
              + (selected.glucoses ? parsed.glucoses.length : 0)
              : 0} entries…
          </p>
        </div>
      )}

      {err && (
        <div className="rounded-2xl border border-coral-200 bg-coral-50 p-4 text-sm text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop zone — file input + dashed area + clear instructions for finding the
// export file in iOS Settings → Health → Profile → Export.
// ─────────────────────────────────────────────────────────────────────────────
function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => {
        e.preventDefault(); setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`rounded-3xl border-2 border-dashed p-10 text-center transition ${
        dragOver ? 'border-coral-500 bg-coral-50/40' : 'border-slate-300 bg-white'
      }`}>
      <div className="mx-auto h-14 w-14 rounded-full bg-coral-100 text-coral-600 grid place-items-center mb-3">
        <Upload className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-ink-strong">Drop your Apple Health export</h3>
      <p className="mt-1 text-sm text-ink-muted">Or pick the .zip file from your computer.</p>
      <label className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2.5 cursor-pointer">
        <Upload className="h-4 w-4" /> Choose file
        <input type="file" accept=".zip" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>

      <details className="mt-6 mx-auto max-w-md text-left">
        <summary className="text-xs font-semibold text-ink cursor-pointer hover:text-ink-strong">
          How to get the export file from your iPhone
        </summary>
        <ol className="mt-3 space-y-2 text-xs text-ink-muted leading-relaxed list-decimal list-inside">
          <li>Open the <strong>Health</strong> app on your iPhone.</li>
          <li>Tap your profile picture (top-right corner).</li>
          <li>Scroll down, tap <strong>Export All Health Data</strong>.</li>
          <li>Wait a minute — Apple builds the .zip in the background.</li>
          <li>Share it to yourself (AirDrop, email, or save to Files), then upload it here.</li>
        </ol>
      </details>

      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-mint-50 text-mint-700 text-[11px] font-semibold px-3 py-1">
        <Smartphone className="h-3 w-3" /> Native iOS / Android live sync coming later
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview — show what was detected, let user confirm or cancel.
// ─────────────────────────────────────────────────────────────────────────────
function PreviewCard({
  parsed, selected, onToggle, onCommit, onCancel,
}: {
  parsed: ParseResult;
  selected: { cycles: boolean; weights: boolean; bbts: boolean; sleeps: boolean; bps: boolean; glucoses: boolean };
  onToggle: (k: 'cycles' | 'weights' | 'bbts' | 'sleeps' | 'bps' | 'glucoses', v: boolean) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  // Total selected count for the button label.
  const total =
    (selected.cycles   ? parsed.cycles.length   : 0) +
    (selected.weights  ? parsed.weights.length  : 0) +
    (selected.bbts     ? parsed.bbts.length     : 0) +
    (selected.sleeps   ? parsed.sleeps.length   : 0) +
    (selected.bps      ? parsed.bps.length      : 0) +
    (selected.glucoses ? parsed.glucoses.length : 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-coral-50 to-lavender-50">
        <h3 className="text-lg font-bold text-ink-strong">We found this in your export</h3>
        <p className="text-sm text-ink-muted mt-0.5">Tick what you want to import — anything left unticked stays out.</p>
      </div>
      <div className="p-5 space-y-2">
        {/* Importable categories with toggles. */}
        <ToggleRow
          icon={Calendar} tint="coral" label="Period entries"
          value={`${parsed.cycles.length} day${parsed.cycles.length === 1 ? '' : 's'}`}
          checked={selected.cycles} disabled={parsed.cycles.length === 0}
          onChange={v => onToggle('cycles', v)}
          note="Upserts into your cycle log. Idempotent — re-importing is a no-op." />
        <ToggleRow
          icon={Heart} tint="peach" label="Body weight"
          value={`${parsed.weights.length} entr${parsed.weights.length === 1 ? 'y' : 'ies'}`}
          checked={selected.weights} disabled={parsed.weights.length === 0}
          onChange={v => onToggle('weights', v)}
          note="Lands in measurements (kg). Useful for postpartum + cycle weight tracking." />
        <ToggleRow
          icon={Activity} tint="brand" label="BBT (basal body temp)"
          value={`${parsed.bbts.length} reading${parsed.bbts.length === 1 ? '' : 's'}`}
          checked={selected.bbts} disabled={parsed.bbts.length === 0}
          onChange={v => onToggle('bbts', v)}
          note="Stored alongside your measurements. Auto-converted F → C when needed." />
        <ToggleRow
          icon={Moon} tint="lavender" label="Sleep nights"
          value={`${parsed.sleeps.length} segment${parsed.sleeps.length === 1 ? '' : 's'}`}
          checked={selected.sleeps} disabled={parsed.sleeps.length === 0}
          onChange={v => onToggle('sleeps', v)}
          note='Each "asleep" segment from Apple becomes one sleep_log row. In-bed-only segments are skipped to avoid double-counting.' />
        <ToggleRow
          icon={Heart} tint="coral" label="Blood pressure"
          value={`${parsed.bps.length} reading${parsed.bps.length === 1 ? '' : 's'}`}
          checked={selected.bps} disabled={parsed.bps.length === 0}
          onChange={v => onToggle('bps', v)}
          note="Systolic + diastolic merged into one vital-signs row per reading time." />
        <ToggleRow
          icon={Droplet} tint="mint" label="Blood glucose"
          value={`${parsed.glucoses.length} reading${parsed.glucoses.length === 1 ? '' : 's'}`}
          checked={selected.glucoses} disabled={parsed.glucoses.length === 0}
          onChange={v => onToggle('glucoses', v)}
          note="Lands in your sugar log. mmol/L is auto-converted to mg/dL on the way in." />
      </div>
      <div className="p-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
          Cancel
        </button>
        <button type="button" onClick={onCommit} disabled={total === 0}
          className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
          Import {total} {total === 1 ? 'entry' : 'entries'}
        </button>
      </div>
    </div>
  );
}

/** Per-category toggle row in the preview. Disabled when count is 0 or
 *  when the category is still deferred (BP / glucose). */
function ToggleRow({
  icon: Icon, tint, label, value, note, checked, disabled, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'lavender' | 'brand' | 'peach' | 'mint';
  label: string;
  value: string;
  note: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const tintCls = {
    coral:    'bg-coral-100 text-coral-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    brand:    'bg-brand-100 text-brand-700',
    peach:    'bg-peach-100 text-peach-700',
    mint:     'bg-mint-100 text-mint-700',
  }[tint];
  return (
    <label className={`flex items-start gap-3 rounded-xl border p-3 transition ${
      disabled
        ? 'border-slate-100 bg-slate-50/40 opacity-60 cursor-not-allowed'
        : checked
          ? 'border-coral-300 bg-coral-50/40'
          : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
    }`}>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-coral-500 focus:ring-coral-500 shrink-0" />
      <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${tintCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink-strong text-sm">{label}</span>
          <span className="text-xs text-ink-muted">·</span>
          <span className="text-sm font-bold text-ink-strong">{value}</span>
        </div>
        <p className="text-[11px] text-ink-muted mt-0.5">{note}</p>
      </div>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Apple HealthKit XML record. Only the attributes we use.
// ─────────────────────────────────────────────────────────────────────────────
interface AppleRecord {
  type: string;
  startDate: string;
  endDate: string;
  value?: string;
  unit?: string;
  HKMetadataKeyHealthKitUUID?: string;
}

/** Bucket Apple Health <Record> rows by category. Wave 21: also extracts
 *  BP pairs (merged by start time) and glucose readings (mmol/L → mg/dL).
 *  Every importable category produces a typed record array; the
 *  `detected` block keeps a count snapshot for the preview header. */
function bucketRecords(records: AppleRecord[]): ParseResult {
  const cycles:   CycleRecord[]   = [];
  const weights:  WeightRecord[]  = [];
  const bbts:     BbtRecord[]     = [];
  const sleeps:   SleepRecord[]   = [];
  const glucoses: GlucoseRecord[] = [];
  // BP pairs by (startDate) — Apple emits systolic and diastolic as two
  // sibling Records that share a startDate. We merge them here so each
  // upserted row carries both numbers when available.
  const bpByTime = new Map<string, BpRecord>();

  // Apple BodyMass values can be in kg or lb depending on the source.
  // We normalise to kg for our schema. Almost all sources export in
  // kg/g; the unit attribute tells us when it's not.
  function kgFromAppleWeight(value: number, unit?: string): number {
    if (!unit) return value;
    const u = unit.toLowerCase();
    if (u.includes('lb') || u === 'lbs') return value * 0.45359237;
    if (u === 'g' || u === 'gram')        return value / 1000;
    return value; // kg
  }
  // Apple BBT in Celsius or Fahrenheit. Schema requires C.
  function celsiusFromAppleTemp(value: number, unit?: string): number {
    if (!unit) return value;
    const u = unit.toLowerCase();
    if (u.includes('degf') || u === 'f' || u === '°f') return (value - 32) * 5 / 9;
    return value;
  }
  // Apple Blood Glucose comes in mg/dL (US) or mmol/L (most of the rest).
  // Our schema stores mg/dL — multiply mmol/L by 18.0182 on the way in.
  function mgdlFromAppleGlucose(value: number, unit?: string): number {
    if (!unit) return value;
    const u = unit.toLowerCase();
    if (u.includes('mmol')) return value * 18.0182;
    return value;
  }

  function uuidOr(r: AppleRecord, fallback: string): string {
    return r.HKMetadataKeyHealthKitUUID ?? fallback;
  }

  for (const r of records) {
    switch (r.type) {
      case 'HKCategoryTypeIdentifierMenstrualFlow': {
        const flow: CycleRecord['flow_intensity'] =
          r.value ? (APPLE_FLOW_TO_OUR[r.value] ?? null) : null;
        const dateOnly = r.startDate.slice(0, 10);
        cycles.push({
          period_start: dateOnly,
          period_end: null,
          flow_intensity: flow,
          source_uuid: uuidOr(r, `derived:menstrual:${dateOnly}`),
        });
        break;
      }
      case 'HKQuantityTypeIdentifierBodyMass': {
        const v = r.value ? Number(r.value) : NaN;
        if (!Number.isFinite(v) || v <= 0) break;
        const kg = kgFromAppleWeight(v, r.unit);
        // Apple's startDate format is 'YYYY-MM-DD HH:MM:SS +ZZZZ' — turn
        // it into an ISO string Postgres timestamptz can parse.
        const isoAt = appleDateToIso(r.startDate);
        weights.push({
          measured_at: isoAt,
          weight_kg: Math.round(kg * 1000) / 1000,
          source_uuid: uuidOr(r, `derived:weight:${r.startDate}`),
        });
        break;
      }
      case 'HKQuantityTypeIdentifierBasalBodyTemperature': {
        const v = r.value ? Number(r.value) : NaN;
        if (!Number.isFinite(v)) break;
        const c = celsiusFromAppleTemp(v, r.unit);
        // Schema check is 35.0–39.0 — drop anything wildly out of range.
        if (c < 34 || c > 41) break;
        bbts.push({
          measured_at: appleDateToIso(r.startDate),
          celsius:    Math.round(c * 100) / 100,
          source_uuid: uuidOr(r, `derived:bbt:${r.startDate}`),
        });
        break;
      }
      case 'HKCategoryTypeIdentifierSleepAnalysis': {
        // Apple emits multiple sleep segments per night. We import each
        // segment as its own row so the existing analytics aggregate.
        // Skip "in-bed" records that are NOT actual asleep states
        // (HKCategoryValueSleepAnalysisInBed) since those overlap and
        // would double-count the time. Keep all "asleep" variants.
        const v = r.value ?? '';
        const isAsleep = v.includes('Asleep') || v.includes('SleepAnalysisAsleep');
        if (!isAsleep) break;
        sleeps.push({
          start_at:    appleDateToIso(r.startDate),
          end_at:      appleDateToIso(r.endDate ?? r.startDate),
          source_uuid: uuidOr(r, `derived:sleep:${r.startDate}`),
        });
        break;
      }
      case 'HKQuantityTypeIdentifierBloodPressureSystolic':
      case 'HKQuantityTypeIdentifierBloodPressureDiastolic': {
        const v = r.value ? Number(r.value) : NaN;
        if (!Number.isFinite(v) || v <= 0) break;
        const isoAt = appleDateToIso(r.startDate);
        const existing = bpByTime.get(r.startDate);
        const isSys = r.type === 'HKQuantityTypeIdentifierBloodPressureSystolic';
        // Schema range: systolic 40–250, diastolic 20–180. Drop bad values.
        if (isSys && (v < 40 || v > 250)) break;
        if (!isSys && (v < 20 || v > 180)) break;
        if (existing) {
          if (isSys) existing.systolic = Math.round(v);
          else       existing.diastolic = Math.round(v);
        } else {
          bpByTime.set(r.startDate, {
            measured_at: isoAt,
            systolic:  isSys ? Math.round(v) : null,
            diastolic: isSys ? null : Math.round(v),
            // The pair will share a derived UUID so re-imports stay
            // idempotent. Apple's per-record HKMetadataKeyHealthKitUUID
            // differs between sys + dia, so we use the start time as the
            // pair key.
            source_uuid: `derived:bp:${r.startDate}`,
          });
        }
        break;
      }
      case 'HKQuantityTypeIdentifierBloodGlucose': {
        const v = r.value ? Number(r.value) : NaN;
        if (!Number.isFinite(v) || v <= 0) break;
        const mgdl = mgdlFromAppleGlucose(v, r.unit);
        // Schema range: 20–800 mg/dL. Drop wildly out of range.
        if (mgdl < 20 || mgdl > 800) break;
        glucoses.push({
          measured_at: appleDateToIso(r.startDate),
          value_mgdl:  Math.round(mgdl * 10) / 10,
          source_uuid: uuidOr(r, `derived:glucose:${r.startDate}`),
        });
        break;
      }
    }
  }

  // Materialise the BP pair map into an array. Drop pairs where neither
  // half landed in range (shouldn't happen, but defensive).
  const bps: BpRecord[] = [];
  for (const v of bpByTime.values()) {
    if (v.systolic == null && v.diastolic == null) continue;
    bps.push(v);
  }

  return {
    cycles, weights, bbts, sleeps, bps, glucoses,
    detected: {
      cycle_days:     cycles.length,
      sleep_nights:   sleeps.length,
      weight_entries: weights.length,
      bp_entries:     bps.length,
      glucose_entries: glucoses.length,
      bbt_entries:    bbts.length,
    },
  };
}

/** Apple emits dates like '2024-09-01 14:23:11 +0200'. Postgres parses
 *  ISO 8601 happily; we just need the space → T swap and a colon in the
 *  TZ offset. */
function appleDateToIso(s: string): string {
  // 'YYYY-MM-DD HH:MM:SS +HHMM' → 'YYYY-MM-DDTHH:MM:SS+HH:MM'
  const m = s.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (m) return `${m[1]}T${m[2]}${m[3]}${m[4]}:${m[5]}`;
  // Fallback: replace the first space with T and trust Date to parse.
  return s.replace(' ', 'T');
}

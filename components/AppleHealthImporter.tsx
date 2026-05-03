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

interface ParseResult {
  cycles: CycleRecord[];
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
    if (!parsed || parsed.cycles.length === 0) return;
    setStage('importing');
    setErr(null);
    const supabase = createClient();
    // Send in chunks of 200 so very large historical imports don't hit
    // RPC payload limits.
    const CHUNK = 200;
    let totalImported = 0;
    for (let i = 0; i < parsed.cycles.length; i += CHUNK) {
      const chunk = parsed.cycles.slice(i, i + CHUNK);
      const { error } = await supabase.rpc('import_menstrual_cycles', {
        p_baby: babyId,
        p_records: chunk,
      });
      if (error) {
        setErr(error.message);
        setStage('preview');
        return;
      }
      totalImported += chunk.length;
      setImportedCount(totalImported);
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
        <h3 className="text-xl font-bold text-ink-strong">Imported {importedCount} period entries</h3>
        <p className="mt-2 text-sm text-ink-muted">Your cycle history is now live. Open the planner to see the calendar updated with everything Apple Health knew.</p>
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
        <PreviewCard parsed={parsed} onCommit={commit} onCancel={() => { setStage('idle'); setParsed(null); }} />
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Loader2 className="mx-auto h-8 w-8 text-coral-600 animate-spin mb-3" />
          <p className="text-sm text-ink">Saving {importedCount} of {parsed?.cycles.length} entries…</p>
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
  parsed, onCommit, onCancel,
}: {
  parsed: ParseResult;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const cycleCount = parsed.cycles.length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-coral-50 to-lavender-50">
        <h3 className="text-lg font-bold text-ink-strong">We found this in your export</h3>
        <p className="text-sm text-ink-muted mt-0.5">Review and confirm before anything is imported.</p>
      </div>
      <div className="p-5 space-y-4">
        {/* Cycle data — the only thing we import in v1. */}
        <Row icon={Calendar} tint="coral" label="Period entries"
          value={`${cycleCount} day${cycleCount === 1 ? '' : 's'}`}
          status="ready" note={cycleCount === 0 ? 'Nothing to import.' : 'Will upsert into your cycle log — re-importing later is safe.'} />

        {/* Detected but deferred — be honest about what's coming. */}
        <Row icon={Moon}     tint="lavender" label="Sleep nights"
          value={`${parsed.detected.sleep_nights}`}
          status="coming-soon" note="Detected — sleep import lands next wave." />
        <Row icon={Activity} tint="brand" label="BBT readings"
          value={`${parsed.detected.bbt_entries}`}
          status="coming-soon" note="Detected — fertility-awareness import next." />
        <Row icon={Heart}    tint="peach" label="Blood pressure entries"
          value={`${parsed.detected.bp_entries}`}
          status="coming-soon" note="Detected — vitals import after sleep." />
        <Row icon={Droplet}  tint="coral" label="Blood glucose entries"
          value={`${parsed.detected.glucose_entries}`}
          status="coming-soon" note="Detected — glucose import after vitals." />
      </div>
      <div className="p-5 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel}
          className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
          Cancel
        </button>
        <button type="button" onClick={onCommit} disabled={cycleCount === 0}
          className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
          Import {cycleCount} period {cycleCount === 1 ? 'entry' : 'entries'}
        </button>
      </div>
    </div>
  );
}

function Row({
  icon: Icon, tint, label, value, status, note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'lavender' | 'brand' | 'peach' | 'mint';
  label: string;
  value: string;
  status: 'ready' | 'coming-soon';
  note: string;
}) {
  const tintCls = {
    coral:    'bg-coral-100 text-coral-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    brand:    'bg-brand-100 text-brand-700',
    peach:    'bg-peach-100 text-peach-700',
    mint:     'bg-mint-100 text-mint-700',
  }[tint];
  return (
    <div className="flex items-start gap-3">
      <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${tintCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-ink-strong text-sm">{label}</span>
          <span className="text-xs text-ink-muted">·</span>
          <span className="text-sm font-bold text-ink-strong">{value}</span>
          {status === 'ready'
            ? <span className="inline-flex items-center rounded-full bg-mint-100 text-mint-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">Ready</span>
            : <span className="inline-flex items-center rounded-full bg-slate-100 text-ink-muted text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">Coming soon</span>}
        </div>
        <p className="text-[11px] text-ink-muted mt-0.5">{note}</p>
      </div>
    </div>
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

/** Bucket Apple Health <Record> rows by category. Builds a compact import
 *  list for the categories we ingest, plus counts for the categories we
 *  detect but defer to a future wave. */
function bucketRecords(records: AppleRecord[]): ParseResult {
  const cycles: CycleRecord[] = [];
  let sleep = 0, weight = 0, bp = 0, glucose = 0, bbt = 0;

  for (const r of records) {
    switch (r.type) {
      case 'HKCategoryTypeIdentifierMenstrualFlow': {
        // Use a ternary instead of `&&` — `&&` returns `""` when r.value is
        // an empty string, polluting the resulting union type. The ternary
        // gives us a clean `flow_intensity | null`.
        const flow: CycleRecord['flow_intensity'] =
          r.value ? (APPLE_FLOW_TO_OUR[r.value] ?? null) : null;
        // Apple stores dates as 'YYYY-MM-DD HH:MM:SS +ZZZZ'; we only need
        // the calendar date in the user's locale at the time it was
        // recorded, so trim to the first 10 chars.
        const dateOnly = r.startDate.slice(0, 10);
        const uuid = r.HKMetadataKeyHealthKitUUID
          // Fall back to a synthetic key derived from date+type so re-imports
          // still de-dupe even when Apple omits the UUID.
          ?? `derived:menstrual:${dateOnly}`;
        cycles.push({
          period_start: dateOnly,
          period_end: null,
          flow_intensity: flow,
          source_uuid: uuid,
        });
        break;
      }
      case 'HKCategoryTypeIdentifierSleepAnalysis':              sleep++;   break;
      case 'HKQuantityTypeIdentifierBodyMass':                   weight++;  break;
      case 'HKQuantityTypeIdentifierBloodPressureSystolic':
      case 'HKQuantityTypeIdentifierBloodPressureDiastolic':     bp++;      break;
      case 'HKQuantityTypeIdentifierBloodGlucose':               glucose++; break;
      case 'HKQuantityTypeIdentifierBasalBodyTemperature':       bbt++;     break;
    }
  }

  return {
    cycles,
    detected: {
      cycle_days: cycles.length,
      sleep_nights: sleep,
      weight_entries: weight,
      bp_entries: bp,
      glucose_entries: glucose,
      bbt_entries: bbt,
    },
  };
}

'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { isoToLocalInput, localInputToIso, nowLocalInput } from '@/lib/dates';
import type { StructuredOcr, MilkType, StoolSize } from '@/lib/types';

// ---- Row types used only in this client form ------------------------------
type FeedingRow = { feeding_time: string; quantity_ml: string; milk_type: MilkType; notes: string };
type StoolRow   = { stool_time: string;   quantity_category: StoolSize | ''; quantity_ml: string; color: string; consistency: string; notes: string };
type MeasRow    = { measured_at: string;  weight_kg: string; height_cm: string; head_circ_cm: string; notes: string };
type MedLogRow  = { medication_id: string; medication_time: string; status: 'taken'|'missed'|'skipped'; notes: string };

type Med = { id: string; name: string };

export function OcrReview({
  extracted,
  meds,
  previewUrl,
  babyId,
}: {
  extracted: {
    id: string;
    file_id: string;
    baby_id: string;
    provider: string;
    model: string | null;
    raw_text: string | null;
    confidence_score: number | null;
    is_handwritten: boolean | null;
    detected_language: string | null;
    status: 'extracted' | 'reviewed' | 'confirmed' | 'discarded';
    structured_data: StructuredOcr | null;
    flag_low_confidence: boolean;
  };
  meds: Med[];
  previewUrl: string | null;
  babyId: string;
}) {
  const router = useRouter();

  const initial = extracted.structured_data ?? {};

  const [feedings, setFeedings] = useState<FeedingRow[]>(() =>
    (initial.feedings ?? []).map(f => ({
      feeding_time: f.feeding_time ? isoToLocalInput(f.feeding_time) : nowLocalInput(),
      quantity_ml: f.quantity_ml?.toString() ?? '',
      milk_type: (f.milk_type as MilkType) ?? 'formula',
      notes: f.notes ?? '',
    }))
  );

  const [stools, setStools] = useState<StoolRow[]>(() =>
    (initial.stools ?? []).map(s => ({
      stool_time: s.stool_time ? isoToLocalInput(s.stool_time) : nowLocalInput(),
      quantity_category: (s.quantity_category as StoolSize) ?? '',
      quantity_ml: s.quantity_ml?.toString() ?? '',
      color: s.color ?? '',
      consistency: s.consistency ?? '',
      notes: s.notes ?? '',
    }))
  );

  const [measurements, setMeasurements] = useState<MeasRow[]>(() =>
    (initial.measurements ?? []).map(m => ({
      measured_at: m.measured_at ? isoToLocalInput(m.measured_at) : nowLocalInput(),
      weight_kg:    m.weight_kg?.toString() ?? '',
      height_cm:    m.height_cm?.toString() ?? '',
      head_circ_cm: m.head_circ_cm?.toString() ?? '',
      notes:        m.notes ?? '',
    }))
  );

  const [medLogs, setMedLogs] = useState<MedLogRow[]>(() =>
    (initial.medication_logs ?? []).map(l => ({
      medication_id: l.medication_id ?? (meds[0]?.id ?? ''),
      medication_time: l.medication_time ? isoToLocalInput(l.medication_time) : nowLocalInput(),
      status: (l.status as 'taken') ?? 'taken',
      notes: l.notes ?? '',
    }))
  );

  const [freeNotes, setFreeNotes] = useState<string>(initial.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const readOnly = extracted.status === 'confirmed' || extracted.status === 'discarded';

  const hasAny = useMemo(
    () => feedings.length + stools.length + measurements.length + medLogs.length > 0,
    [feedings, stools, measurements, medLogs]
  );

  // ---- add/remove helpers ---------------------------------------------------
  function addFeeding()    { setFeedings(r => [...r, { feeding_time: nowLocalInput(), quantity_ml: '', milk_type: 'formula', notes: '' }]); }
  function addStool()      { setStools  (r => [...r, { stool_time: nowLocalInput(), quantity_category: 'medium', quantity_ml: '', color: '', consistency: '', notes: '' }]); }
  function addMeasurement(){ setMeasurements(r => [...r, { measured_at: nowLocalInput(), weight_kg: '', height_cm: '', head_circ_cm: '', notes: '' }]); }
  function addMedLog()     { setMedLogs(r => [...r, { medication_id: meds[0]?.id ?? '', medication_time: nowLocalInput(), status: 'taken', notes: '' }]); }

  // ---- confirm --------------------------------------------------------------
  async function onConfirm() {
    setErr(null);
    setSaving(true);
    const payload = {
      feedings: feedings
        .filter(f => f.feeding_time)
        .map(f => ({
          feeding_time: localInputToIso(f.feeding_time),
          quantity_ml: f.quantity_ml ? Number(f.quantity_ml) : null,
          milk_type:   f.milk_type,
          notes:       f.notes || null,
        })),
      stools: stools
        .filter(s => s.stool_time)
        .map(s => ({
          stool_time: localInputToIso(s.stool_time),
          quantity_category: s.quantity_category || null,
          quantity_ml: s.quantity_ml ? Number(s.quantity_ml) : null,
          color: s.color || null,
          consistency: s.consistency || null,
          notes: s.notes || null,
        })),
      measurements: measurements
        .filter(m => m.measured_at && (m.weight_kg || m.height_cm || m.head_circ_cm))
        .map(m => ({
          measured_at: localInputToIso(m.measured_at),
          weight_kg:    m.weight_kg    ? Number(m.weight_kg)    : null,
          height_cm:    m.height_cm    ? Number(m.height_cm)    : null,
          head_circ_cm: m.head_circ_cm ? Number(m.head_circ_cm) : null,
          notes: m.notes || null,
        })),
      medication_logs: medLogs
        .filter(l => l.medication_id && l.medication_time)
        .map(l => ({
          medication_id:   l.medication_id,
          medication_time: localInputToIso(l.medication_time),
          status:          l.status,
          notes:           l.notes || null,
        })),
      notes: freeNotes || undefined,
    };

    if (
      payload.feedings.length === 0 && payload.stools.length === 0 &&
      payload.measurements.length === 0 && payload.medication_logs.length === 0
    ) {
      setSaving(false);
      setErr('Nothing to save — add at least one row, or discard the extraction.');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.rpc('confirm_extracted_text', {
      p_extracted: extracted.id,
      p_payload: payload,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  async function onDiscard() {
    if (!window.confirm('Discard this extraction? Nothing will be saved to your logs. The original file is kept.')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('extracted_text')
      .update({ status: 'discarded', reviewed_at: new Date().toISOString() })
      .eq('id', extracted.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/files/${extracted.file_id}`);
    router.refresh();
  }

  // ---- UI -------------------------------------------------------------------
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>OCR extraction</CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{extracted.provider}{extracted.model ? ` · ${extracted.model}` : ''}</span>
            {extracted.is_handwritten ? <span className="rounded bg-slate-100 px-1.5 py-0.5">handwritten</span> : null}
            {extracted.detected_language ? <span className="rounded bg-slate-100 px-1.5 py-0.5">{extracted.detected_language}</span> : null}
            <ConfidenceBadge score={extracted.confidence_score} />
          </div>
        </CardHeader>
        <CardContent className="text-sm">
          {extracted.flag_low_confidence && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 mb-3 text-amber-900">
              Low OCR confidence — please check every value before confirming.
            </div>
          )}
          {extracted.status === 'confirmed' && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 mb-3 text-emerald-900">
              This extraction was already confirmed. You can still edit the individual log rows from the dashboard.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {previewUrl && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Source file</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="" className="max-h-[60vh] rounded-md border border-slate-200" />
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500 mb-1">Raw transcript</div>
              <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-xs max-h-[60vh] overflow-auto">
{extracted.raw_text ?? '(no transcript)'}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedings */}
      <Section title={`Feedings (${feedings.length})`} onAdd={readOnly ? undefined : addFeeding}>
        {feedings.length === 0 && <Empty>No feedings detected. Add one if needed.</Empty>}
        {feedings.map((f, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-5 items-end border-b border-slate-100 pb-3">
            <div className="md:col-span-2">
              <Label htmlFor={`ft${i}`}>When</Label>
              <Input id={`ft${i}`} type="datetime-local" disabled={readOnly} value={f.feeding_time} onChange={e => setFeedings(r => patch(r, i, { feeding_time: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`fm${i}`}>Type</Label>
              <Select id={`fm${i}`} disabled={readOnly} value={f.milk_type} onChange={e => setFeedings(r => patch(r, i, { milk_type: e.target.value as MilkType }))}>
                <option value="formula">formula</option><option value="breast">breast</option>
                <option value="mixed">mixed</option><option value="solid">solid</option><option value="other">other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`fq${i}`}>ml</Label>
              <Input id={`fq${i}`} type="number" step="1" min={0} max={2000} disabled={readOnly} value={f.quantity_ml} onChange={e => setFeedings(r => patch(r, i, { quantity_ml: e.target.value }))} />
            </div>
            <div className="flex justify-end">
              {!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setFeedings(r => r.filter((_, j) => j !== i))}>remove</Button>}
            </div>
            <div className="md:col-span-5">
              <Input placeholder="notes" disabled={readOnly} value={f.notes} onChange={e => setFeedings(r => patch(r, i, { notes: e.target.value }))} />
            </div>
          </div>
        ))}
      </Section>

      {/* Stools */}
      <Section title={`Stools (${stools.length})`} onAdd={readOnly ? undefined : addStool}>
        {stools.length === 0 && <Empty>No stool events detected. Add one if needed.</Empty>}
        {stools.map((s, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-6 items-end border-b border-slate-100 pb-3">
            <div className="md:col-span-2">
              <Label htmlFor={`st${i}`}>When</Label>
              <Input id={`st${i}`} type="datetime-local" disabled={readOnly} value={s.stool_time} onChange={e => setStools(r => patch(r, i, { stool_time: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`sc${i}`}>Size</Label>
              <Select id={`sc${i}`} disabled={readOnly} value={s.quantity_category} onChange={e => setStools(r => patch(r, i, { quantity_category: (e.target.value || '') as StoolSize | '' }))}>
                <option value="">—</option><option value="small">small</option><option value="medium">medium</option><option value="large">large</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`sq${i}`}>ml</Label>
              <Input id={`sq${i}`} type="number" step="1" min={0} max={1000} disabled={readOnly} value={s.quantity_ml} onChange={e => setStools(r => patch(r, i, { quantity_ml: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`scol${i}`}>Color</Label>
              <Input id={`scol${i}`} disabled={readOnly} value={s.color} onChange={e => setStools(r => patch(r, i, { color: e.target.value }))} />
            </div>
            <div className="flex justify-end">
              {!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setStools(r => r.filter((_, j) => j !== i))}>remove</Button>}
            </div>
            <div className="md:col-span-6">
              <Input placeholder="consistency / notes" disabled={readOnly} value={s.notes} onChange={e => setStools(r => patch(r, i, { notes: e.target.value }))} />
            </div>
          </div>
        ))}
      </Section>

      {/* Measurements */}
      <Section title={`Measurements (${measurements.length})`} onAdd={readOnly ? undefined : addMeasurement}>
        {measurements.length === 0 && <Empty>No measurements detected. Add one if needed.</Empty>}
        {measurements.map((m, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-5 items-end border-b border-slate-100 pb-3">
            <div className="md:col-span-2">
              <Label htmlFor={`mt${i}`}>When</Label>
              <Input id={`mt${i}`} type="datetime-local" disabled={readOnly} value={m.measured_at} onChange={e => setMeasurements(r => patch(r, i, { measured_at: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`mw${i}`}>kg</Label>
              <Input id={`mw${i}`} type="number" step="0.001" min={0} max={40} disabled={readOnly} value={m.weight_kg} onChange={e => setMeasurements(r => patch(r, i, { weight_kg: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`mh${i}`}>cm</Label>
              <Input id={`mh${i}`} type="number" step="0.1" min={0} max={200} disabled={readOnly} value={m.height_cm} onChange={e => setMeasurements(r => patch(r, i, { height_cm: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`mhc${i}`}>head cm</Label>
              <Input id={`mhc${i}`} type="number" step="0.1" min={0} max={80} disabled={readOnly} value={m.head_circ_cm} onChange={e => setMeasurements(r => patch(r, i, { head_circ_cm: e.target.value }))} />
            </div>
            <div className="md:col-span-5 flex items-end gap-3">
              <Input placeholder="notes" disabled={readOnly} value={m.notes} onChange={e => setMeasurements(r => patch(r, i, { notes: e.target.value }))} />
              {!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setMeasurements(r => r.filter((_, j) => j !== i))}>remove</Button>}
            </div>
          </div>
        ))}
      </Section>

      {/* Medication logs */}
      <Section title={`Medication doses (${medLogs.length})`} onAdd={readOnly ? undefined : addMedLog}>
        {medLogs.length === 0 && <Empty>No doses detected. Add one if needed.</Empty>}
        {meds.length === 0 && medLogs.length > 0 && (
          <p className="text-xs text-amber-700">No medications are set up for this baby yet. Add one in Medications before confirming, or the rows will fail to save.</p>
        )}
        {medLogs.map((l, i) => (
          <div key={i} className="grid gap-3 md:grid-cols-5 items-end border-b border-slate-100 pb-3">
            <div className="md:col-span-2">
              <Label htmlFor={`lm${i}`}>Medication</Label>
              <Select id={`lm${i}`} disabled={readOnly} value={l.medication_id} onChange={e => setMedLogs(r => patch(r, i, { medication_id: e.target.value }))}>
                <option value="">—</option>
                {meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor={`lt${i}`}>When</Label>
              <Input id={`lt${i}`} type="datetime-local" disabled={readOnly} value={l.medication_time} onChange={e => setMedLogs(r => patch(r, i, { medication_time: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`ls${i}`}>Status</Label>
              <Select id={`ls${i}`} disabled={readOnly} value={l.status} onChange={e => setMedLogs(r => patch(r, i, { status: e.target.value as 'taken' }))}>
                <option value="taken">taken</option><option value="missed">missed</option><option value="skipped">skipped</option>
              </Select>
            </div>
            <div className="flex justify-end">
              {!readOnly && <Button type="button" variant="ghost" size="sm" onClick={() => setMedLogs(r => r.filter((_, j) => j !== i))}>remove</Button>}
            </div>
          </div>
        ))}
      </Section>

      <Card>
        <CardHeader><CardTitle>Free-text notes (not saved to logs)</CardTitle></CardHeader>
        <CardContent><Textarea rows={3} disabled={readOnly} value={freeNotes} onChange={e => setFreeNotes(e.target.value)} /></CardContent>
      </Card>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-slate-50 py-3 border-t border-slate-200">
        <div className="text-xs text-slate-500">
          Nothing is written to your logs until you confirm. All fields stay editable after.
        </div>
        <div className="flex gap-2">
          {!readOnly && <Button variant="secondary" onClick={onDiscard} disabled={saving}>Discard</Button>}
          {!readOnly && <Button onClick={onConfirm} disabled={saving || !hasAny}>{saving ? 'Saving…' : 'Confirm & save to logs'}</Button>}
        </div>
      </div>
    </div>
  );
}

// ---- helpers --------------------------------------------------------------
function patch<T>(rows: T[], i: number, diff: Partial<T>): T[] {
  return rows.map((r, j) => j === i ? { ...r, ...diff } : r);
}

function Section({ title, onAdd, children }: { title: string; onAdd?: () => void; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {onAdd && <Button type="button" variant="secondary" size="sm" onClick={onAdd}>+ add row</Button>}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

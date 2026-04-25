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
type UsRow      = {
  scanned_at: string; gestational_week: string; gestational_day: string;
  bpd_mm: string; hc_mm: string; ac_mm: string; fl_mm: string;
  efw_g: string; fhr_bpm: string;
  placenta_position: string; amniotic_fluid: string;
  sex_predicted: 'male'|'female'|'undetermined'|'';
  anomalies: string; summary: string;
};
type LabPanelRow = {
  panel_kind: 'blood'|'urine'|'stool'|'culture'|'imaging'|'genetic'|'other';
  panel_name: string;
  sample_at: string;
  result_at: string;
  lab_name: string;
  summary: string;
  abnormal: boolean;
  items: { test_name: string; value: string; unit: string; reference: string; is_abnormal: boolean; flag: ''|'low'|'high'|'critical'|'positive'|'negative' }[];
};

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

  const [ultrasounds, setUltrasounds] = useState<UsRow[]>(() =>
    (initial.ultrasounds ?? []).map(u => ({
      scanned_at: u.scanned_at ? isoToLocalInput(u.scanned_at) : nowLocalInput(),
      gestational_week: u.gestational_week?.toString() ?? '',
      gestational_day:  u.gestational_day?.toString()  ?? '',
      bpd_mm: u.bpd_mm?.toString() ?? '',
      hc_mm:  u.hc_mm?.toString()  ?? '',
      ac_mm:  u.ac_mm?.toString()  ?? '',
      fl_mm:  u.fl_mm?.toString()  ?? '',
      efw_g:  u.efw_g?.toString()  ?? '',
      fhr_bpm: u.fhr_bpm?.toString() ?? '',
      placenta_position: u.placenta_position ?? '',
      amniotic_fluid:    u.amniotic_fluid ?? '',
      sex_predicted:     u.sex_predicted ?? '',
      anomalies:         u.anomalies ?? '',
      summary:           u.summary ?? '',
    }))
  );
  const [savingUs, setSavingUs] = useState(false);
  const [usMsg, setUsMsg] = useState<string | null>(null);

  const [labPanels, setLabPanels] = useState<LabPanelRow[]>(() =>
    (initial.lab_panels ?? []).map(p => ({
      panel_kind: (p.panel_kind ?? 'blood') as LabPanelRow['panel_kind'],
      panel_name: p.panel_name ?? '',
      sample_at:  p.sample_at  ? isoToLocalInput(p.sample_at)  : '',
      result_at:  p.result_at  ? isoToLocalInput(p.result_at)  : nowLocalInput(),
      lab_name:   p.lab_name ?? '',
      summary:    p.summary ?? '',
      abnormal:   p.abnormal ?? false,
      items: (p.items ?? []).map(it => ({
        test_name: it.test_name ?? '',
        value:     it.value ?? '',
        unit:      it.unit ?? '',
        reference: it.reference ?? '',
        is_abnormal: it.is_abnormal ?? false,
        flag:      (it.flag ?? '') as LabPanelRow['items'][number]['flag'],
      })),
    }))
  );
  const [savingLab, setSavingLab] = useState(false);
  const [labMsg, setLabMsg] = useState<string | null>(null);
  const labRequests = (initial.lab_requests ?? []) as string[];

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

      {/* Ultrasounds — separate save (writes to public.ultrasounds, not logs) */}
      {ultrasounds.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ultrasound{ultrasounds.length === 1 ? '' : 's'} ({ultrasounds.length})</CardTitle>
            <span className="text-[11px] uppercase tracking-wider text-lavender-700 bg-lavender-50 px-2 py-0.5 rounded-full">
              saved separately
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {ultrasounds.map((u, i) => (
              <div key={i} className="rounded-xl border border-lavender-200 bg-lavender-50/30 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label htmlFor={`us-at-${i}`}>Scan time</Label>
                    <Input id={`us-at-${i}`} type="datetime-local" disabled={readOnly}
                      value={u.scanned_at}
                      onChange={e => setUltrasounds(r => patch(r, i, { scanned_at: e.target.value }))} />
                  </div>
                  <div>
                    <Label>GA weeks</Label>
                    <Input type="number" min={0} max={45} disabled={readOnly}
                      value={u.gestational_week}
                      onChange={e => setUltrasounds(r => patch(r, i, { gestational_week: e.target.value }))} />
                  </div>
                  <div>
                    <Label>GA days</Label>
                    <Input type="number" min={0} max={6} disabled={readOnly}
                      value={u.gestational_day}
                      onChange={e => setUltrasounds(r => patch(r, i, { gestational_day: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>BPD (mm)</Label><Input type="number" step="0.1" disabled={readOnly} value={u.bpd_mm} onChange={e => setUltrasounds(r => patch(r, i, { bpd_mm: e.target.value }))} /></div>
                  <div><Label>HC (mm)</Label> <Input type="number" step="0.1" disabled={readOnly} value={u.hc_mm}  onChange={e => setUltrasounds(r => patch(r, i, { hc_mm:  e.target.value }))} /></div>
                  <div><Label>AC (mm)</Label> <Input type="number" step="0.1" disabled={readOnly} value={u.ac_mm}  onChange={e => setUltrasounds(r => patch(r, i, { ac_mm:  e.target.value }))} /></div>
                  <div><Label>FL (mm)</Label> <Input type="number" step="0.1" disabled={readOnly} value={u.fl_mm}  onChange={e => setUltrasounds(r => patch(r, i, { fl_mm:  e.target.value }))} /></div>
                  <div><Label>EFW (g)</Label> <Input type="number" step="1"   disabled={readOnly} value={u.efw_g}  onChange={e => setUltrasounds(r => patch(r, i, { efw_g:  e.target.value }))} /></div>
                  <div><Label>FHR (bpm)</Label><Input type="number" min={50} max={250} disabled={readOnly} value={u.fhr_bpm} onChange={e => setUltrasounds(r => patch(r, i, { fhr_bpm: e.target.value }))} /></div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <Label>Sex predicted</Label>
                    <Select disabled={readOnly} value={u.sex_predicted}
                      onChange={e => setUltrasounds(r => patch(r, i, { sex_predicted: (e.target.value || '') as UsRow['sex_predicted'] }))}>
                      <option value="">—</option>
                      <option value="female">female</option>
                      <option value="male">male</option>
                      <option value="undetermined">undetermined</option>
                    </Select>
                  </div>
                  <div><Label>Placenta</Label><Input disabled={readOnly} value={u.placenta_position} onChange={e => setUltrasounds(r => patch(r, i, { placenta_position: e.target.value }))} /></div>
                  <div><Label>Amniotic fluid</Label><Input disabled={readOnly} value={u.amniotic_fluid} onChange={e => setUltrasounds(r => patch(r, i, { amniotic_fluid: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Anomalies</Label>
                  <Textarea rows={2} disabled={readOnly} value={u.anomalies} onChange={e => setUltrasounds(r => patch(r, i, { anomalies: e.target.value }))} />
                </div>
                <div>
                  <Label>Summary</Label>
                  <Textarea rows={2} disabled={readOnly} value={u.summary} onChange={e => setUltrasounds(r => patch(r, i, { summary: e.target.value }))} />
                </div>
                <div className="flex items-center justify-end gap-2">
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setUltrasounds(r => r.filter((_, j) => j !== i))}>
                      remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!readOnly && (
              <div className="flex items-center justify-end gap-2">
                {usMsg && <span className="text-xs text-mint-700">{usMsg}</span>}
                <Button type="button" disabled={savingUs} onClick={async () => {
                  setUsMsg(null);
                  const rows = ultrasounds
                    .filter(u => u.scanned_at)
                    .map(u => ({
                      baby_id: babyId,
                      scanned_at: localInputToIso(u.scanned_at),
                      gestational_week: u.gestational_week ? Number(u.gestational_week) : null,
                      gestational_day:  u.gestational_day  ? Number(u.gestational_day)  : null,
                      bpd_mm: u.bpd_mm ? Number(u.bpd_mm) : null,
                      hc_mm:  u.hc_mm  ? Number(u.hc_mm)  : null,
                      ac_mm:  u.ac_mm  ? Number(u.ac_mm)  : null,
                      fl_mm:  u.fl_mm  ? Number(u.fl_mm)  : null,
                      efw_g:  u.efw_g  ? Number(u.efw_g)  : null,
                      fhr_bpm: u.fhr_bpm ? Number(u.fhr_bpm) : null,
                      placenta_position: u.placenta_position || null,
                      amniotic_fluid:    u.amniotic_fluid || null,
                      sex_predicted:     u.sex_predicted || null,
                      anomalies:         u.anomalies || null,
                      summary:           u.summary || null,
                      file_id: extracted.file_id,
                    }));
                  if (rows.length === 0) return;
                  setSavingUs(true);
                  const supabase = createClient();
                  const userId = (await supabase.auth.getUser()).data.user?.id;
                  const payload = rows.map(r => ({ ...r, created_by: userId }));
                  const { error } = await supabase.from('ultrasounds').insert(payload);
                  setSavingUs(false);
                  if (error) { setUsMsg(`Error: ${error.message}`); return; }
                  setUsMsg(`Saved ${rows.length} ultrasound${rows.length === 1 ? '' : 's'} ✓`);
                  setTimeout(() => router.push(`/babies/${babyId}/prenatal/ultrasounds`), 800);
                }}>
                  {savingUs ? 'Saving…' : `Save ultrasound${ultrasounds.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lab panels — separate save (writes to public.lab_panels + items) */}
      {labPanels.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Lab panel{labPanels.length === 1 ? '' : 's'} ({labPanels.length})</CardTitle>
            <span className="text-[11px] uppercase tracking-wider text-peach-700 bg-peach-50 px-2 py-0.5 rounded-full">
              saved separately
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {labPanels.map((p, pi) => (
              <div key={pi} className="rounded-xl border border-peach-200 bg-peach-50/30 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label>Type</Label>
                    <Select disabled={readOnly} value={p.panel_kind}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { panel_kind: e.target.value as LabPanelRow['panel_kind'] }))}>
                      <option value="blood">Blood</option>
                      <option value="urine">Urine</option>
                      <option value="stool">Stool</option>
                      <option value="culture">Culture</option>
                      <option value="imaging">Imaging</option>
                      <option value="genetic">Genetic</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Panel name</Label>
                    <Input disabled={readOnly} value={p.panel_name}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { panel_name: e.target.value }))}
                      placeholder="CBC with differential" />
                  </div>
                  <div>
                    <Label>Sample taken</Label>
                    <Input type="datetime-local" disabled={readOnly} value={p.sample_at}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { sample_at: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Result issued</Label>
                    <Input type="datetime-local" disabled={readOnly} value={p.result_at}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { result_at: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Lab</Label>
                    <Input disabled={readOnly} value={p.lab_name}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { lab_name: e.target.value }))} />
                  </div>
                  <div className="md:col-span-3">
                    <Label>One-line summary</Label>
                    <Input disabled={readOnly} value={p.summary}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { summary: e.target.value }))} />
                  </div>
                  <label className="md:col-span-3 inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled={readOnly} checked={p.abnormal}
                      onChange={e => setLabPanels(rs => patch(rs, pi, { abnormal: e.target.checked }))} />
                    Flag panel as abnormal
                  </label>
                </div>

                {/* Items table */}
                {p.items.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted border-b border-slate-100">
                          <th className="px-2 py-1.5">Test</th>
                          <th className="px-2 py-1.5">Value</th>
                          <th className="px-2 py-1.5">Unit</th>
                          <th className="px-2 py-1.5">Reference</th>
                          <th className="px-2 py-1.5">Flag</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {p.items.map((it, ii) => (
                          <tr key={ii} className={it.is_abnormal ? 'bg-coral-50/40' : ''}>
                            <td className="px-2 py-1"><Input className="h-8 text-xs" disabled={readOnly} value={it.test_name} onChange={e => setLabPanels(rs => patchItem(rs, pi, ii, { test_name: e.target.value }))} /></td>
                            <td className="px-2 py-1"><Input className="h-8 text-xs" disabled={readOnly} value={it.value}     onChange={e => setLabPanels(rs => patchItem(rs, pi, ii, { value: e.target.value }))} /></td>
                            <td className="px-2 py-1"><Input className="h-8 text-xs" disabled={readOnly} value={it.unit}      onChange={e => setLabPanels(rs => patchItem(rs, pi, ii, { unit: e.target.value }))} /></td>
                            <td className="px-2 py-1"><Input className="h-8 text-xs" disabled={readOnly} value={it.reference} onChange={e => setLabPanels(rs => patchItem(rs, pi, ii, { reference: e.target.value }))} /></td>
                            <td className="px-2 py-1">
                              <Select className="h-8 text-xs" disabled={readOnly} value={it.flag}
                                onChange={e => setLabPanels(rs => patchItem(rs, pi, ii, { flag: e.target.value as LabPanelRow['items'][number]['flag'], is_abnormal: !!e.target.value }))}>
                                <option value="">—</option>
                                <option value="low">low</option>
                                <option value="high">high</option>
                                <option value="critical">critical</option>
                                <option value="positive">positive</option>
                                <option value="negative">negative</option>
                              </Select>
                            </td>
                            <td className="px-1 py-1">
                              {!readOnly && <button type="button" onClick={() => setLabPanels(rs => removeItem(rs, pi, ii))}
                                className="text-coral-600 hover:text-coral-700 text-xs">×</button>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  {!readOnly && p.items.length === 0 && (
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setLabPanels(rs => addItem(rs, pi))}>
                      + add row
                    </Button>
                  )}
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => setLabPanels(rs => rs.filter((_, j) => j !== pi))}>
                      remove panel
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!readOnly && (
              <div className="flex items-center justify-end gap-2">
                {labMsg && <span className="text-xs text-mint-700">{labMsg}</span>}
                <Button type="button" disabled={savingLab} onClick={async () => {
                  setLabMsg(null);
                  const rows = labPanels
                    .filter(p => p.panel_name.trim() && p.result_at);
                  if (rows.length === 0) return;
                  setSavingLab(true);
                  const supabase = createClient();
                  const userId = (await supabase.auth.getUser()).data.user?.id;
                  let saved = 0;
                  for (const p of rows) {
                    const { data: panelRow, error: pErr } = await supabase.from('lab_panels').insert({
                      baby_id: babyId,
                      panel_kind: p.panel_kind,
                      panel_name: p.panel_name.trim(),
                      sample_at: p.sample_at ? localInputToIso(p.sample_at) : null,
                      result_at: localInputToIso(p.result_at),
                      lab_name: p.lab_name || null,
                      summary: p.summary || null,
                      abnormal: p.abnormal,
                      file_id: extracted.file_id,
                      created_by: userId,
                    }).select('id').single();
                    if (pErr || !panelRow) { setLabMsg(`Error: ${pErr?.message ?? 'failed'}`); break; }
                    const itemRows = p.items
                      .filter(i => i.test_name.trim())
                      .map(i => ({
                        panel_id: panelRow.id,
                        test_name: i.test_name.trim(),
                        value: i.value || null,
                        unit: i.unit || null,
                        reference: i.reference || null,
                        is_abnormal: !!i.is_abnormal,
                        flag: i.flag || null,
                      }));
                    if (itemRows.length > 0) {
                      const { error: iErr } = await supabase.from('lab_panel_items').insert(itemRows);
                      if (iErr) { setLabMsg(`Saved panel but rows failed: ${iErr.message}`); break; }
                    }
                    saved += 1;
                  }
                  setSavingLab(false);
                  if (saved > 0) {
                    setLabMsg(`Saved ${saved} lab panel${saved === 1 ? '' : 's'} ✓`);
                    setTimeout(() => router.push(`/babies/${babyId}/labs`), 800);
                  }
                }}>
                  {savingLab ? 'Saving…' : `Save lab panel${labPanels.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Lab requests pulled from a prescription / referral */}
      {labRequests.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lab tests ordered by this document</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-xs text-ink-muted">When the results come back, add a new lab panel — these are just a heads-up.</p>
            <ul className="flex flex-wrap gap-1.5">
              {labRequests.map((req, i) => (
                <li key={i} className="inline-flex items-center rounded-full bg-peach-100 text-peach-700 px-3 py-1 text-xs font-semibold">{req}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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

function patchItem(panels: LabPanelRow[], pi: number, ii: number, diff: Partial<LabPanelRow['items'][number]>): LabPanelRow[] {
  return panels.map((p, j) => j === pi ? {
    ...p,
    items: p.items.map((it, k) => k === ii ? { ...it, ...diff } : it),
  } : p);
}

function addItem(panels: LabPanelRow[], pi: number): LabPanelRow[] {
  return panels.map((p, j) => j === pi ? {
    ...p,
    items: [...p.items, { test_name: '', value: '', unit: '', reference: '', is_abnormal: false, flag: '' as const }],
  } : p);
}

function removeItem(panels: LabPanelRow[], pi: number, ii: number): LabPanelRow[] {
  return panels.map((p, j) => j === pi ? {
    ...p,
    items: p.items.filter((_, k) => k !== ii),
  } : p);
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

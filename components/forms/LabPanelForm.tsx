'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LabPanelSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2, Plus, X, Clock } from 'lucide-react';
import { Section, Field, QuickPill, WhenPicker } from '@/components/forms/FormKit';
import { cn } from '@/lib/utils';

export type LabPanelFormValue = {
  id?: string;
  panel_kind: 'blood'|'urine'|'stool'|'culture'|'imaging'|'genetic'|'other'|'xray'|'mri'|'ct'|'ultrasound'|'ekg';
  panel_name: string;
  sample_at?: string | null;
  result_at: string;
  lab_name?: string | null;
  summary?: string | null;
  abnormal?: boolean;
  file_id?: string | null;
  notes?: string | null;
};

export type LabItem = {
  id?: string;
  test_name: string;
  value?: string | null;
  unit?: string | null;
  reference?: string | null;
  is_abnormal?: boolean;
  flag?: 'low'|'high'|'critical'|'positive'|'negative'|null;
};

// Two flavours of "what is this": traditional analytical labs (blood, urine,
// stool, culture, genetic) and imaging studies / scans. We keep them in a
// single picker with a soft visual divider so the UI stays one form.
const PANEL_KINDS: { value: LabPanelFormValue['panel_kind']; label: string; group: 'lab'|'scan' }[] = [
  { value: 'blood',      label: 'Blood',          group: 'lab'  },
  { value: 'urine',      label: 'Urine',          group: 'lab'  },
  { value: 'stool',      label: 'Stool',          group: 'lab'  },
  { value: 'culture',    label: 'Culture',        group: 'lab'  },
  { value: 'genetic',    label: 'Genetic',        group: 'lab'  },
  { value: 'xray',       label: 'X-ray',          group: 'scan' },
  { value: 'ultrasound', label: 'Ultrasound',     group: 'scan' },
  { value: 'mri',        label: 'MRI',            group: 'scan' },
  { value: 'ct',         label: 'CT scan',        group: 'scan' },
  { value: 'ekg',        label: 'EKG / ECG',      group: 'scan' },
  { value: 'imaging',    label: 'Other imaging',  group: 'scan' },
  { value: 'other',      label: 'Other',          group: 'lab'  },
];

export function LabPanelForm({
  babyId, initial, initialItems,
}: {
  babyId: string;
  initial?: LabPanelFormValue;
  initialItems?: LabItem[];
}) {
  const router = useRouter();
  const [panelKind, setPanelKind] = useState<LabPanelFormValue['panel_kind']>(initial?.panel_kind ?? 'blood');
  const [panelName, setPanelName] = useState(initial?.panel_name ?? '');
  const [sampleAt, setSampleAt]   = useState(initial?.sample_at ? isoToLocalInput(initial.sample_at) : '');
  const [resultAt, setResultAt]   = useState(initial?.result_at ? isoToLocalInput(initial.result_at) : nowLocalInput());
  const [labName, setLabName]     = useState(initial?.lab_name ?? '');
  const [summary, setSummary]     = useState(initial?.summary ?? '');
  const [abnormal, setAbnormal]   = useState<boolean>(initial?.abnormal ?? false);
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  // Mode toggle: quick attach (no rows) vs structured rows.
  const [items, setItems] = useState<LabItem[]>(initialItems ?? []);
  const [showStructured, setShowStructured] = useState<boolean>((initialItems?.length ?? 0) > 0);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addRow() {
    setItems(rows => [...rows, { test_name: '', value: '', unit: '', reference: '', is_abnormal: false, flag: null }]);
  }
  function updateRow(idx: number, patch: Partial<LabItem>) {
    setItems(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function removeRow(idx: number) {
    setItems(rows => rows.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const result = localInputToIso(resultAt);
    if (!result) { setErr('Pick a valid result time.'); return; }
    const sample = sampleAt ? localInputToIso(sampleAt) : null;
    const parsed = LabPanelSchema.safeParse({
      panel_kind: panelKind, panel_name: panelName,
      sample_at: sample, result_at: result, lab_name: labName || null,
      summary: summary || null, abnormal,
      file_id: initial?.file_id ?? null, notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();

    let panelId = initial?.id;
    if (panelId) {
      const { error } = await supabase.from('lab_panels').update({ ...parsed.data }).eq('id', panelId);
      if (error) { setErr(error.message); setSaving(false); return; }
      // Rewrite item set: simplest semantics for an edit form.
      await supabase.from('lab_panel_items').delete().eq('panel_id', panelId);
    } else {
      const { data, error } = await supabase.from('lab_panels').insert({
        baby_id: babyId, ...parsed.data,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select('id').single();
      if (error || !data) { setErr(error?.message ?? 'Could not save panel'); setSaving(false); return; }
      panelId = data.id;
    }

    if (showStructured && items.length > 0) {
      const rows = items
        .filter(r => r.test_name.trim().length > 0)
        .map(r => ({
          panel_id: panelId,
          test_name: r.test_name.trim(),
          value: r.value || null,
          unit: r.unit || null,
          reference: r.reference || null,
          is_abnormal: !!r.is_abnormal,
          flag: r.flag || null,
        }));
      if (rows.length > 0) {
        const { error } = await supabase.from('lab_panel_items').insert(rows);
        if (error) { setErr(error.message); setSaving(false); return; }
      }
    }

    setSaving(false);
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this lab panel and all its rows?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('lab_panels')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Panel kind + name */}
      <Section n={1} title="What kind of lab?">
        <div className="space-y-4">
          <Field label="Panel type">
            <div className="flex flex-wrap gap-2">
              {PANEL_KINDS.map(k => (
                <QuickPill key={k.value} active={panelKind === k.value} onClick={() => setPanelKind(k.value)} tint="peach">
                  {k.label}
                </QuickPill>
              ))}
            </div>
          </Field>
          <Field label="Panel name">
            <input
              value={panelName}
              onChange={e => setPanelName(e.target.value)}
              required
              placeholder="e.g. CBC with differential"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 2. Result details */}
      <Section n={2} title="Result details">
        <div className="space-y-4">
          <Field label="Sample taken at" hint="Optional — the moment the sample was collected.">
            <div className={cn(
              'inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-2.5 w-full sm:w-auto',
              sampleAt ? 'border-peach-500' : 'border-slate-200'
            )}>
              <Clock className={cn('h-4 w-4', sampleAt ? 'text-peach-500' : 'text-ink-muted')} />
              <input
                type="datetime-local"
                value={sampleAt}
                onChange={e => setSampleAt(e.target.value)}
                className="bg-transparent text-base focus:outline-none flex-1"
              />
            </div>
          </Field>

          <Field label="Result issued at">
            <WhenPicker time={resultAt} onChange={setResultAt} tint="peach" />
          </Field>

          <Field label="Laboratory">
            <input
              value={labName}
              onChange={e => setLabName(e.target.value)}
              placeholder="Where it was run"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>

          <Field label="One-line summary">
            <input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="e.g. Mild iron-deficiency anemia, otherwise unremarkable"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>

          <label className="flex items-center gap-2 text-sm rounded-2xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={abnormal} onChange={e => setAbnormal(e.target.checked)} className="rounded" />
            <span>Flag panel as <span className="font-semibold text-coral-600">abnormal</span> (will appear in summary)</span>
          </label>
        </div>
      </Section>

      {/* 3. Structured rows */}
      <Section n={3} title="Structured test rows" optional>
        <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/40">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-ink-strong">Per-test values</h4>
              <p className="text-xs text-ink-muted">Optional — leave empty if you only attached a scan.</p>
            </div>
            <button type="button"
              onClick={() => setShowStructured(s => !s)}
              className="text-xs font-semibold text-peach-600 hover:underline">
              {showStructured ? 'Hide rows' : 'Add rows'}
            </button>
          </div>

          {showStructured && (
            <div className="mt-4 space-y-2">
              {items.length === 0 && (
                <p className="text-xs text-ink-muted italic">No rows yet.</p>
              )}
              {items.map((row, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-12 items-center">
                  <Input className="sm:col-span-3" placeholder="Test name (e.g. Hemoglobin)"
                    value={row.test_name} onChange={e => updateRow(idx, { test_name: e.target.value })} />
                  <Input className="sm:col-span-2" placeholder="Value"
                    value={row.value ?? ''} onChange={e => updateRow(idx, { value: e.target.value })} />
                  <Input className="sm:col-span-1" placeholder="Unit"
                    value={row.unit ?? ''} onChange={e => updateRow(idx, { unit: e.target.value })} />
                  <Input className="sm:col-span-3" placeholder="Reference range"
                    value={row.reference ?? ''} onChange={e => updateRow(idx, { reference: e.target.value })} />
                  <Select className="sm:col-span-2" value={row.flag ?? ''}
                    onChange={e => updateRow(idx, { flag: (e.target.value || null) as LabItem['flag'], is_abnormal: !!e.target.value })}>
                    <option value="">— normal —</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                    <option value="positive">Positive</option>
                    <option value="negative">Negative</option>
                  </Select>
                  <button type="button" onClick={() => removeRow(idx)}
                    className="sm:col-span-1 h-9 grid place-items-center rounded-lg border border-slate-200 text-coral-500 hover:bg-coral-50">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addRow}
                className="inline-flex items-center gap-1 text-xs font-semibold text-peach-600 hover:underline mt-2">
                <Plus className="h-3 w-3" /> Add row
              </button>
            </div>
          )}
        </div>
      </Section>

      {/* 4. Notes */}
      <Section n={4} title="Add details" optional>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Anything important — context, follow-up, what the doctor said…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
        />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save lab result'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">Takes less than 2 seconds <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

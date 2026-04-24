'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LabPanelSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, FlaskConical, Plus, X } from 'lucide-react';

export type LabPanelFormValue = {
  id?: string;
  panel_kind: 'blood'|'urine'|'stool'|'culture'|'imaging'|'genetic'|'other';
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
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Type</Label>
          <Select value={panelKind} onChange={e => setPanelKind(e.target.value as LabPanelFormValue['panel_kind'])}>
            <option value="blood">Blood</option>
            <option value="urine">Urine</option>
            <option value="stool">Stool</option>
            <option value="culture">Culture / swab</option>
            <option value="imaging">Imaging</option>
            <option value="genetic">Genetic</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label>Panel name</Label>
          <Input value={panelName} onChange={e => setPanelName(e.target.value)} required
            placeholder="e.g. CBC with differential" />
        </div>
        <div>
          <Label>Sample taken at (optional)</Label>
          <Input type="datetime-local" value={sampleAt} onChange={e => setSampleAt(e.target.value)} />
        </div>
        <div>
          <Label>Result issued at</Label>
          <Input type="datetime-local" value={resultAt} onChange={e => setResultAt(e.target.value)} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Laboratory</Label>
          <Input value={labName} onChange={e => setLabName(e.target.value)} placeholder="Where it was run" />
        </div>
        <div className="sm:col-span-2">
          <Label>One-line summary</Label>
          <Input value={summary} onChange={e => setSummary(e.target.value)}
            placeholder="e.g. Mild iron-deficiency anemia, otherwise unremarkable" />
        </div>
        <label className="sm:col-span-2 inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={abnormal} onChange={e => setAbnormal(e.target.checked)} className="rounded" />
          <span>Flag panel as abnormal (will appear in summary)</span>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-ink-strong">Structured test rows</h4>
            <p className="text-xs text-ink-muted">Optional — leave empty if you only attached a scan.</p>
          </div>
          <button type="button"
            onClick={() => setShowStructured(s => !s)}
            className="text-xs font-semibold text-brand-600 hover:underline">
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
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline mt-2">
              <Plus className="h-3 w-3" /> Add row
            </button>
          </div>
        )}
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-peach-500 to-coral-500">
          <FlaskConical className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save lab result'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-12 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

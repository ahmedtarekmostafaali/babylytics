'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MeasurementSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

export type MeasurementFormValue = {
  id?: string;
  baby_id: string;
  measured_at?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  head_circ_cm?: number | null;
  notes?: string | null;
};

export function MeasurementForm({ babyId, initial }: { babyId: string; initial?: MeasurementFormValue }) {
  const router = useRouter();
  const [time, setTime]   = useState(initial?.measured_at ? isoToLocalInput(initial.measured_at) : nowLocalInput());
  const [kg,   setKg]     = useState(initial?.weight_kg?.toString() ?? '');
  const [cm,   setCm]     = useState(initial?.height_cm?.toString() ?? '');
  const [head, setHead]   = useState(initial?.head_circ_cm?.toString() ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = MeasurementSchema.safeParse({
      measured_at: localInputToIso(time) ?? '',
      weight_kg: kg || null,
      height_cm: cm || null,
      head_circ_cm: head || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('measurements').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('measurements').insert({ baby_id: babyId, ...parsed.data, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm('Delete this measurement?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('measurements').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label htmlFor="t">When</Label>
        <Input id="t" type="datetime-local" required value={time} onChange={e => setTime(e.target.value)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="w">Weight (kg)</Label>
          <Input id="w" type="number" inputMode="decimal" step="0.001" min={0} max={40} value={kg} onChange={e => setKg(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="h">Height (cm)</Label>
          <Input id="h" type="number" inputMode="decimal" step="0.1"   min={0} max={200} value={cm} onChange={e => setCm(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="hc">Head circ. (cm)</Label>
          <Input id="hc" type="number" inputMode="decimal" step="0.1"  min={0} max={80}  value={head} onChange={e => setHead(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-slate-500">At least one of weight / height / head circumference is required.</p>
      <div>
        <Label htmlFor="n">Notes</Label>
        <Textarea id="n" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save measurement'}</Button>
        {initial?.id && <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>Delete</Button>}
      </div>
    </form>
  );
}

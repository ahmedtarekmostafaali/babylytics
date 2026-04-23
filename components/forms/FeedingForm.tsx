'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FeedingSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

export type FeedingFormValue = {
  id?: string;
  baby_id: string;
  feeding_time?: string | null;
  milk_type?: 'breast'|'formula'|'mixed'|'solid'|'other';
  quantity_ml?: number | null;
  kcal?: number | null;
  duration_min?: number | null;
  notes?: string | null;
};

export function FeedingForm({ babyId, initial, onDone }: { babyId: string; initial?: FeedingFormValue; onDone?: () => void }) {
  const router = useRouter();
  const [time,     setTime]     = useState(initial?.feeding_time ? isoToLocalInput(initial.feeding_time) : nowLocalInput());
  const [milk,     setMilk]     = useState<FeedingFormValue['milk_type']>(initial?.milk_type ?? 'formula');
  const [ml,       setMl]       = useState(initial?.quantity_ml?.toString() ?? '');
  const [kcal,     setKcal]     = useState(initial?.kcal?.toString() ?? '');
  const [duration, setDuration] = useState(initial?.duration_min?.toString() ?? '');
  const [notes,    setNotes]    = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = FeedingSchema.safeParse({
      feeding_time: localInputToIso(time) ?? '',
      milk_type: milk,
      quantity_ml: ml || null,
      kcal: kcal || null,
      duration_min: duration || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const row = { baby_id: babyId, ...parsed.data };
    const op = initial?.id
      ? supabase.from('feedings').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('feedings').insert({ ...row, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onDone?.();
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm('Delete this feeding?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('feedings').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="m">Type</Label>
          <Select id="m" value={milk} onChange={e => setMilk(e.target.value as 'formula')}>
            <option value="formula">Formula</option>
            <option value="breast">Breast</option>
            <option value="mixed">Mixed</option>
            <option value="solid">Solid</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="q">Quantity (ml)</Label>
          <Input id="q" type="number" inputMode="decimal" step="1" min={0} max={2000} value={ml} onChange={e => setMl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="k">Kcal</Label>
          <Input id="k" type="number" inputMode="decimal" step="1" min={0} max={5000} value={kcal} onChange={e => setKcal(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="d">Duration (min)</Label>
          <Input id="d" type="number" inputMode="numeric" step="1" min={0} max={600} value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="n">Notes</Label>
        <Textarea id="n" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save feeding'}</Button>
        {initial?.id && <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>Delete</Button>}
      </div>
    </form>
  );
}

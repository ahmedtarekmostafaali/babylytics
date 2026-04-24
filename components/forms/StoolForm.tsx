'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { StoolSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

export type StoolFormValue = {
  id?: string;
  baby_id: string;
  stool_time?: string | null;
  quantity_category?: 'small'|'medium'|'large'|null;
  quantity_ml?: number | null;
  color?: string | null;
  consistency?: string | null;
  has_diaper_rash?: boolean;
  notes?: string | null;
};

export function StoolForm({ babyId, initial }: { babyId: string; initial?: StoolFormValue }) {
  const router = useRouter();
  const [time, setTime] = useState(initial?.stool_time ? isoToLocalInput(initial.stool_time) : nowLocalInput());
  const [cat,  setCat]  = useState<StoolFormValue['quantity_category']>(initial?.quantity_category ?? 'medium');
  const [ml,   setMl]   = useState(initial?.quantity_ml?.toString() ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [consistency, setConsistency] = useState(initial?.consistency ?? '');
  const [rash, setRash] = useState<boolean>(initial?.has_diaper_rash ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = StoolSchema.safeParse({
      stool_time: localInputToIso(time) ?? '',
      quantity_category: cat,
      quantity_ml: ml || null,
      color: color || null,
      consistency: consistency || null,
      has_diaper_rash: rash,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('stool_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('stool_logs').insert({ baby_id: babyId, ...parsed.data, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!confirm('Delete this stool log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('stool_logs').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
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
          <Label htmlFor="c">Size</Label>
          <Select id="c" value={cat ?? ''} onChange={e => setCat((e.target.value || null) as StoolFormValue['quantity_category'])}>
            <option value="">Pick a size…</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="q">Quantity (ml, optional)</Label>
          <Input id="q" type="number" inputMode="decimal" step="1" min={0} max={1000} value={ml} onChange={e => setMl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="col">Color</Label>
          <Input id="col" placeholder="yellow / green / brown…" value={color} onChange={e => setColor(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="con">Consistency</Label>
          <Input id="con" placeholder="watery / soft / firm…" value={consistency} onChange={e => setConsistency(e.target.value)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rash} onChange={e => setRash(e.target.checked)} />
        Diaper rash present
      </label>
      <div>
        <Label htmlFor="n">Notes</Label>
        <Textarea id="n" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save stool log'}</Button>
        {initial?.id && <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>Delete</Button>}
      </div>
    </form>
  );
}

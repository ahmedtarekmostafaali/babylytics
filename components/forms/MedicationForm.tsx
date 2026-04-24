'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicationSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

type Route = 'oral'|'topical'|'inhaled'|'nasal'|'rectal'|'injection'|'other';

export type MedicationFormValue = {
  id?: string;
  baby_id: string;
  name?: string;
  dosage?: string | null;
  route?: Route;
  frequency_hours?: number | null;
  total_doses?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  prescribed_by?: string | null;
  notes?: string | null;
};

export function MedicationForm({ babyId, initial }: { babyId: string; initial?: MedicationFormValue }) {
  const router = useRouter();
  const [name, setName]     = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [route, setRoute]   = useState<Route>(initial?.route ?? 'oral');
  const [freq, setFreq]     = useState(initial?.frequency_hours?.toString() ?? '8');
  const [doses, setDoses]   = useState(initial?.total_doses?.toString() ?? '');
  const [starts, setStarts] = useState(initial?.starts_at ? isoToLocalInput(initial.starts_at) : nowLocalInput());
  const [ends,   setEnds]   = useState(initial?.ends_at ? isoToLocalInput(initial.ends_at) : '');
  const [presc, setPresc]   = useState(initial?.prescribed_by ?? '');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = MedicationSchema.safeParse({
      name, dosage: dosage || null, route,
      frequency_hours: freq || null,
      total_doses: doses || null,
      starts_at: localInputToIso(starts) ?? '',
      ends_at: localInputToIso(ends),
      prescribed_by: presc || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('medications').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('medications').insert({ baby_id: babyId, ...parsed.data, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medications`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm(`Remove ${initial.name ?? 'this medication'}? Dose logs already recorded are kept in the database.`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('medications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medications`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label htmlFor="n">Medication name</Label>
        <Input id="n" required value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="d">Dosage &amp; unit</Label>
          <Input id="d" placeholder="e.g. 5 mg, 1 drop, 2 ml" value={dosage} onChange={e => setDosage(e.target.value)} />
          <p className="text-xs text-ink-muted mt-1">Include the unit so caregivers aren&apos;t guessing.</p>
        </div>
        <div>
          <Label htmlFor="r">Route</Label>
          <Select id="r" value={route} onChange={e => setRoute(e.target.value as Route)}>
            <option value="oral">Oral</option>
            <option value="topical">Topical</option>
            <option value="inhaled">Inhaled</option>
            <option value="nasal">Nasal</option>
            <option value="rectal">Rectal</option>
            <option value="injection">Injection</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="f">Frequency (hours)</Label>
          <Input id="f" type="number" inputMode="decimal" step="0.25" min={0.25} max={168} value={freq} onChange={e => setFreq(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="td">Total doses (optional)</Label>
          <Input id="td" type="number" inputMode="numeric" step="1" min={0} max={9999} value={doses} onChange={e => setDoses(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s">Starts at</Label>
          <Input id="s" type="datetime-local" required value={starts} onChange={e => setStarts(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="e">Ends at</Label>
          <Input id="e" type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="p">Prescribed by</Label>
        <Input id="p" placeholder="Pediatrician name (optional)" value={presc} onChange={e => setPresc(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="no">Notes</Label>
        <Textarea id="no" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add medication'}</Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving}>
            Delete medication
          </Button>
        )}
      </div>
    </form>
  );
}

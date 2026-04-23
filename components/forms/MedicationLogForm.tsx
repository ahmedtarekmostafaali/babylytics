'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicationLogSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

type Status = 'taken'|'missed'|'skipped';
type Med = { id: string; name: string };

export type MedLogFormValue = {
  id?: string;
  baby_id: string;
  medication_id?: string;
  medication_time?: string | null;
  status?: Status;
  actual_dosage?: string | null;
  notes?: string | null;
};

export function MedicationLogForm({ babyId, initial, defaultMedId }: { babyId: string; initial?: MedLogFormValue; defaultMedId?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [meds, setMeds] = useState<Med[]>([]);
  const [medId, setMedId]   = useState(initial?.medication_id ?? defaultMedId ?? '');
  const [time, setTime]     = useState(initial?.medication_time ? isoToLocalInput(initial.medication_time) : nowLocalInput());
  const [status, setStatus] = useState<Status>(initial?.status ?? 'taken');
  const [dose, setDose]     = useState(initial?.actual_dosage ?? '');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('medications')
      .select('id,name')
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Med[];
        setMeds(list);
        if (!medId && list[0]) setMedId(list[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!medId) { setErr('Pick a medication first (add one if this is the first dose).'); return; }
    const parsed = MedicationLogSchema.safeParse({
      medication_id: medId,
      medication_time: localInputToIso(time) ?? '',
      status,
      actual_dosage: dose || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const op = initial?.id
      ? supabase.from('medication_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('medication_logs').insert({ baby_id: babyId, ...parsed.data, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medications`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label htmlFor="m">Medication</Label>
        <Select id="m" value={medId} onChange={e => setMedId(e.target.value)}>
          <option value="">—</option>
          {meds.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
        {meds.length === 0 && <p className="text-xs text-slate-500 mt-1">No medications yet. Add one first.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="t">When</Label>
          <Input id="t" type="datetime-local" required value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="s">Status</Label>
          <Select id="s" value={status} onChange={e => setStatus(e.target.value as Status)}>
            <option value="taken">Taken</option>
            <option value="missed">Missed</option>
            <option value="skipped">Skipped</option>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="d">Actual dosage (optional)</Label>
        <Input id="d" placeholder="if different from prescribed" value={dose} onChange={e => setDose(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="n">Notes</Label>
        <Textarea id="n" rows={2} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log dose'}</Button>
    </form>
  );
}

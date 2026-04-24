'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MedicationLogSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Section, TypeTile, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Pill, Save, Check, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'taken'|'missed'|'skipped';
type Med = { id: string; name: string; dosage: string | null; route: string };

export type MedLogFormValue = {
  id?: string;
  baby_id: string;
  medication_id?: string;
  medication_time?: string | null;
  status?: Status;
  actual_dosage?: string | null;
  notes?: string | null;
};

export function MedicationLogForm({
  babyId, initial, defaultMedId,
}: {
  babyId: string;
  initial?: MedLogFormValue;
  defaultMedId?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [meds, setMeds] = useState<Med[]>([]);
  const [medsLoading, setMedsLoading] = useState(true);
  const [medId, setMedId]   = useState(initial?.medication_id ?? defaultMedId ?? '');
  const [time, setTime]     = useState(initial?.medication_time ? isoToLocalInput(initial.medication_time) : nowLocalInput());
  const [status, setStatus] = useState<Status>(initial?.status ?? 'taken');
  const [dose, setDose]     = useState(initial?.actual_dosage ?? '');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMedsLoading(true);
    supabase.from('medications')
      .select('id,name,dosage,route')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Med[];
        setMeds(list);
        setMedsLoading(false);
        if (!medId && list[0]) setMedId(list[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [babyId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!medId) { setErr('Pick a medication first.'); return; }
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

  const selectedMed = meds.find(m => m.id === medId);

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title="Which medication?">
        {medsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-ink-muted">Loading medications…</div>
        ) : meds.length === 0 ? (
          <div className="rounded-2xl border border-peach-300 bg-peach-50 p-4 text-sm">
            <p className="text-peach-900 font-medium">No medications set up yet.</p>
            <p className="text-peach-800/80 mt-1">
              <Link href={`/babies/${babyId}/medications/new`} className="underline font-semibold">Add one first</Link>,
              then come back to log a dose.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {meds.map(m => (
              <button key={m.id} type="button" onClick={() => setMedId(m.id)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-4 text-left transition',
                  medId === m.id
                    ? 'ring-2 ring-lavender-500 bg-lavender-50 border-transparent'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                )}>
                <div className={cn('h-11 w-11 rounded-xl grid place-items-center shrink-0',
                  medId === m.id ? 'bg-lavender-500 text-white' : 'bg-lavender-100 text-lavender-500'
                )}>
                  <Pill className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-strong truncate">{m.name}</div>
                  <div className="text-xs text-ink-muted truncate">
                    {m.dosage ? m.dosage : 'no dosage on file'}{m.route !== 'oral' ? ` · ${m.route}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section n={2} title="Status">
        <div className="grid grid-cols-3 gap-3">
          <TypeTile icon={Check}         label="Taken"   tint="mint"  active={status === 'taken'}   onClick={() => setStatus('taken')} />
          <TypeTile icon={AlertTriangle} label="Missed"  tint="coral" active={status === 'missed'}  onClick={() => setStatus('missed')} />
          <TypeTile icon={XCircle}       label="Skipped" tint="peach" active={status === 'skipped'} onClick={() => setStatus('skipped')} />
        </div>
      </Section>

      <Section n={3} title="When?">
        <WhenPicker time={time} onChange={setTime} tint="lavender" />
      </Section>

      <Section n={4} title="Actual dosage" optional>
        <Input placeholder={selectedMed?.dosage ? `Prescribed: ${selectedMed.dosage}` : 'e.g. 5 ml, 1 drop'}
          value={dose} onChange={e => setDose(e.target.value)} />
      </Section>

      <Section n={5} title="Add details" optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder="Any reaction, refusal, or observation?"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving || medsLoading || (meds.length === 0 && !medId)}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-lavender-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log dose'}
        </Button>
      </div>
    </form>
  );
}

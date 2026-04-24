'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Section, TypeTile } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Clock, Syringe, Check, X } from 'lucide-react';

type Status = 'scheduled'|'administered'|'skipped'|'missed';

export type VaccinationFormValue = {
  id?: string;
  baby_id: string;
  vaccine_name?: string;
  scheduled_at?: string | null;
  administered_at?: string | null;
  dose_number?: number | null;
  total_doses?: number | null;
  batch_number?: string | null;
  provider?: string | null;
  notes?: string | null;
  status?: Status;
};

export function VaccinationForm({ babyId, initial }: { babyId: string; initial?: VaccinationFormValue }) {
  const router = useRouter();
  const [name, setName]     = useState(initial?.vaccine_name ?? '');
  const [status, setStatus] = useState<Status>(initial?.status ?? 'scheduled');
  const [scheduled, setScheduled] = useState(initial?.scheduled_at ? isoToLocalInput(initial.scheduled_at) : '');
  const [administered, setAdministered] = useState(initial?.administered_at ? isoToLocalInput(initial.administered_at) : nowLocalInput());
  const [dose, setDose]     = useState(initial?.dose_number?.toString() ?? '1');
  const [total, setTotal]   = useState(initial?.total_doses?.toString() ?? '');
  const [batch, setBatch]   = useState(initial?.batch_number ?? '');
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim()) { setErr('Vaccine name is required.'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      vaccine_name: name.trim(),
      status,
      scheduled_at:    scheduled   ? localInputToIso(scheduled)   : null,
      administered_at: status === 'administered' ? localInputToIso(administered) : (initial?.administered_at ?? null),
      dose_number: dose ? Number(dose) : null,
      total_doses: total ? Number(total) : null,
      batch_number: batch || null,
      provider: provider || null,
      notes: notes || null,
    };
    const op = initial?.id
      ? supabase.from('vaccinations').update(payload).eq('id', initial.id)
      : supabase.from('vaccinations').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vaccinations`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this vaccination entry?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('vaccinations').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vaccinations`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title="Status">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TypeTile icon={Clock}   label="Scheduled"    tint="brand"    active={status === 'scheduled'}    onClick={() => setStatus('scheduled')} />
          <TypeTile icon={Syringe} label="Administered" tint="mint"     active={status === 'administered'} onClick={() => setStatus('administered')} />
          <TypeTile icon={X}       label="Skipped"      tint="peach"    active={status === 'skipped'}      onClick={() => setStatus('skipped')} />
          <TypeTile icon={Check}   label="Missed"       tint="coral"    active={status === 'missed'}       onClick={() => setStatus('missed')} />
        </div>
      </Section>

      <Section n={2} title="Vaccine details">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label htmlFor="v">Vaccine name</Label>
            <Input id="v" required placeholder="e.g. DTaP-IPV-Hib, MMR, Hepatitis B" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dn">Dose number</Label>
            <Input id="dn" type="number" min={1} max={10} value={dose} onChange={e => setDose(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="td">Total doses</Label>
            <Input id="td" type="number" min={1} max={10} value={total} onChange={e => setTotal(e.target.value)} />
          </div>
        </div>
      </Section>

      <Section n={3} title="When?">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sc">Scheduled</Label>
            <Input id="sc" type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} />
          </div>
          {status === 'administered' && (
            <div>
              <Label htmlFor="ad">Administered</Label>
              <Input id="ad" type="datetime-local" value={administered} onChange={e => setAdministered(e.target.value)} />
            </div>
          )}
        </div>
      </Section>

      <Section n={4} title="Provider & notes" optional>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prov">Provider / clinic</Label>
            <Input id="prov" placeholder="e.g. Dr. Ali · Cairo Family Clinic" value={provider} onChange={e => setProvider(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="batch">Batch number</Label>
            <Input id="batch" placeholder="Lot #" value={batch} onChange={e => setBatch(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="no">Notes</Label>
            <Textarea id="no" rows={3} placeholder="Any reactions, symptoms, or notes" value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-lavender-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save vaccination'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
        )}
      </div>
    </form>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicationSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Section, TypeTile, QuickPill } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import {
  Save, Trash2, Pill, Droplet, Wind, SprayCan, Syringe, Circle, Stethoscope,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  doctor_id?: string | null;
  prescribed_by?: string | null;
  notes?: string | null;
};

export type DoctorOption = {
  id: string;
  name: string;
  specialty: string | null;
};

// Common frequency presets in hours. "As needed" stores null.
const FREQ_PRESETS: { key: string; label: string; hours: number | null }[] = [
  { key: '4',  label: 'Every 4 h',  hours: 4 },
  { key: '6',  label: 'Every 6 h',  hours: 6 },
  { key: '8',  label: 'Every 8 h',  hours: 8 },
  { key: '12', label: 'Every 12 h', hours: 12 },
  { key: '24', label: 'Once daily', hours: 24 },
  { key: 'prn', label: 'As needed', hours: null },
];

export function MedicationForm({
  babyId, initial, doctors = [],
}: {
  babyId: string;
  initial?: MedicationFormValue;
  doctors?: DoctorOption[];
}) {
  const router = useRouter();
  const [name, setName]     = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [route, setRoute]   = useState<Route>(initial?.route ?? 'oral');
  const initialFreq = initial?.frequency_hours;
  const matchedPreset = FREQ_PRESETS.find(p => p.hours === (initialFreq ?? null));
  const [freqPreset, setFreqPreset] = useState<string | 'custom'>(matchedPreset?.key ?? (initialFreq == null ? 'prn' : 'custom'));
  const [freqCustom, setFreqCustom] = useState(
    (initialFreq != null && !matchedPreset) ? String(initialFreq) : '',
  );
  const [doses, setDoses]   = useState(initial?.total_doses?.toString() ?? '');
  const [starts, setStarts] = useState(initial?.starts_at ? isoToLocalInput(initial.starts_at) : nowLocalInput());
  const [ends,   setEnds]   = useState(initial?.ends_at ? isoToLocalInput(initial.ends_at) : '');
  // Doctor picker: either a specific doctor from the list, or "other" for free-text.
  type DoctorChoice = string | 'other' | 'none';
  const initialDoctorChoice: DoctorChoice = initial?.doctor_id
    ? initial.doctor_id
    : initial?.prescribed_by ? 'other' : 'none';
  const [doctorChoice, setDoctorChoice] = useState<DoctorChoice>(initialDoctorChoice);
  const [presc, setPresc]   = useState(initial?.prescribed_by ?? '');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resolvedFreqHours(): number | null {
    if (freqPreset === 'prn')    return null;
    if (freqPreset === 'custom') return freqCustom ? Number(freqCustom) : null;
    const p = FREQ_PRESETS.find(x => x.key === freqPreset);
    return p?.hours ?? null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Resolve doctor selection into the two columns we persist. We snapshot
    // the doctor's name into `prescribed_by` too so deleting the doctor row
    // later doesn't leave medications with no attribution.
    let doctorId: string | null = null;
    let prescribedBy: string | null = null;
    if (doctorChoice === 'other')       { doctorId = null;          prescribedBy = presc || null; }
    else if (doctorChoice === 'none')   { doctorId = null;          prescribedBy = null; }
    else {
      doctorId = doctorChoice;
      const doc = doctors.find(d => d.id === doctorChoice);
      prescribedBy = doc?.name ?? null;
    }

    const parsed = MedicationSchema.safeParse({
      name, dosage: dosage || null, route,
      frequency_hours: resolvedFreqHours(),
      total_doses: doses || null,
      starts_at: localInputToIso(starts) ?? '',
      ends_at: localInputToIso(ends),
      doctor_id: doctorId,
      prescribed_by: prescribedBy,
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
    const { error } = await supabase.from('medications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medications`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Name */}
      <Section n={1} title="Medication name">
        <div className="relative">
          <Pill className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-lavender-500 pointer-events-none" />
          <Input required value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Amoxicillin, Paracetamol"
            className="h-14 pl-11 text-base" />
        </div>
      </Section>

      {/* 2. Dosage */}
      <Section n={2} title="Dosage per dose">
        <Input value={dosage ?? ''} onChange={e => setDosage(e.target.value)}
          placeholder="e.g. 5 ml, 2.5 mg, 1 drop"
          className="h-12 text-base" />
        <p className="mt-2 text-xs text-ink-muted">Include the unit so every caregiver is on the same page.</p>
      </Section>

      {/* 3. Route */}
      <Section n={3} title="How is it given?">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TypeTile icon={Droplet}    label="Oral"      tint="lavender" active={route === 'oral'}      onClick={() => setRoute('oral')} sub="by mouth" />
          <TypeTile icon={Circle}     label="Topical"   tint="mint"     active={route === 'topical'}   onClick={() => setRoute('topical')} sub="on skin" />
          <TypeTile icon={Wind}       label="Inhaled"   tint="brand"    active={route === 'inhaled'}   onClick={() => setRoute('inhaled')} sub="breath" />
          <TypeTile icon={SprayCan}   label="Nasal"     tint="peach"    active={route === 'nasal'}     onClick={() => setRoute('nasal')} sub="spray" />
          <TypeTile icon={Circle}     label="Rectal"    tint="coral"    active={route === 'rectal'}    onClick={() => setRoute('rectal')} sub="suppository" />
          <TypeTile icon={Syringe}    label="Injection" tint="lavender" active={route === 'injection'} onClick={() => setRoute('injection')} sub="shot" />
          <TypeTile icon={Circle}     label="Other"     tint="mint"     active={route === 'other'}     onClick={() => setRoute('other')} sub="" />
        </div>
      </Section>

      {/* 4. Frequency */}
      <Section n={4} title="How often?">
        <div className="flex items-center gap-2 flex-wrap">
          {FREQ_PRESETS.map(p => (
            <QuickPill key={p.key}
              active={freqPreset === p.key}
              onClick={() => setFreqPreset(p.key)}
              icon={<Clock className="h-3.5 w-3.5" />}
              tint="lavender">
              {p.label}
            </QuickPill>
          ))}
          <QuickPill
            active={freqPreset === 'custom'}
            onClick={() => setFreqPreset('custom')}
            icon={<Clock className="h-3.5 w-3.5" />}
            tint="lavender">
            Custom
          </QuickPill>
        </div>
        {freqPreset === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <Input type="number" step="0.25" min={0.25} max={168}
              value={freqCustom} onChange={e => setFreqCustom(e.target.value)}
              placeholder="e.g. 10"
              className="h-12 max-w-[160px]" />
            <span className="text-sm text-ink-muted">hours between doses</span>
          </div>
        )}
      </Section>

      {/* 5. Duration */}
      <Section n={5} title="When does it start — and stop?">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Starts</div>
            <Input type="datetime-local" required value={starts} onChange={e => setStarts(e.target.value)} />
          </div>
          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Ends <span className="text-ink-muted/70 font-normal">(optional)</span></div>
            <Input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Total doses <span className="text-ink-muted/70 font-normal">(optional)</span></div>
          <Input type="number" step="1" min={0} max={9999}
            value={doses} onChange={e => setDoses(e.target.value)}
            placeholder="e.g. 21"
            className="max-w-[160px]" />
          <p className="mt-1 text-xs text-ink-muted">Stops reminders once you&apos;ve logged this many doses.</p>
        </div>
      </Section>

      {/* 6. Prescribed by */}
      <Section n={6} title="Who prescribed it?" optional>
        {doctors.length === 0 ? (
          <div className="space-y-3">
            <div className="relative">
              <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input value={presc ?? ''} onChange={e => {
                setPresc(e.target.value);
                setDoctorChoice(e.target.value ? 'other' : 'none');
              }}
                placeholder="Dr. Sarah Ahmed"
                className={cn('pl-10')} />
            </div>
            <p className="text-xs text-ink-muted">
              Tip: add your baby&apos;s doctors on the{' '}
              <a href={`/babies/${babyId}/doctors`} className="text-lavender-700 font-semibold hover:underline">Doctors page</a>{' '}
              so you can pick from a list next time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {doctors.map(d => {
                const active = doctorChoice === d.id;
                return (
                  <button type="button" key={d.id}
                    onClick={() => setDoctorChoice(d.id)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                      active
                        ? 'ring-2 ring-lavender-500 border-transparent bg-lavender-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}>
                    <span className={cn(
                      'h-10 w-10 rounded-xl grid place-items-center shrink-0',
                      active ? 'bg-lavender-500 text-white' : 'bg-lavender-100 text-lavender-600',
                    )}>
                      <Stethoscope className="h-4 w-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-ink-strong truncate">{d.name}</span>
                      <span className="block text-xs text-ink-muted truncate">{d.specialty ?? 'doctor'}</span>
                    </span>
                  </button>
                );
              })}
              <button type="button"
                onClick={() => setDoctorChoice('other')}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                  doctorChoice === 'other'
                    ? 'ring-2 ring-lavender-500 border-transparent bg-lavender-50'
                    : 'border-slate-200 border-dashed bg-white hover:bg-slate-50',
                )}>
                <span className={cn(
                  'h-10 w-10 rounded-xl grid place-items-center shrink-0',
                  doctorChoice === 'other' ? 'bg-lavender-500 text-white' : 'bg-slate-100 text-ink-muted',
                )}>
                  <Stethoscope className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink-strong">Other</span>
                  <span className="block text-xs text-ink-muted">type a name</span>
                </span>
              </button>
              <button type="button"
                onClick={() => { setDoctorChoice('none'); setPresc(''); }}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
                  doctorChoice === 'none'
                    ? 'ring-2 ring-slate-400 border-transparent bg-slate-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                )}>
                <span className="h-10 w-10 rounded-xl bg-slate-100 text-ink-muted grid place-items-center shrink-0">
                  ×
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink-strong">Skip</span>
                  <span className="block text-xs text-ink-muted">don&apos;t attribute</span>
                </span>
              </button>
            </div>

            {doctorChoice === 'other' && (
              <div className="relative mt-1">
                <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <Input value={presc ?? ''} onChange={e => setPresc(e.target.value)}
                  placeholder="Doctor name"
                  className="pl-10" />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 7. Notes */}
      <Section n={7} title="Add details" optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder="Instructions, reactions, storage tips…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-brand-500">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add medication'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving}
            className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

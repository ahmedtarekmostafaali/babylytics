'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicationSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Section, TypeTile, QuickPill } from '@/components/forms/FormKit';
import { useT } from '@/lib/i18n/client';
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
  // 045 batch — structured dosage amount + unit
  dosage_amount?: number | null;
  dosage_unit?: string | null;
};

// Pediatric dosage units. "spoon_5ml" is the standard pediatric teaspoon
// supplied with most syrups in Egypt; "spoon_15ml" is a tablespoon.
const DOSAGE_UNITS: { key: string; label: string }[] = [
  { key: 'drop',         label: 'Drop' },
  { key: 'tab',          label: 'Tablet' },
  { key: 'capsule',      label: 'Capsule' },
  { key: 'spoon_5ml',    label: 'Teaspoon (5 ml)' },
  { key: 'spoon_15ml',   label: 'Tablespoon (15 ml)' },
  { key: 'ml',           label: 'ml' },
  { key: 'mg',           label: 'mg' },
  { key: 'puff',         label: 'Puff (inhaler)' },
  { key: 'sachet',       label: 'Sachet' },
  { key: 'application',  label: 'Application' },
  { key: 'suppository',  label: 'Suppository' },
  { key: 'iu',           label: 'IU' },
  { key: 'other',        label: 'Other…' },
];

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
  const t = useT();
  const [name, setName]     = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  // Structured amount + unit (added in 045 batch). Falls back to free-text
  // `dosage` for legacy rows. We let parents pick from a fixed list of
  // pediatric units; "Other" reveals a free-text input.
  const [dosageAmount, setDosageAmount] = useState<string>(
    initial?.dosage_amount?.toString() ?? '');
  const [dosageUnit,   setDosageUnit]   = useState<string>(initial?.dosage_unit ?? '');
  const [dosageUnitOther, setDosageUnitOther] = useState<string>('');
  const [route, setRoute]   = useState<Route>(initial?.route ?? 'oral');
  // When route === 'other' we prompt for a free-text label and merge it
  // into the notes field on save (we don't have a separate column for it).
  const [routeOther, setRouteOther] = useState<string>('');
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

    // Resolve the dosage unit: 'other' means we wrote a free-text label
    // into dosageUnitOther — persist that into the legacy `dosage` text
    // field so existing UIs that show free-text can still render it.
    let resolvedUnit: string | null = dosageUnit || null;
    let resolvedDosageText: string | null = dosage || null;
    if (dosageUnit === 'other' && dosageUnitOther.trim()) {
      resolvedUnit = 'other';
      resolvedDosageText = dosageAmount
        ? `${dosageAmount} ${dosageUnitOther.trim()}`
        : dosageUnitOther.trim();
    }

    // Surface a custom route specification by appending it to notes —
    // we don't add a new column for it.
    const finalNotes = (route === 'other' && routeOther.trim())
      ? [`Route: ${routeOther.trim()}`, notes].filter(Boolean).join('\n')
      : (notes || null);

    const parsed = MedicationSchema.safeParse({
      name, dosage: resolvedDosageText, route,
      frequency_hours: resolvedFreqHours(),
      total_doses: doses || null,
      starts_at: localInputToIso(starts) ?? '',
      ends_at: localInputToIso(ends),
      doctor_id: doctorId,
      prescribed_by: prescribedBy,
      notes: finalNotes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    // Tack on the structured dosage columns next to whatever the schema
    // returned. The validator doesn't know about them yet but Supabase
    // accepts unknown keys as direct column writes.
    const extras = {
      dosage_amount: dosageAmount ? Number(dosageAmount) : null,
      dosage_unit: resolvedUnit,
    };
    const op = initial?.id
      ? supabase.from('medications').update({ ...parsed.data, ...extras }).eq('id', initial.id)
      : supabase.from('medications').insert({ baby_id: babyId, ...parsed.data, ...extras, created_by: (await supabase.auth.getUser()).data.user?.id });
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
      <Section n={1} title={t('forms.med_name')}>
        <div className="relative">
          <Pill className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-lavender-500 pointer-events-none" />
          <Input required value={name} onChange={e => setName(e.target.value)}
            className="h-14 pl-11 text-base" />
        </div>
      </Section>

      {/* 2. Dosage — structured amount + unit (free-text 'dosage' below for
            anything that doesn't fit, e.g. "1 tab AM, ½ tab PM"). */}
      <Section n={2} title={t('forms.med_dosage')}>
        <div className="grid grid-cols-[120px_1fr] gap-2 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Amount</label>
            <input type="number" min={0} step="0.001" value={dosageAmount}
              onChange={e => setDosageAmount(e.target.value)}
              placeholder="e.g. 2.5"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base font-semibold focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Unit</label>
            <select value={dosageUnit}
              onChange={e => setDosageUnit(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30">
              <option value="">— pick one —</option>
              {DOSAGE_UNITS.map(u => <option key={u.key} value={u.key}>{u.label}</option>)}
            </select>
          </div>
        </div>
        {dosageUnit === 'other' && (
          <div className="mt-2">
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Specify the unit</label>
            <Input value={dosageUnitOther} onChange={e => setDosageUnitOther(e.target.value)}
              placeholder="e.g. patch, gum, lozenge"
              className="h-12 text-base" />
          </div>
        )}
        <details className="mt-3">
          <summary className="text-[11px] text-ink-muted cursor-pointer hover:text-ink">
            Need free-form text instead? (e.g. complex sliding-scale dose)
          </summary>
          <div className="mt-2">
            <Input value={dosage ?? ''} onChange={e => setDosage(e.target.value)}
              placeholder="Anything that doesn't fit the dropdown"
              className="h-12 text-base" />
          </div>
        </details>
      </Section>

      {/* 3. Route */}
      <Section n={3} title={t('forms.med_route')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TypeTile icon={Droplet}    label={t('forms.med_route_oral')}      tint="lavender" active={route === 'oral'}      onClick={() => setRoute('oral')} sub={t('forms.med_route_oral_sub')} />
          <TypeTile icon={Circle}     label={t('forms.med_route_topical')}   tint="mint"     active={route === 'topical'}   onClick={() => setRoute('topical')} sub={t('forms.med_route_topical_sub')} />
          <TypeTile icon={Wind}       label={t('forms.med_route_inhaled')}   tint="brand"    active={route === 'inhaled'}   onClick={() => setRoute('inhaled')} sub={t('forms.med_route_inhaled_sub')} />
          <TypeTile icon={SprayCan}   label={t('forms.med_route_nasal')}     tint="peach"    active={route === 'nasal'}     onClick={() => setRoute('nasal')} sub={t('forms.med_route_nasal_sub')} />
          <TypeTile icon={Circle}     label={t('forms.med_route_rectal')}    tint="coral"    active={route === 'rectal'}    onClick={() => setRoute('rectal')} sub={t('forms.med_route_rectal_sub')} />
          <TypeTile icon={Syringe}    label={t('forms.med_route_injection')} tint="lavender" active={route === 'injection'} onClick={() => setRoute('injection')} sub={t('forms.med_route_injection_sub')} />
          <TypeTile icon={Circle}     label={t('forms.med_route_other')}     tint="mint"     active={route === 'other'}     onClick={() => setRoute('other')} sub="" />
        </div>
        {route === 'other' && (
          <div className="mt-3">
            <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Specify the route</label>
            <Input value={routeOther} onChange={e => setRouteOther(e.target.value)}
              placeholder="e.g. transdermal patch, ear drops, eye drops"
              className="h-12 text-base" />
          </div>
        )}
      </Section>

      {/* 4. Frequency */}
      <Section n={4} title={t('forms.med_frequency')}>
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
            {t('forms.med_freq_custom')}
          </QuickPill>
        </div>
        {freqPreset === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <Input type="number" step="0.25" min={0.25} max={168}
              value={freqCustom} onChange={e => setFreqCustom(e.target.value)}
              className="h-12 max-w-[160px]" />
            <span className="text-sm text-ink-muted">{t('forms.med_freq_custom_sub')}</span>
          </div>
        )}
      </Section>

      {/* 5. Duration */}
      <Section n={5} title={t('forms.med_starts_at')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t('forms.med_starts')}</div>
            <Input type="datetime-local" required value={starts} onChange={e => setStarts(e.target.value)} />
          </div>
          <div>
            <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t('forms.med_ends')} <span className="text-ink-muted/70 font-normal">({t('forms.optional')})</span></div>
            <Input type="datetime-local" value={ends} onChange={e => setEnds(e.target.value)} />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">{t('forms.med_total_doses')}</div>
          <Input type="number" step="1" min={0} max={9999}
            value={doses} onChange={e => setDoses(e.target.value)}
            className="max-w-[160px]" />
          <p className="mt-1 text-xs text-ink-muted">{t('forms.med_total_doses_sub')}</p>
        </div>
      </Section>

      {/* 6. Prescribed by */}
      <Section n={6} title={t('forms.med_prescribed_by')} optional>
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
                  <span className="block font-semibold text-ink-strong">{t('forms.med_doctor_other')}</span>
                  <span className="block text-xs text-ink-muted">{t('forms.med_doctor_other_sub')}</span>
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
                  <span className="block font-semibold text-ink-strong">{t('forms.med_doctor_skip')}</span>
                  <span className="block text-xs text-ink-muted">{t('forms.med_doctor_skip_sub')}</span>
                </span>
              </button>
            </div>

            {doctorChoice === 'other' && (
              <div className="relative mt-1">
                <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <Input value={presc ?? ''} onChange={e => setPresc(e.target.value)}
                  placeholder={t('forms.med_doctor_name')}
                  className="pl-10" />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* 7. Notes */}
      <Section n={7} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-brand-500">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.med_save_cta')}
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

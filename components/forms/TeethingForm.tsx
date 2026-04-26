'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TeethingSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, QuickPill, Stepper, WhenPicker } from '@/components/forms/FormKit';
import { useT } from '@/lib/i18n/client';

export type TeethingValue = {
  id?: string;
  observed_at: string;
  tooth_label?: string | null;
  event_type: 'eruption'|'swelling'|'pain'|'fever'|'soothing'|'lost';
  pain_level?: number | null;
  fever_c?: number | null;
  soother_used?: string | null;
  notes?: string | null;
};

const EVENTS: { value: TeethingValue['event_type']; label: string; emoji: string }[] = [
  { value: 'eruption', label: 'New tooth out', emoji: '🦷' },
  { value: 'swelling', label: 'Swollen gums',  emoji: '😣' },
  { value: 'pain',     label: 'Pain / fussy',  emoji: '😢' },
  { value: 'fever',    label: 'Fever',         emoji: '🌡️' },
  { value: 'soothing', label: 'Soothing care', emoji: '🧊' },
  { value: 'lost',     label: 'Tooth fell out',emoji: '🦷' },
];

const SUGGESTED_TEETH = [
  'lower central left',  'lower central right',
  'upper central left',  'upper central right',
  'lower lateral left',  'lower lateral right',
  'upper lateral left',  'upper lateral right',
  'first molar',         'canine',
];

const SUGGESTED_SOOTHERS = [
  'cold teething ring', 'frozen washcloth', 'gum massage', 'paracetamol',
  'cold spoon', 'silicone toy', 'breastfeeding', 'extra cuddles',
];

export function TeethingForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: TeethingValue;
}) {
  const router = useRouter();
  const t = useT();
  const [observedAt, setObservedAt] = useState(initial?.observed_at ? isoToLocalInput(initial.observed_at) : nowLocalInput());
  const [toothLabel, setToothLabel] = useState(initial?.tooth_label ?? '');
  const [eventType,  setEventType]  = useState<TeethingValue['event_type']>(initial?.event_type ?? 'eruption');
  const [painLevel,  setPainLevel]  = useState<number>(initial?.pain_level ?? 0);
  const [feverC,     setFeverC]     = useState<string>(initial?.fever_c != null ? String(initial.fever_c) : '');
  const [soother,    setSoother]    = useState(initial?.soother_used ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(observedAt);
    if (!iso) { setErr('Pick a valid time.'); return; }
    const parsed = TeethingSchema.safeParse({
      observed_at: iso,
      tooth_label: toothLabel || null,
      event_type:  eventType,
      pain_level:  painLevel || null,
      fever_c:     feverC ? Number(feverC) : null,
      soother_used: soother || null,
      notes:       notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('teething_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('teething_logs').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/teething`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this teething log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('teething_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/teething`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Event type */}
      <Section n={1} title={t('forms.teething_what')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EVENTS.map(ev => (
            <button type="button" key={ev.value} onClick={() => setEventType(ev.value)}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition flex items-center gap-2',
                eventType === ev.value
                  ? 'border-peach-500 bg-peach-50 text-peach-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink',
              )}>
              <span className="text-xl leading-none">{ev.emoji}</span>
              <span className="leading-tight">{t(`forms.teething_event_${ev.value}`)}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 2. Tooth label */}
      <Section n={2} title={t('forms.teething_which')} optional>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_TEETH.map(tooth => (
              <QuickPill key={tooth} active={toothLabel === tooth} onClick={() => setToothLabel(tooth)} tint="peach">
                {tooth}
              </QuickPill>
            ))}
          </div>
          <Field label={t('forms.teething_which')}>
            <input
              value={toothLabel}
              onChange={e => setToothLabel(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 3. Symptoms */}
      <Section n={3} title={t('forms.teething_symptoms')} optional>
        <div className="space-y-4">
          <Stepper
            label={t('forms.teething_pain')}
            value={painLevel}
            onChange={setPainLevel}
            unit=""
            step={1}
            min={0}
            max={10}
            badge={{ text: 'PAIN', tint: 'peach' }}
          />
          <Field label={t('forms.teething_fever')}>
            <input
              type="number"
              step="0.1"
              min={30}
              max={45}
              value={feverC}
              onChange={e => setFeverC(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 4. Care */}
      <Section n={4} title={t('forms.teething_what_helped')} optional>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_SOOTHERS.map(s => (
              <QuickPill key={s} active={soother === s} onClick={() => setSoother(s)} tint="peach">
                {s}
              </QuickPill>
            ))}
          </div>
          <Field label={t('forms.teething_soother')}>
            <input
              value={soother}
              onChange={e => setSoother(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 5. When */}
      <Section n={5} title={t('forms.when')}>
        <WhenPicker time={observedAt} onChange={setObservedAt} tint="peach" />
      </Section>

      {/* 6. Notes */}
      <Section n={6} title={t('forms.notes')} optional>
        <Field label={t('forms.notes')}>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-peach-500 focus:ring-2 focus:ring-peach-500/30"
          />
        </Field>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-peach-500 to-coral-500 hover:from-peach-600 hover:to-coral-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.teething_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">{t('forms.fast_log')} <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

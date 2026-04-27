'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { MaternalSymptomSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { Save } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

type Kind =
  | 'nausea' | 'vomiting' | 'dizziness' | 'headache' | 'swelling'
  | 'contractions' | 'fatigue' | 'heartburn' | 'back_pain'
  | 'mood_swings' | 'cramping' | 'breathlessness' | 'other';

const KIND_TINTS: Record<Kind, string> = {
  nausea:         'bg-mint-100 text-mint-700 border-mint-200',
  vomiting:       'bg-coral-100 text-coral-700 border-coral-200',
  dizziness:      'bg-lavender-100 text-lavender-700 border-lavender-200',
  headache:       'bg-peach-100 text-peach-700 border-peach-200',
  swelling:       'bg-brand-100 text-brand-700 border-brand-200',
  contractions:   'bg-coral-100 text-coral-700 border-coral-200',
  fatigue:        'bg-lavender-100 text-lavender-700 border-lavender-200',
  heartburn:      'bg-peach-100 text-peach-700 border-peach-200',
  back_pain:      'bg-mint-100 text-mint-700 border-mint-200',
  mood_swings:    'bg-lavender-100 text-lavender-700 border-lavender-200',
  cramping:       'bg-coral-100 text-coral-700 border-coral-200',
  breathlessness: 'bg-brand-100 text-brand-700 border-brand-200',
  other:          'bg-slate-100 text-slate-700 border-slate-200',
};

const KIND_EMOJI: Record<Kind, string> = {
  nausea: '🤢', vomiting: '🤮', dizziness: '😵‍💫', headache: '🤕',
  swelling: '🦶', contractions: '💥', fatigue: '😴', heartburn: '🔥',
  back_pain: '🩹', mood_swings: '🎭', cramping: '⚡', breathlessness: '🫁',
  other: '✏️',
};

export type SymptomFormValue = {
  id?: string;
  baby_id: string;
  logged_at?: string | null;
  kind?: Kind;
  severity?: number | null;
  notes?: string | null;
};

export function SymptomForm({ babyId, initial }: { babyId: string; initial?: SymptomFormValue }) {
  const router = useRouter();
  const t = useT();

  const [time, setTime] = useState(initial?.logged_at ? isoToLocalInput(initial.logged_at) : nowLocalInput());
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'nausea');
  const [severity, setSeverity] = useState<number>(initial?.severity ?? 2);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const KIND_LABEL: Record<Kind, string> = {
    nausea:         t('forms.symp_nausea'),
    vomiting:       t('forms.symp_vomiting'),
    dizziness:      t('forms.symp_dizziness'),
    headache:       t('forms.symp_headache'),
    swelling:       t('forms.symp_swelling'),
    contractions:   t('forms.symp_contractions'),
    fatigue:        t('forms.symp_fatigue'),
    heartburn:      t('forms.symp_heartburn'),
    back_pain:      t('forms.symp_back_pain'),
    mood_swings:    t('forms.symp_mood_swings'),
    cramping:       t('forms.symp_cramping'),
    breathlessness: t('forms.symp_breathlessness'),
    other:          t('forms.symp_other'),
  };

  const SEV_LABELS = [
    t('forms.sev_1'),
    t('forms.sev_2'),
    t('forms.sev_3'),
    t('forms.sev_4'),
    t('forms.sev_5'),
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr(t('forms.symp_err_time')); return; }
    const parsed = MaternalSymptomSchema.safeParse({
      logged_at: iso,
      kind,
      severity,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('maternal_symptoms').update({
          logged_at: iso, kind, severity, notes: notes || null,
        }).eq('id', initial.id)
      : supabase.from('maternal_symptoms').insert({
          baby_id: babyId, logged_at: iso, kind, severity, notes: notes || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/symptoms`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm(t('forms.symp_del_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('maternal_symptoms')
      .update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/symptoms`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title={t('forms.symp_kind_title')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {(Object.keys(KIND_LABEL) as Kind[]).map(k => (
            <button type="button" key={k} onClick={() => setKind(k)}
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition',
                kind === k
                  ? `${KIND_TINTS[k]} ring-2 ring-current/30 font-semibold`
                  : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
              )}>
              <span className="text-lg leading-none">{KIND_EMOJI[k]}</span>
              <span className="text-sm">{KIND_LABEL[k]}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section n={2} title={t('forms.symp_sev_title')}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button type="button" key={s} onClick={() => setSeverity(s)}
                className={cn(
                  'flex-1 h-14 rounded-xl border-2 font-bold text-lg transition',
                  severity === s
                    ? s >= 4 ? 'bg-coral-500 text-white border-coral-500'
                    : s === 3 ? 'bg-peach-500 text-white border-peach-500'
                    : 'bg-mint-500 text-white border-mint-500'
                    : 'bg-white text-ink-muted border-slate-200 hover:bg-slate-50'
                )}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm text-ink-strong text-center font-medium">
            {SEV_LABELS[severity - 1]}
          </div>
        </div>
      </Section>

      <Section n={3} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="lavender" />
      </Section>

      <Section n={4} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.symp_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-coral-500">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.symp_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">{t('forms.delete')}</Button>
        )}
      </div>
    </form>
  );
}

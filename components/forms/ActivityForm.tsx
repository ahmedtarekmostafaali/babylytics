'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ActivitySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, QuickPill, Stepper, WhenPicker } from '@/components/forms/FormKit';
import { useT } from '@/lib/i18n/client';

export type ActivityValue = {
  id?: string;
  started_at: string;
  duration_min?: number | null;
  activity_type: string;
  intensity?: 'low'|'moderate'|'high'|null;
  location?: string | null;
  mood?: 'happy'|'calm'|'fussy'|'tired'|'curious'|'other'|null;
  notes?: string | null;
};

const SUGGESTED_ACTIVITIES = [
  'Tummy time', 'Walk', 'Park', 'Swim', 'Music time', 'Reading',
  'Sensory play', 'Massage', 'Bath play', 'Garden', 'Dancing', 'Gym',
];

const INTENSITIES: { value: NonNullable<ActivityValue['intensity']>; label: string }[] = [
  { value: 'low',      label: 'Low'      },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high',     label: 'High'     },
];

const MOODS: { value: NonNullable<ActivityValue['mood']>; label: string }[] = [
  { value: 'happy',   label: 'Happy'   },
  { value: 'calm',    label: 'Calm'    },
  { value: 'curious', label: 'Curious' },
  { value: 'fussy',   label: 'Fussy'   },
  { value: 'tired',   label: 'Tired'   },
  { value: 'other',   label: 'Other'   },
];

export function ActivityForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ActivityValue;
}) {
  const router = useRouter();
  const t = useT();
  const [startedAt, setStartedAt] = useState(initial?.started_at ? isoToLocalInput(initial.started_at) : nowLocalInput());
  const [duration, setDuration]   = useState<number>(initial?.duration_min ?? 15);
  const [type, setType]           = useState(initial?.activity_type ?? '');
  const [intensity, setIntensity] = useState<ActivityValue['intensity']>(initial?.intensity ?? 'low');
  const [location, setLocation]   = useState(initial?.location ?? '');
  const [mood, setMood]           = useState<ActivityValue['mood']>(initial?.mood ?? 'happy');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(startedAt);
    if (!iso) { setErr('Pick a valid start time.'); return; }
    const parsed = ActivitySchema.safeParse({
      started_at: iso,
      duration_min: duration ? Number(duration) : null,
      activity_type: type,
      intensity: intensity || null,
      location: location || null,
      mood: mood || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('activity_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('activity_logs').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/activities`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this activity log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('activity_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/activities`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Activity */}
      <Section n={1} title={t('forms.act_what')}>
        <div className="space-y-3">
          {!initial?.id && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_ACTIVITIES.map(a => (
                <QuickPill key={a} active={type === a} onClick={() => setType(a)} tint="mint">
                  {a}
                </QuickPill>
              ))}
            </div>
          )}
          <Field label={t('forms.act_name')}>
            <input
              value={type}
              onChange={e => setType(e.target.value)}
              required
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 2. Details */}
      <Section n={2} title={t('forms.act_details')}>
        <div className="space-y-4">
          <Stepper
            label={t('forms.act_duration')}
            value={duration}
            onChange={setDuration}
            unit="min"
            step={5}
            min={0}
            max={720}
            badge={{ text: 'TIME', tint: 'mint' }}
          />

          <Field label={t('forms.act_intensity')}>
            <div className="flex flex-wrap gap-2">
              {INTENSITIES.map(it => (
                <QuickPill key={it.value} active={intensity === it.value} onClick={() => setIntensity(it.value)} tint="mint">
                  {t(`forms.act_int_${it.value}`)}
                </QuickPill>
              ))}
            </div>
          </Field>

          <Field label={t('forms.act_mood')}>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <QuickPill key={m.value} active={mood === m.value} onClick={() => setMood(m.value)} tint="mint">
                  {t(`forms.act_mood_${m.value}`)}
                </QuickPill>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {/* 3. When */}
      <Section n={3} title={t('forms.when')}>
        <WhenPicker time={startedAt} onChange={setStartedAt} tint="mint" />
      </Section>

      {/* 4. Add details */}
      <Section n={4} title={t('forms.feed_add_details')} optional>
        <div className="space-y-3">
          <Field label={t('forms.act_location')}>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              className={cn(
                'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base',
                'focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30'
              )}
            />
          </Field>
          <Field label={t('forms.notes')}>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30"
            />
          </Field>
        </div>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-mint-500 to-brand-500 hover:from-mint-600 hover:to-brand-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.act_log_cta')}
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

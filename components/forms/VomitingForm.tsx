'use client';

// VomitingForm — capture a single vomiting episode. Pediatricians ask 3
// things when a parent reports vomit: when, what came up (colour /
// content), and how forceful. We mirror that with severity buckets +
// content-type radios + free text for triggers (e.g. "right after the
// banana", "30 min after milk"), all behind one fast form.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, WhenPicker, Field } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, AlertTriangle } from 'lucide-react';

export type VomitingFormValue = {
  id?: string;
  baby_id: string;
  vomited_at?: string | null;
  severity?: 'mild' | 'moderate' | 'severe' | 'projectile' | null;
  content_type?: 'milk' | 'food' | 'clear' | 'bilious' | 'blood_streaked' | 'mixed' | 'other' | null;
  triggered_by?: string | null;
  related_food?: string | null;
  notes?: string | null;
};

const SEVERITY: { key: NonNullable<VomitingFormValue['severity']>; label: string; tint: string }[] = [
  { key: 'mild',       label: 'Mild',       tint: 'mint' },
  { key: 'moderate',   label: 'Moderate',   tint: 'peach' },
  { key: 'severe',     label: 'Severe',     tint: 'coral' },
  { key: 'projectile', label: 'Projectile', tint: 'coral' },
];

const CONTENT: { key: NonNullable<VomitingFormValue['content_type']>; label: string; hint: string }[] = [
  { key: 'milk',           label: 'Milk',           hint: 'Curdled or fresh' },
  { key: 'food',           label: 'Food',           hint: 'Solids/puree' },
  { key: 'clear',          label: 'Clear / mucousy',hint: 'Thin, watery' },
  { key: 'bilious',        label: 'Bilious (green)',hint: 'Yellow-green = call doctor' },
  { key: 'blood_streaked', label: 'Blood-streaked', hint: 'Red specks/streaks = call doctor' },
  { key: 'mixed',          label: 'Mixed',          hint: '' },
  { key: 'other',          label: 'Other',          hint: '' },
];

export function VomitingForm({ babyId, initial }: { babyId: string; initial?: VomitingFormValue }) {
  const router = useRouter();
  const [time, setTime]         = useState(initial?.vomited_at ? isoToLocalInput(initial.vomited_at) : nowLocalInput());
  const [severity, setSeverity] = useState<VomitingFormValue['severity']>(initial?.severity ?? 'mild');
  const [content, setContent]   = useState<VomitingFormValue['content_type']>(initial?.content_type ?? 'milk');
  const [trig, setTrig]         = useState(initial?.triggered_by ?? '');
  const [food, setFood]         = useState(initial?.related_food ?? '');
  const [notes, setNotes]       = useState(initial?.notes ?? '');
  const [err, setErr]           = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }

    const payload = {
      vomited_at: iso,
      severity, content_type: content,
      triggered_by: trig.trim() || null,
      related_food: food.trim() || null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('vomiting_logs').update(payload).eq('id', initial.id)
      : supabase.from('vomiting_logs').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vomiting`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this vomiting log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('vomiting_logs')
      .update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vomiting`);
    router.refresh();
  }

  // Highlight a serious-content warning if the parent picked bilious or
  // blood-streaked — those colours are pediatric red flags.
  const seriousContent = content === 'bilious' || content === 'blood_streaked';

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="Severity" n={1}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SEVERITY.map(s => {
            const on = severity === s.key;
            const tintMap: Record<string, string> = {
              mint:  on ? 'bg-mint-500 text-white border-mint-500'   : 'bg-white text-mint-700 border-mint-200',
              peach: on ? 'bg-peach-500 text-white border-peach-500' : 'bg-white text-peach-700 border-peach-200',
              coral: on ? 'bg-coral-500 text-white border-coral-500' : 'bg-white text-coral-700 border-coral-200',
            };
            return (
              <button key={s.key} type="button" onClick={() => setSeverity(s.key)}
                className={`rounded-2xl border-2 px-3 py-3 text-sm font-bold transition ${tintMap[s.tint]}`}>
                {s.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Content" n={2}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CONTENT.map(c => {
            const on = content === c.key;
            const danger = c.key === 'bilious' || c.key === 'blood_streaked';
            return (
              <button key={c.key} type="button" onClick={() => setContent(c.key)}
                className={`text-left rounded-2xl border-2 px-3 py-2 transition ${
                  on
                    ? danger
                      ? 'bg-coral-500 text-white border-coral-500'
                      : 'bg-brand-500 text-white border-brand-500'
                    : danger
                      ? 'bg-coral-50 text-coral-800 border-coral-200'
                      : 'bg-white text-ink border-slate-200'
                }`}>
                <div className="text-sm font-bold">{c.label}</div>
                {c.hint && <div className={`text-[10px] ${on ? 'opacity-90' : 'opacity-70'}`}>{c.hint}</div>}
              </button>
            );
          })}
        </div>
        {seriousContent && (
          <div className="mt-3 rounded-xl bg-coral-50 border border-coral-200 px-3 py-2 flex items-start gap-2 text-xs text-coral-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>This colour can be a red flag — call your pediatrician promptly, especially if it repeats or baby seems distressed.</div>
          </div>
        )}
      </Section>

      <Section title="When" n={3}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      <Section title="What might have triggered it?" n={4} optional>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Trigger / context">
            <input type="text" maxLength={200}
              value={trig} onChange={e => setTrig(e.target.value)}
              placeholder="e.g. right after a bottle, in the car, while crying"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          </Field>
          <Field label="Related food (if applicable)">
            <input type="text" maxLength={120}
              value={food} onChange={e => setFood(e.target.value)}
              placeholder="e.g. Banana, formula brand"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          </Field>
        </div>
      </Section>

      <Section title="Notes" n={5} optional>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Anything else — colour, smell, baby's mood after, what helped"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-700">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log vomit'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
        )}
      </div>
    </form>
  );
}

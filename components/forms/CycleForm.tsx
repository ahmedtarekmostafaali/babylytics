'use client';

// CycleForm — log a single menstrual cycle (period start + optional end +
// flow + symptom chips). The fertility calendar projects future cycles
// from the most recent recorded one, so even a single entry unlocks the
// whole planner.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, Field } from '@/components/forms/FormKit';
import { Save } from 'lucide-react';

export type CycleFormValue = {
  id?: string;
  baby_id: string;
  period_start?: string | null;     // YYYY-MM-DD
  period_end?: string | null;
  cycle_length?: number | null;
  flow_intensity?: 'spotting'|'light'|'medium'|'heavy' | null;
  symptoms?: string[] | null;
  notes?: string | null;
};

const FLOW = [
  { key: 'spotting', label: 'Spotting' },
  { key: 'light',    label: 'Light' },
  { key: 'medium',   label: 'Medium' },
  { key: 'heavy',    label: 'Heavy' },
] as const;

const SYMPTOMS = [
  'cramps','headache','mood','bloating','tender_breasts','nausea','fatigue','acne',
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CycleForm({ babyId, initial }: { babyId: string; initial?: CycleFormValue }) {
  const router = useRouter();
  const [start,  setStart]  = useState(initial?.period_start ?? todayDate());
  const [end,    setEnd]    = useState(initial?.period_end ?? '');
  const [length, setLength] = useState<string>(initial?.cycle_length?.toString() ?? '28');
  const [flow,   setFlow]   = useState<CycleFormValue['flow_intensity']>(initial?.flow_intensity ?? 'medium');
  const [symps,  setSymps]  = useState<string[]>(initial?.symptoms ?? []);
  const [notes,  setNotes]  = useState(initial?.notes ?? '');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleSym(s: string) {
    setSymps(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!start) { setErr('Pick a period start date.'); return; }
    if (end && end < start) { setErr('Period end must be on or after the start.'); return; }
    const lenN = length ? parseInt(length, 10) : null;
    if (lenN != null && (lenN < 14 || lenN > 60)) { setErr('Cycle length should be between 14 and 60 days.'); return; }

    const payload = {
      period_start: start,
      period_end: end || null,
      cycle_length: lenN,
      flow_intensity: flow,
      symptoms: symps.length > 0 ? symps : null,
      notes: notes.trim() || null,
    };
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('menstrual_cycles').update(payload).eq('id', initial.id)
      : supabase.from('menstrual_cycles').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/planner`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this cycle log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('menstrual_cycles')
      .update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/planner`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="When did your period start?" n={1}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Period start (required)">
            <input type="date" value={start} onChange={e => setStart(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          </Field>
          <Field label="Period end (optional)">
            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
              min={start}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          </Field>
          <Field label="Cycle length (days)">
            <input type="number" min={14} max={60} value={length} onChange={e => setLength(e.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
            <span className="text-[11px] text-ink-muted">Average is 28; we'll project ovulation 14 days before the next period.</span>
          </Field>
        </div>
      </Section>

      <Section title="Flow intensity" n={2}>
        <div className="inline-flex rounded-full border border-slate-200 bg-white overflow-hidden">
          {FLOW.map(f => (
            <button key={f.key} type="button" onClick={() => setFlow(f.key)}
              className={`px-4 py-2 text-sm ${flow === f.key ? 'bg-coral-500 text-white' : 'text-ink hover:bg-slate-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Symptoms (tap any)" n={3} optional>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS.map(s => {
            const on = symps.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleSym(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition capitalize ${
                  on ? 'bg-lavender-500 text-white border-lavender-500'
                     : 'bg-white text-lavender-700 border-lavender-200 hover:bg-lavender-50'
                }`}>
                {s.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Notes" n={4} optional>
        <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Anything else worth remembering"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-700">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save cycle'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
        )}
      </div>
    </form>
  );
}

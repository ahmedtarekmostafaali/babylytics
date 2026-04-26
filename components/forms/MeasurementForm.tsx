'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Scale, Ruler, Brain } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type MeasurementFormValue = {
  id?: string;
  baby_id: string;
  measured_at?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  head_circ_cm?: number | null;
  notes?: string | null;
};

export function MeasurementForm({ babyId, initial }: { babyId: string; initial?: MeasurementFormValue }) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const t = useT();
  const router = useRouter();
  const [time, setTime] = useState(initial?.measured_at ? isoToLocalInput(initial.measured_at) : nowLocalInput());
  const [kg, setKg]     = useState(initial?.weight_kg?.toString() ?? '');
  const [cm, setCm]     = useState(initial?.height_cm?.toString() ?? '');
  const [head, setHead] = useState(initial?.head_circ_cm?.toString() ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }
    if (!kg && !cm && !head) { setErr('Enter at least one of weight, height, or head circumference.'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      measured_at: iso,
      weight_kg: kg ? Number(kg) : null,
      height_cm: cm ? Number(cm) : null,
      head_circ_cm: head ? Number(head) : null,
      notes: notes || null,
    };
    const op = initial?.id
      ? supabase.from('measurements').update(payload).eq('id', initial.id)
      : supabase.from('measurements').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/measurements`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this measurement?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('measurements').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/measurements`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title={t('trackers.meas_title')} optional>
        <div className="grid sm:grid-cols-3 gap-3">
          <MeasureCard icon={Scale} tint="brand" label={t('forms.meas_weight').replace(' (kg)', '')}  unit="kg" step="0.001" min={0} max={40}  value={kg}   onChange={setKg} placeholder="e.g. 3.70" />
          <MeasureCard icon={Ruler} tint="mint"  label={t('forms.meas_height').replace(' (cm)', '')}  unit="cm" step="0.1"   min={0} max={200} value={cm}   onChange={setCm} placeholder="e.g. 55.0" />
          <MeasureCard icon={Brain} tint="lavender" label={t('forms.meas_head').replace(' (cm)', '')} unit="cm" step="0.1" min={0} max={80} value={head} onChange={setHead} placeholder="e.g. 37.5" />
        </div>
      </Section>

      <Section n={2} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="brand" />
      </Section>

      <Section n={3} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.feed_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-brand-500 to-brand-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.meas_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">{t('forms.delete')}</Button>
        )}
      </div>
    </form>
  );
}

function MeasureCard({ icon: Icon, tint, label, unit, step, min, max, value, onChange, placeholder }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'brand' | 'mint' | 'lavender';
  label: string; unit: string; step: string; min: number; max: number;
  value: string; onChange: (s: string) => void; placeholder: string;
}) {
  const bg = { brand: 'bg-brand-50', mint: 'bg-mint-50', lavender: 'bg-lavender-50' }[tint];
  const iconBg = { brand: 'bg-brand-500', mint: 'bg-mint-500', lavender: 'bg-lavender-500' }[tint];
  return (
    <div className={`rounded-2xl border border-slate-200 ${bg} p-4`}>
      <div className="flex items-center gap-2">
        <div className={`h-9 w-9 rounded-xl ${iconBg} text-white grid place-items-center shrink-0`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold text-ink-strong">{label}</div>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <input type="number" step={step} min={min} max={max} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl bg-white border border-slate-200 px-3 text-2xl font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
        <span className="text-sm font-semibold text-ink-muted">{unit}</span>
      </div>
    </div>
  );
}

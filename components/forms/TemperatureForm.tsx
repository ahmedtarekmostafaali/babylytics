'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, TypeTile, WhenPicker, Field } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Thermometer, Ear, Baby as BabyIcon, Smile } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

type Method = 'axillary'|'oral'|'rectal'|'ear'|'forehead'|'other';

export type TemperatureFormValue = {
  id?: string;
  baby_id: string;
  measured_at?: string | null;
  temperature_c?: number | null;
  method?: Method;
  notes?: string | null;
};

export function TemperatureForm({ babyId, initial }: { babyId: string; initial?: TemperatureFormValue }) {
  const router = useRouter();
  const t = useT();
  const [time, setTime]     = useState(initial?.measured_at ? isoToLocalInput(initial.measured_at) : nowLocalInput());
  const [temp, setTemp]     = useState<string>(initial?.temperature_c?.toString() ?? '37.0');
  const [method, setMethod] = useState<Method>(initial?.method ?? 'axillary');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Renamed from `t` to `tempNum` because `t` is the translator hook above.
  const tempNum = Number(temp);
  const tone = tempNum >= 38 ? 'coral' : tempNum >= 37.5 ? 'peach' : tempNum < 36 ? 'brand' : 'mint';
  const tip = tempNum >= 38 ? 'Fever range — consider contacting your pediatrician.'
            : tempNum >= 37.5 ? 'Slightly elevated. Re-check in 30 minutes.'
            : tempNum < 36  ? 'Below normal. Warm up gently.'
            : 'Normal range.';
  const tintBar = { coral: 'text-coral-700 bg-coral-50', peach: 'text-peach-700 bg-peach-50', mint: 'text-mint-700 bg-mint-50', brand: 'text-brand-700 bg-brand-50' }[tone];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }
    if (!Number.isFinite(t) || t <= 30 || t >= 45) { setErr('Enter a realistic temperature between 30.1 and 44.9 °C.'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('temperature_logs').update({
          measured_at: iso, temperature_c: t, method, notes: notes || null,
        }).eq('id', initial.id)
      : supabase.from('temperature_logs').insert({
          baby_id: babyId, measured_at: iso, temperature_c: t, method, notes: notes || null,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/temperature`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this temperature reading?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('temperature_logs').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/temperature`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title={t('forms.temp_how')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <TypeTile icon={BabyIcon}  label={t('forms.temp_axillary')} tint="coral" active={method === 'axillary'} onClick={() => setMethod('axillary')} sub={t('forms.temp_axillary_sub')} />
          <TypeTile icon={Thermometer} label={t('forms.temp_oral')} tint="brand" active={method === 'oral'} onClick={() => setMethod('oral')} sub={t('forms.temp_oral_sub')} />
          <TypeTile icon={Ear}       label={t('forms.temp_ear')}      tint="peach" active={method === 'ear'} onClick={() => setMethod('ear')} sub={t('forms.temp_ear_sub')} />
          <TypeTile icon={Smile}     label={t('forms.temp_forehead')} tint="mint" active={method === 'forehead'} onClick={() => setMethod('forehead')} sub={t('forms.temp_forehead_sub')} />
          <TypeTile icon={Thermometer} label={t('forms.temp_rectal')} tint="lavender" active={method === 'rectal'} onClick={() => setMethod('rectal')} sub={t('forms.temp_rectal_sub')} />
        </div>
      </Section>

      <Section n={2} title={t('forms.temp_reading')}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-5 flex-wrap">
          <input type="number" step="0.1" min={30.1} max={44.9} value={temp} onChange={e => setTemp(e.target.value)}
            className="h-16 w-40 rounded-2xl border border-slate-200 bg-white px-4 text-3xl font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          <div className="text-2xl font-semibold text-ink-muted">°C</div>
          <div className={`flex-1 min-w-[180px] rounded-xl ${tintBar} px-4 py-2 text-sm`}>
            <div className="font-semibold capitalize">{tone === 'mint' ? 'Normal' : tone === 'peach' ? 'Slightly elevated' : tone === 'coral' ? 'Fever' : 'Below normal'}</div>
            <div className="text-xs">{tip}</div>
          </div>
        </div>
      </Section>

      <Section n={3} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      <Section n={4} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.feed_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.temp_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">{t('forms.delete')}</Button>
        )}
      </div>
    </form>
  );
}

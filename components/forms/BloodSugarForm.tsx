'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Droplet, Trash2, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

type MealContext = 'fasting' | 'before_meal' | 'after_meal' | 'bedtime' | 'random' | 'during_low';
type Method = 'finger_stick' | 'cgm' | 'vein_draw';

export type BloodSugarFormValue = {
  id?: string;
  baby_id: string;
  measured_at?: string | null;
  value_mgdl?: number | null;
  meal_context?: MealContext;
  method?: Method;
  notes?: string | null;
};

const MEAL_TONES: Record<MealContext, 'coral'|'peach'|'mint'|'lavender'|'brand'> = {
  fasting:     'lavender',
  before_meal: 'brand',
  after_meal:  'peach',
  bedtime:     'lavender',
  random:      'mint',
  during_low:  'coral',
};

const METHOD_TONES: Record<Method, 'coral'|'peach'|'mint'|'brand'> = {
  finger_stick: 'coral',
  cgm:          'brand',
  vein_draw:    'peach',
};

export function BloodSugarForm({ babyId, initial }: { babyId: string; initial?: BloodSugarFormValue }) {
  const router = useRouter();
  const t = useT();

  const [time, setTime] = useState(initial?.measured_at ? isoToLocalInput(initial.measured_at) : nowLocalInput());
  const [val, setVal]   = useState<string>(initial?.value_mgdl?.toString() ?? '');
  const [meal, setMeal] = useState<MealContext>(initial?.meal_context ?? 'random');
  const [method, setMethod] = useState<Method>(initial?.method ?? 'finger_stick');
  const [notes, setNotes]   = useState(initial?.notes ?? '');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valN = val ? Number(val) : null;
  // ADA paediatric ranges (rough — not clinical advice).
  const tone =
    valN == null ? 'mint' :
    valN < 70  ? 'coral' :        // hypo
    valN < 80  ? 'peach' :
    valN > 250 ? 'coral' :        // very high
    valN > 180 ? 'peach' :        // high
    'mint';                        // in range
  const toneLabel = tone === 'coral' && valN != null && valN < 70 ? t('forms.bs_low')
                  : tone === 'coral' ? t('forms.bs_high')
                  : tone === 'peach' && valN != null && valN < 100 ? t('forms.bs_borderline_low')
                  : tone === 'peach' ? t('forms.bs_borderline_high')
                  : valN != null ? t('forms.bs_in_range') : '';

  const mmol = valN != null ? (valN / 18.0182).toFixed(1) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr(t('forms.bs_err_time')); return; }
    if (valN == null || !Number.isFinite(valN) || valN < 20 || valN > 800) {
      setErr(t('forms.bs_err_value'));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      measured_at:  iso,
      value_mgdl:   valN,
      meal_context: meal,
      method,
      notes: notes || null,
    };
    const op = initial?.id
      ? supabase.from('blood_sugar_logs').update(payload).eq('id', initial.id)
      : supabase.from('blood_sugar_logs').insert({
          baby_id: babyId, ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/blood-sugar`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm(t('forms.bs_del_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('blood_sugar_logs')
      .update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/blood-sugar`);
    router.refresh();
  }

  const MEAL_KEYS: MealContext[] = ['fasting','before_meal','after_meal','bedtime','random','during_low'];
  const METHOD_KEYS: Method[] = ['finger_stick','cgm','vein_draw'];

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 text-xs text-brand-900 flex gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-700" />
        <p>{t('forms.bs_cgm_note')}</p>
      </div>

      <Section n={1} title={t('forms.bs_value_title')}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-center gap-4 flex-wrap">
          <Droplet className="h-6 w-6 text-coral-500" />
          <input type="number" step="1" min={20} max={800} value={val} onChange={e => setVal(e.target.value)}
            placeholder="120"
            className="h-16 w-32 rounded-2xl border border-slate-200 bg-white px-4 text-3xl font-bold focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          <div className="text-2xl font-semibold text-ink-muted">mg/dL</div>
          {mmol && <div className="text-sm text-ink-muted">≈ {mmol} mmol/L</div>}
          {toneLabel && (
            <span className={cn('ml-auto rounded-full px-3 py-1 text-xs font-bold',
              tone === 'coral' ? 'bg-coral-100 text-coral-700' :
              tone === 'peach' ? 'bg-peach-100 text-peach-700' :
              'bg-mint-100 text-mint-700'
            )}>{toneLabel}</span>
          )}
        </div>
      </Section>

      <Section n={2} title={t('forms.bs_meal_title')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MEAL_KEYS.map(k => {
            const active = meal === k;
            const tnt = MEAL_TONES[k];
            return (
              <button type="button" key={k} onClick={() => setMeal(k)}
                className={cn(
                  'h-12 rounded-xl border text-sm font-semibold transition',
                  active ? `text-white border-transparent shadow-sm
                            ${tnt === 'coral' ? 'bg-coral-500' :
                              tnt === 'peach' ? 'bg-peach-500' :
                              tnt === 'mint'  ? 'bg-mint-500' :
                              tnt === 'lavender' ? 'bg-lavender-500' :
                              'bg-brand-500'}`
                          : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
                )}>
                {t(`forms.bs_meal_${k}`)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section n={3} title={t('forms.bs_method_title')}>
        <div className="grid grid-cols-3 gap-2">
          {METHOD_KEYS.map(k => {
            const active = method === k;
            const tnt = METHOD_TONES[k];
            return (
              <button type="button" key={k} onClick={() => setMethod(k)}
                className={cn(
                  'h-12 rounded-xl border text-sm font-semibold transition',
                  active ? `text-white border-transparent shadow-sm
                            ${tnt === 'coral' ? 'bg-coral-500' :
                              tnt === 'peach' ? 'bg-peach-500' :
                              tnt === 'mint'  ? 'bg-mint-500' :
                              'bg-brand-500'}`
                          : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
                )}>
                {t(`forms.bs_method_${k}`)}
              </button>
            );
          })}
        </div>
      </Section>

      <Section n={4} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      <Section n={5} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.bs_notes_ph')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
      </Section>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] text-ink-muted flex gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>{t('forms.bs_disclaimer')}</p>
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.bs_save_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

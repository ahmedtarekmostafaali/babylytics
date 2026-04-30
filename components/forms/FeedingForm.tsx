'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Baby as BabyIcon, Milk, Utensils, Play, Square, Clock, Save } from 'lucide-react';
import { Section, TypeTile, WhenPicker, Stepper, Field } from '@/components/forms/FormKit';
import { cn } from '@/lib/utils';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { useT } from '@/lib/i18n/client';

type FeedMode = 'breast' | 'bottle' | 'solid';

export type FeedingFormValue = {
  id?: string;
  baby_id: string;
  feeding_time?: string | null;
  milk_type?: 'breast'|'formula'|'mixed'|'solid'|'other';
  quantity_ml?: number | null;
  kcal?: number | null;
  duration_min?: number | null;
  notes?: string | null;
  // 044 batch additions:
  formula_name?: string | null;
  food_name?: string | null;
  post_feed_effect?: string | null;
  food_symptoms?: string[] | null;
};

// Quick-pick chips for solids — toggleable, lined up under the food name.
// "no_reaction" is special: selecting it deselects the others (and vice
// versa) so a parent can't simultaneously claim "no reaction" and "rash".
const FOOD_SYMPTOM_OPTIONS: { key: string; label: string; tint: string }[] = [
  { key: 'no_reaction', label: 'No reaction',     tint: 'mint' },
  { key: 'rash',        label: 'Rash',            tint: 'coral' },
  { key: 'hives',       label: 'Hives',           tint: 'coral' },
  { key: 'gas',         label: 'Gas / bloating',  tint: 'peach' },
  { key: 'vomit',       label: 'Vomit',           tint: 'coral' },
  { key: 'diarrhea',    label: 'Diarrhea',        tint: 'coral' },
  { key: 'constipation',label: 'Constipation',    tint: 'peach' },
  { key: 'fussy',       label: 'Fussy',           tint: 'lavender' },
  { key: 'swelling',    label: 'Swelling',        tint: 'coral' },
];

// Common post-feed effects — quick-pick row above the free text. Same chip
// pattern as the food symptoms but applies to ALL feeding types, not just
// solids (a baby can spit up after a bottle too).
const POST_EFFECT_OPTIONS = [
  'spit-up', 'happy', 'sleepy', 'fussy', 'gassy', 'reflux', 'rash', 'choking',
];

function modeFromMilkType(t?: FeedingFormValue['milk_type']): FeedMode {
  if (t === 'breast' || t === 'mixed') return 'breast';
  if (t === 'solid') return 'solid';
  return 'bottle';
}

export function FeedingForm({ babyId, initial }: { babyId: string; initial?: FeedingFormValue }) {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<FeedMode>(modeFromMilkType(initial?.milk_type));

  // Common
  const [time, setTime]   = useState(initial?.feeding_time ? isoToLocalInput(initial.feeding_time) : nowLocalInput());
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr]     = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Breast — left + right minutes. Pre-populated from duration_min on edit (split evenly).
  const initialHalf = initial?.duration_min ? Math.round(initial.duration_min / 2) : 0;
  const [leftMin, setLeftMin]   = useState<number>(initialHalf);
  const [rightMin, setRightMin] = useState<number>(initial?.duration_min ? (initial.duration_min - initialHalf) : 0);

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSide, setTimerSide] = useState<'L' | 'R'>('L');
  const [elapsed, setElapsed] = useState(0); // seconds
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRunning) {
      tickRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [timerRunning]);

  function stopAndCommit() {
    const extraMin = Math.round(elapsed / 60);
    if (timerSide === 'L') setLeftMin(m => m + extraMin);
    else                   setRightMin(m => m + extraMin);
    setTimerRunning(false);
    setElapsed(0);
  }

  // Bottle
  const [ml, setMl] = useState<string>(initial?.quantity_ml?.toString() ?? '');
  const [kcal, setKcal] = useState<string>(initial?.kcal?.toString() ?? '');
  const [bottleKind, setBottleKind] = useState<'formula'|'mixed'|'other'>(
    initial?.milk_type === 'mixed' ? 'mixed' : initial?.milk_type === 'other' ? 'other' : 'formula'
  );
  // Formula brand (Similac Advance, Aptamil 1, etc.) — surfaced on bottle/mixed.
  const [formulaName, setFormulaName] = useState<string>(initial?.formula_name ?? '');

  // On mount (new entry only), auto-fill the formula brand from the last
  // bottle/mixed feeding. Saves a parent retyping "Similac Advance" every
  // 3 hours. We don't override an explicit edit-mode value or anything the
  // parent has already typed.
  useEffect(() => {
    if (initial?.id) return;            // editing — leave alone
    if (initial?.formula_name) return;  // explicit prefill
    if (formulaName) return;            // user already typed something
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from('feedings')
        .select('formula_name')
        .eq('baby_id', babyId).is('deleted_at', null)
        .in('milk_type', ['formula', 'mixed'])
        .not('formula_name', 'is', null)
        .order('feeding_time', { ascending: false })
        .limit(1).maybeSingle();
      if (!cancelled && data?.formula_name) setFormulaName(data.formula_name as string);
    })();
    return () => { cancelled = true; };
    // Only run once on mount — re-running on every state change would
    // overwrite the parent's keystrokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solid food name + symptom chips
  const [foodName, setFoodName] = useState<string>(initial?.food_name ?? '');
  const [foodSymptoms, setFoodSymptoms] = useState<string[]>(initial?.food_symptoms ?? []);

  // Post-feed effect: free text + chip toggles. We persist whatever the
  // textarea ends up showing, so chips are a write-into-text affordance.
  const [postEffect, setPostEffect] = useState<string>(initial?.post_feed_effect ?? '');
  function toggleEffectChip(label: string) {
    const set = new Set(postEffect.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean));
    if (set.has(label)) set.delete(label); else set.add(label);
    setPostEffect(Array.from(set).join(', '));
  }
  function toggleFoodSymptom(key: string) {
    setFoodSymptoms(prev => {
      const has = prev.includes(key);
      // "no_reaction" is exclusive — picking it clears the others, picking
      // anything else clears "no_reaction".
      if (key === 'no_reaction') return has ? [] : ['no_reaction'];
      const next = has ? prev.filter(k => k !== key) : [...prev.filter(k => k !== 'no_reaction'), key];
      return next;
    });
  }

  const isBottle = mode === 'bottle';
  const isBreast = mode === 'breast';
  const isSolid  = mode === 'solid';

  const totalBreastMin = leftMin + rightMin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }

    // Shared post-feed effect — applies to every mode. Empty string → null.
    const effect = postEffect.trim() || null;

    let payload: Partial<FeedingFormValue>;
    if (isBreast) {
      if (totalBreastMin <= 0) { setErr('Add minutes to at least one breast, or start the timer.'); return; }
      payload = {
        feeding_time: iso,
        milk_type: 'breast',
        quantity_ml: null,
        kcal: null,
        duration_min: totalBreastMin,
        notes: [notes, `Left ${leftMin}m · Right ${rightMin}m`].filter(Boolean).join(' · ').trim() || null,
        formula_name: null,
        food_name: null,
        food_symptoms: null,
        post_feed_effect: effect,
      };
    } else if (isBottle) {
      const mlNum = ml ? Number(ml) : null;
      if (mlNum == null || mlNum <= 0) { setErr('Enter the bottle amount in ml.'); return; }
      payload = {
        feeding_time: iso,
        milk_type: bottleKind,
        quantity_ml: mlNum,
        kcal: kcal ? Number(kcal) : null,
        duration_min: null,
        notes: notes || null,
        // formula_name only meaningful for formula/mixed bottles, but we
        // still persist whatever the parent typed even on "other" — it's
        // free text, doesn't hurt.
        formula_name: formulaName.trim() || null,
        food_name: null,
        food_symptoms: null,
        post_feed_effect: effect,
      };
    } else {
      // solid
      if (!foodName.trim()) { setErr('What food did baby try? Add the food name.'); return; }
      payload = {
        feeding_time: iso,
        milk_type: 'solid',
        quantity_ml: null,
        kcal: kcal ? Number(kcal) : null,
        duration_min: null,
        notes: notes.trim() || null,
        formula_name: null,
        food_name: foodName.trim(),
        food_symptoms: foodSymptoms.length > 0 ? foodSymptoms : null,
        post_feed_effect: effect,
      };
    }

    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('feedings').update({ ...payload }).eq('id', initial.id)
      : supabase.from('feedings').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this feeding?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('feedings').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Type selector */}
      <Section title={t('forms.feed_what')} n={1}>
        <div className="grid sm:grid-cols-3 gap-3">
          <TypeTile icon={BabyIcon} label={t('forms.feed_breastfeeding')} tint="coral"    active={isBreast} onClick={() => setMode('breast')} />
          <TypeTile icon={Milk}     label={t('forms.feed_bottle')}         tint="brand"    active={isBottle} onClick={() => setMode('bottle')} />
          <TypeTile icon={Utensils} label={t('forms.feed_solid')}          tint="peach"    active={isSolid}  onClick={() => setMode('solid')}  />
        </div>
      </Section>

      {/* 2. Details — varies by mode */}
      <Section title={t('forms.feed_details')} n={2}>
        {isBreast && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Stepper label={t('forms.feed_left_breast')}  value={leftMin}  onChange={setLeftMin}  unit="min" badge={{ text: 'L', tint: 'coral' }} />
              <Stepper label={t('forms.feed_right_breast')} value={rightMin} onChange={setRightMin} unit="min" badge={{ text: 'R', tint: 'lavender' }} />
            </div>

            {/* Timer */}
            <div className="rounded-2xl border border-coral-200 bg-coral-50/50 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-coral-100 text-coral-600 grid place-items-center shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink-strong">
                    {timerRunning
                      ? `Timing ${timerSide === 'L' ? 'left' : 'right'} — ${fmtDuration(elapsed)}`
                      : 'Breast timer'}
                  </div>
                  <div className="text-xs text-ink-muted">Use when feeding live — we&apos;ll add the minutes when you stop.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!timerRunning && (
                  <>
                    <button type="button"
                      onClick={() => { setTimerSide('L'); setTimerRunning(true); }}
                      className="inline-flex items-center gap-1 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-xs px-3 py-1.5">
                      <Play className="h-3 w-3" /> Left
                    </button>
                    <button type="button"
                      onClick={() => { setTimerSide('R'); setTimerRunning(true); }}
                      className="inline-flex items-center gap-1 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-xs px-3 py-1.5">
                      <Play className="h-3 w-3" /> Right
                    </button>
                  </>
                )}
                {timerRunning && (
                  <button type="button" onClick={stopAndCommit}
                    className="inline-flex items-center gap-1 rounded-full bg-ink-strong text-white text-xs px-3 py-1.5">
                    <Square className="h-3 w-3" /> Stop &amp; add
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-ink-muted">
              Total {totalBreastMin} min
            </div>
          </div>
        )}

        {isBottle && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('forms.feed_amount')}>
                <input type="number" min={0} max={2000} step={1}
                  value={ml} onChange={e => setMl(e.target.value)}
                  placeholder="e.g. 120"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
              </Field>
              <Field label={t('forms.feed_kcal')}>
                <input type="number" min={0} max={5000} step={1}
                  value={kcal} onChange={e => setKcal(e.target.value)}
                  placeholder="e.g. 80"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
              </Field>
            </div>
            <Field label={t('forms.feed_contents')}>
              <div className="inline-flex rounded-full border border-slate-200 bg-white overflow-hidden">
                {(['formula','mixed','other'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setBottleKind(k)}
                    className={cn('px-4 py-2 text-sm',
                      bottleKind === k ? 'bg-brand-500 text-white' : 'text-ink hover:bg-slate-50')}>
                    {t(`forms.feed_${k}`)}
                  </button>
                ))}
              </div>
            </Field>
            {/* Brand free-text — useful both for medical history AND when
                tracking which formula correlates with reflux/rashes. */}
            {(bottleKind === 'formula' || bottleKind === 'mixed') && (
              <Field label="Formula brand">
                <input type="text" maxLength={120}
                  value={formulaName} onChange={e => setFormulaName(e.target.value)}
                  placeholder="e.g. Similac Advance, Aptamil 1, Bebelac Comfort"
                  list="formula-suggestions"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
                <datalist id="formula-suggestions">
                  <option value="Similac Advance" />
                  <option value="Similac Total Comfort" />
                  <option value="Aptamil 1" />
                  <option value="Aptamil Comfort" />
                  <option value="Bebelac 1" />
                  <option value="Bebelac Comfort" />
                  <option value="Hipp Combiotic" />
                  <option value="Nan Optipro" />
                  <option value="Enfamil Gentlease" />
                  <option value="S-26 Gold" />
                </datalist>
              </Field>
            )}
          </div>
        )}

        {isSolid && (
          <div className="space-y-4">
            <Field label="Food name (required)">
              <input type="text" maxLength={120}
                value={foodName} onChange={e => setFoodName(e.target.value)}
                placeholder="e.g. Banana, rice cereal, yogurt, scrambled egg"
                list="food-suggestions"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
              <datalist id="food-suggestions">
                <option value="Banana" /><option value="Avocado" /><option value="Sweet potato" />
                <option value="Rice cereal" /><option value="Oatmeal" /><option value="Apple puree" />
                <option value="Pear puree" /><option value="Carrot puree" /><option value="Yogurt" />
                <option value="Scrambled egg" /><option value="Chicken puree" /><option value="Lentil soup" />
                <option value="Bread" /><option value="Cheese" /><option value="Pasta" />
              </datalist>
            </Field>
            <Field label={t('forms.feed_kcal')}>
              <input type="number" min={0} max={5000} step={1}
                value={kcal} onChange={e => setKcal(e.target.value)}
                placeholder="e.g. 120"
                className="h-12 w-40 rounded-2xl border border-slate-200 bg-white px-4 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            {/* Symptom chips — saved as text[] in food_symptoms, drives the
                Solid-food KPI on the overview + reports. */}
            <Field label="Did this food affect baby? (tap any that apply)">
              <div className="flex flex-wrap gap-1.5">
                {FOOD_SYMPTOM_OPTIONS.map(opt => {
                  const on = foodSymptoms.includes(opt.key);
                  const tintMap: Record<string, string> = {
                    coral:    on ? 'bg-coral-500 text-white border-coral-500' : 'bg-white text-coral-700 border-coral-200',
                    mint:     on ? 'bg-mint-500 text-white border-mint-500'   : 'bg-white text-mint-700 border-mint-200',
                    peach:    on ? 'bg-peach-500 text-white border-peach-500' : 'bg-white text-peach-700 border-peach-200',
                    lavender: on ? 'bg-lavender-500 text-white border-lavender-500' : 'bg-white text-lavender-700 border-lavender-200',
                  };
                  return (
                    <button key={opt.key} type="button"
                      onClick={() => toggleFoodSymptom(opt.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${tintMap[opt.tint]}`}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}
      </Section>

      {/* 3. When */}
      <Section title={t('forms.when')} n={3}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      {/* 4. Notes */}
      <Section title={t('forms.feed_add_details')} n={4} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.feed_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {/* 5. Post-feed effect — universal. Tap chips to seed common phrases,
          then refine with free text. Drives the post-feed banner on the
          detail panel + appears in reports. */}
      <Section title="Post-feed effect" n={5} optional>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {POST_EFFECT_OPTIONS.map(opt => {
              const on = postEffect.toLowerCase().includes(opt.toLowerCase());
              return (
                <button key={opt} type="button" onClick={() => toggleEffectChip(opt)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    on ? 'bg-peach-500 text-white border-peach-500'
                       : 'bg-white text-peach-700 border-peach-200 hover:bg-peach-50'
                  }`}>
                  {opt}
                </button>
              );
            })}
          </div>
          <textarea rows={2} value={postEffect} onChange={e => setPostEffect(e.target.value)}
            placeholder="Anything you noticed after the feed (spit-up amount, mood, rash, etc.)"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
        </div>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-700">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.feed_save_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">{t('forms.fast_log')} <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

// ---- Helpers --------------------------------------------------------------

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}


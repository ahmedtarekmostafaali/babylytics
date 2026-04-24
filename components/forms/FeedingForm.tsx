'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Baby as BabyIcon, Milk, Utensils, Play, Square, Clock, Save } from 'lucide-react';
import { Section, TypeTile, WhenPicker, Stepper, Field } from '@/components/forms/FormKit';
import { cn } from '@/lib/utils';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';

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
};

function modeFromMilkType(t?: FeedingFormValue['milk_type']): FeedMode {
  if (t === 'breast' || t === 'mixed') return 'breast';
  if (t === 'solid') return 'solid';
  return 'bottle';
}

export function FeedingForm({ babyId, initial }: { babyId: string; initial?: FeedingFormValue }) {
  const router = useRouter();
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

  const isBottle = mode === 'bottle';
  const isBreast = mode === 'breast';
  const isSolid  = mode === 'solid';

  const totalBreastMin = leftMin + rightMin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }

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
      };
    } else {
      // solid
      if (!notes.trim()) { setErr('Describe the solid food in notes.'); return; }
      payload = {
        feeding_time: iso,
        milk_type: 'solid',
        quantity_ml: null,
        kcal: kcal ? Number(kcal) : null,
        duration_min: null,
        notes: notes.trim(),
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
      <Section title="What type of feeding?" n={1}>
        <div className="grid sm:grid-cols-3 gap-3">
          <TypeTile icon={BabyIcon} label="Breastfeeding" tint="coral"    active={isBreast} onClick={() => setMode('breast')} />
          <TypeTile icon={Milk}     label="Bottle"         tint="brand"    active={isBottle} onClick={() => setMode('bottle')} />
          <TypeTile icon={Utensils} label="Solid"          tint="peach"    active={isSolid}  onClick={() => setMode('solid')}  />
        </div>
      </Section>

      {/* 2. Details — varies by mode */}
      <Section title="Details" n={2}>
        {isBreast && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Stepper label="Left breast"  value={leftMin}  onChange={setLeftMin}  unit="min" badge={{ text: 'L', tint: 'coral' }} />
              <Stepper label="Right breast" value={rightMin} onChange={setRightMin} unit="min" badge={{ text: 'R', tint: 'lavender' }} />
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
              <Field label="Amount (ml)">
                <input type="number" min={0} max={2000} step={1}
                  value={ml} onChange={e => setMl(e.target.value)}
                  placeholder="e.g. 120"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
              </Field>
              <Field label="Kcal (optional)">
                <input type="number" min={0} max={5000} step={1}
                  value={kcal} onChange={e => setKcal(e.target.value)}
                  placeholder="e.g. 80"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
              </Field>
            </div>
            <Field label="Contents">
              <div className="inline-flex rounded-full border border-slate-200 bg-white overflow-hidden">
                {(['formula','mixed','other'] as const).map(k => (
                  <button key={k} type="button" onClick={() => setBottleKind(k)}
                    className={cn('px-4 py-2 text-sm capitalize',
                      bottleKind === k ? 'bg-brand-500 text-white' : 'text-ink hover:bg-slate-50')}>
                    {k}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {isSolid && (
          <div>
            <Field label="Kcal (optional)">
              <input type="number" min={0} max={5000} step={1}
                value={kcal} onChange={e => setKcal(e.target.value)}
                placeholder="e.g. 120"
                className="h-12 w-40 rounded-2xl border border-slate-200 bg-white px-4 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <p className="mt-2 text-xs text-ink-muted">Describe the food in the notes field below — e.g. &ldquo;half a banana, yogurt&rdquo;.</p>
          </div>
        )}
      </Section>

      {/* 3. When */}
      <Section title="When?" n={3}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      {/* 4. Notes */}
      <Section title="Add details" n={4} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={isSolid ? 'What did they eat? e.g. half a banana, yogurt' : 'Notes (e.g. mood, meds, anything important)'}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600 hover:from-coral-600 hover:to-coral-700">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save feeding'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">Takes less than 2 seconds <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

// ---- Helpers --------------------------------------------------------------

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}


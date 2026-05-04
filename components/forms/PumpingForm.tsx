'use client';

// PumpingForm — Wave 40A. Postpartum tracker for breast milk pumping
// sessions. Three submit modes:
//   1. Quick log (full session done, supply start + end + volume + side)
//   2. "Start now" (open session — saves with started_at = now, no end)
//   3. "Stop a running session" — handled on the timeline by an inline
//      "Mark stopped" button (separate component path, not here)

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Droplet, Loader2, Check, AlertCircle, Play } from 'lucide-react';

type Side     = 'left' | 'right' | 'both';
type Location = 'home' | 'work' | 'car' | 'other';

export function PumpingForm({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr   = lang === 'ar';

  const [side,      setSide]      = useState<Side>('both');
  const [volumeMl,  setVolumeMl]  = useState('');
  const [duration,  setDuration]  = useState('');   // minutes — for completed sessions
  const [location,  setLocation]  = useState<Location>('home');
  const [notes,     setNotes]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);

  async function submit(mode: 'quick' | 'start_now') {
    setErr(null); setSuccess(null);
    setBusy(true);
    const supabase = createClient();

    const now = new Date();
    let started_at = now.toISOString();
    let ended_at: string | null = null;

    if (mode === 'quick') {
      const dur = duration ? Number(duration) : 15;
      const startMs = now.getTime() - dur * 60 * 1000;
      started_at = new Date(startMs).toISOString();
      ended_at   = now.toISOString();
    }

    const { error } = await supabase.rpc('add_pumping_log', {
      p_baby:       babyId,
      p_started_at: started_at,
      p_ended_at:   ended_at,
      p_side:       side,
      p_volume_ml:  mode === 'quick' && volumeMl ? Number(volumeMl) : null,
      p_location:   location,
      p_notes:      notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSuccess(mode === 'quick'
      ? (isAr ? 'تم حفظ الجلسة' : 'Session logged')
      : (isAr ? 'بدأت الجلسة — اضغطي إيقاف لاحقاً من القائمة' : 'Session started — tap stop later from the list'));
    setVolumeMl(''); setDuration(''); setNotes('');
    router.refresh();
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white shadow-card p-5 space-y-4"
      onSubmit={e => { e.preventDefault(); submit('quick'); }}>
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
          <Droplet className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'سجل جلسة شفط' : 'Log a pumping session'}
          </h3>
          <p className="text-xs text-ink-muted">
            {isAr
              ? 'احفظي جلسة كاملة بكميتها، أو اضغطي «ابدأ الآن» وأوقفيها لاحقاً.'
              : 'Save a completed session, or tap "Start now" and stop later.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'الجانب' : 'Side'}
          </label>
          <select value={side} onChange={e => setSide(e.target.value as Side)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="left">{isAr ? 'يسار' : 'Left'}</option>
            <option value="right">{isAr ? 'يمين' : 'Right'}</option>
            <option value="both">{isAr ? 'الاثنين' : 'Both'}</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'المكان' : 'Location'}
          </label>
          <select value={location} onChange={e => setLocation(e.target.value as Location)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm">
            <option value="home">{isAr ? 'البيت' : 'Home'}</option>
            <option value="work">{isAr ? 'العمل' : 'Work'}</option>
            <option value="car">{isAr ? 'السيارة' : 'Car'}</option>
            <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'الكمية (مل)' : 'Volume (ml)'}
          </label>
          <input type="number" min={0} max={1000} value={volumeMl}
            onChange={e => setVolumeMl(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'المدة (د)' : 'Duration (min)'}
          </label>
          <input type="number" min={1} max={120} value={duration}
            onChange={e => setDuration(e.target.value)}
            placeholder={isAr ? 'مثال ١٥' : 'e.g. 15'}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          {isAr ? 'ملاحظة' : 'Note'}
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} maxLength={400}
          placeholder={isAr ? 'مثال: قلة بسبب التوتر' : 'e.g. less due to stress'}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
      </div>

      {err && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 p-2 text-xs text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{err}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-mint-200 bg-mint-50/60 p-2 text-xs text-mint-700 flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0" /><span>{success}</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold text-sm px-5 py-2 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isAr ? 'حفظ الجلسة' : 'Save session'}
        </button>
        <button type="button" disabled={busy} onClick={() => submit('start_now')}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 hover:bg-slate-50 text-ink font-semibold text-sm px-4 py-2 disabled:opacity-50">
          <Play className="h-4 w-4" />
          {isAr ? 'ابدأ الآن' : 'Start now'}
        </button>
      </div>
    </form>
  );
}

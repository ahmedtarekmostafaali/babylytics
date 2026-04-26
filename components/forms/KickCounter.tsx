'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { FetalMovementSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Play, Pause, RotateCcw, Plus, Save } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

/**
 * Kick counter — live session timer + kick tally. Saves a single
 * `fetal_movements` row when the parent ends the session. Also supports
 * direct manual entry without running a timer.
 */
export function KickCounter({ babyId }: { babyId: string }) {
  const router = useRouter();
  const t = useT();

  const [running, setRunning]   = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [kicks, setKicks]       = useState(0);
  const startedAtRef            = useRef<number | null>(null);

  const [notes, setNotes]       = useState('');
  const [err, setErr]           = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<string | null>(null);

  // Live tick while running.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const start = startedAtRef.current;
      if (start) setElapsedMs(Date.now() - start);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function start() {
    if (running) return;
    startedAtRef.current = Date.now() - elapsedMs;
    setRunning(true);
  }
  function pause() { setRunning(false); }
  function reset() { setRunning(false); setElapsedMs(0); setKicks(0); startedAtRef.current = null; }
  function tally() { setKicks(k => k + 1); if (!running) start(); }

  async function save() {
    setErr(null); setMsg(null);
    const durationMin = Math.max(1, Math.round(elapsedMs / 60000));
    const parsed = FetalMovementSchema.safeParse({
      counted_at: new Date().toISOString(),
      duration_min: durationMin,
      movements: kicks,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('fetal_movements').insert({
      baby_id: babyId, ...parsed.data,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg(`Logged ${kicks} kicks over ${durationMin} min.`);
    reset();
    router.refresh();
  }

  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const lowMovement = kicks > 0 && minutes >= 60 && kicks < 5; // soft warning

  return (
    <div className="space-y-5">
      {/* Live counter card */}
      <div className="rounded-3xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-6 shadow-card">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted text-center">{t('forms.kicks_session_label')}</div>
        <div className="mt-1 text-center text-5xl font-bold tabular-nums text-ink-strong">{mmss}</div>
        <div className="mt-1 text-center text-sm text-ink-muted">
          {running ? t('forms.kicks_counting') : elapsedMs ? t('forms.kicks_paused') : t('forms.kicks_tap_begin')}
        </div>

        <button type="button" onClick={tally}
          className="mt-6 w-full h-32 rounded-3xl bg-gradient-to-br from-coral-500 to-coral-600 text-white shadow-lg active:scale-95 transition select-none grid place-items-center">
          <div className="text-center">
            <div className="text-7xl font-bold leading-none">{kicks}</div>
            <div className="mt-1 text-xs uppercase tracking-widest opacity-80">{t('forms.kicks_kicks_label')}</div>
          </div>
        </button>

        <div className="mt-4 flex items-center gap-2 justify-center">
          {running ? (
            <Button type="button" variant="secondary" onClick={pause} className="rounded-full">
              <Pause className="h-4 w-4" /> {t('forms.kicks_pause')}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={start} className="rounded-full">
              <Play className="h-4 w-4" /> {t('forms.kicks_resume')}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={reset} className="rounded-full">
            <RotateCcw className="h-4 w-4" /> {t('forms.kicks_reset')}
          </Button>
        </div>

        {lowMovement && (
          <p className="mt-3 text-center text-sm text-coral-700 bg-coral-50 rounded-xl border border-coral-200 px-3 py-2">
            {t('forms.kicks_low_warning', { minutes })}
          </p>
        )}
      </div>

      {/* Optional notes + save */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
        {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}
        <Button type="button" onClick={save} disabled={saving || elapsedMs === 0 && kicks === 0}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-coral-500">
          <Save className="h-4 w-4" /> {saving ? t('forms.saving') : t('forms.kicks_save_session')}
        </Button>
      </div>

      {/* Manual log */}
      <ManualKickLog babyId={babyId} />
    </div>
  );
}

function ManualKickLog({ babyId }: { babyId: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [kicks, setKicks] = useState('10');
  const [duration, setDuration] = useState('60');
  const [when, setWhen] = useState(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const parsed = FetalMovementSchema.safeParse({
      counted_at: new Date(when).toISOString(),
      duration_min: Number(duration),
      movements: Number(kicks),
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('fetal_movements').insert({
      baby_id: babyId, ...parsed.data,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setKicks('10'); setDuration('60'); setNotes('');
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full text-sm font-semibold text-brand-600 hover:text-brand-700 inline-flex items-center justify-center gap-1.5 py-2">
        <Plus className="h-4 w-4" /> {t('forms.kicks_manual_log_link')}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
      <h4 className="text-sm font-bold text-ink-strong">{t('forms.kicks_manual_title')}</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>{t('forms.kicks_when')}</Label>
          <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.kicks_kicks')}</Label>
          <Input type="number" min={0} max={999} value={kicks} onChange={e => setKicks(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.kicks_duration_min')}</Label>
          <Input type="number" min={1} max={240} value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
      </div>
      <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('forms.notes')} />
      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" onClick={save} disabled={saving} className="flex-1 rounded-full">
          <Save className="h-4 w-4" /> {saving ? t('forms.saving') : t('forms.save')}
        </Button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm text-ink-muted hover:text-ink-strong">{t('common.cancel')}</button>
      </div>
    </div>
  );
}

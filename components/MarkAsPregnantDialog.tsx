'use client';

// MarkAsPregnantDialog — transition a 'planning' (My cycle) profile into
// 'pregnancy'. Calls the SECURITY DEFINER `transition_to_pregnancy` RPC.
// Cycle history and symptom logs stay attached to the same baby_id, so
// the OB-GYN can still see the pre-conception trail.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Heart, Loader2, X } from 'lucide-react';
import { eddFromLmp } from '@/lib/lifecycle';

export function MarkAsPregnantDialog({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lmp, setLmp]   = useState('');
  const [edd, setEdd]   = useState('');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  function onLmpChange(v: string) {
    setLmp(v);
    if (v && !edd) setEdd(eddFromLmp(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!lmp && !edd) { setErr('Pick at least an LMP or EDD.'); return; }
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('transition_to_pregnancy', {
      p_baby: babyId,
      p_edd: edd || null,
      p_lmp: lmp || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    router.refresh();
    router.push(`/babies/${babyId}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-coral-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-2 shadow-sm">
        <Heart className="h-4 w-4" /> I'm pregnant!
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-6 relative"
            onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100 text-ink-muted">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-12 w-12 rounded-2xl bg-lavender-100 text-lavender-600 grid place-items-center">
                <Heart className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink-strong">Congrats!</h2>
                <p className="text-xs text-ink-muted">Switch this profile to pregnancy. Your cycle history stays archived in the medical profile.</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Last period (LMP)</label>
                  <input type="date" value={lmp} onChange={e => onLmpChange(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30" />
                  <p className="text-[10px] text-ink-muted mt-1">We'll auto-fill the EDD using Naegele's rule.</p>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Due date (EDD)</label>
                  <input type="date" value={edd} onChange={e => setEdd(e.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30" />
                  <p className="text-[10px] text-ink-muted mt-1">From your doctor or first ultrasound.</p>
                </div>
              </div>
              {err && <p className="text-sm text-coral-600">{err}</p>}
              <div className="flex items-center gap-2 pt-2">
                <Button type="submit" disabled={busy}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-coral-500">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Heart className="h-4 w-4" /> Switch to pregnancy
                </Button>
                <button type="button" onClick={() => setOpen(false)}
                  className="text-sm text-ink-muted hover:text-ink-strong px-3">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

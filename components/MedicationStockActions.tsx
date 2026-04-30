'use client';

// Tiny client component for the inline "Refill" + "Adjust" buttons on the
// medication stock page. Posts to the SECURITY DEFINER RPCs and refreshes
// the page so the new totals + transaction row appear.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Minus, Loader2, Check } from 'lucide-react';

export function MedicationStockActions({ medId, current, threshold }: {
  medId: string;
  current: number;
  threshold: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<'refill' | 'adjust' | null>(null);
  const [units, setUnits] = useState('30');
  const [delta, setDelta] = useState('0');
  const [reason, setReason] = useState<'manual_adjust'|'expiry'|'lost'>('manual_adjust');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refill() {
    const n = parseInt(units, 10);
    if (!Number.isFinite(n) || n <= 0) { setErr('Enter how many doses.'); return; }
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('medication_refill', { p_med_id: medId, p_units: n, p_notes: notes.trim() || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true); setTimeout(() => { setOpen(null); setDone(false); router.refresh(); }, 700);
  }

  async function adjust() {
    const d = parseInt(delta, 10);
    if (!Number.isFinite(d) || d === 0) { setErr('Enter a non-zero adjustment.'); return; }
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('medication_adjust_stock', {
      p_med_id: medId, p_delta: d, p_reason: reason, p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true); setTimeout(() => { setOpen(null); setDone(false); router.refresh(); }, 700);
  }

  const low = current <= threshold;

  return (
    <div className="space-y-2">
      {!open && (
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => setOpen('refill')}
            className="inline-flex items-center gap-1.5 rounded-full bg-mint-500 hover:bg-mint-600 text-white text-xs font-semibold px-3 py-1.5">
            <Plus className="h-3 w-3" /> Refill
          </button>
          <button onClick={() => setOpen('adjust')}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-xs font-semibold px-3 py-1.5">
            <Minus className="h-3 w-3" /> Adjust
          </button>
        </div>
      )}

      {open === 'refill' && (
        <div className="rounded-xl border border-mint-200 bg-mint-50/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-ink-strong">Add doses:</label>
            <input type="number" min={1} max={1000} value={units} onChange={e => setUnits(e.target.value)}
              className="h-9 w-24 rounded-lg border border-slate-200 px-2 text-sm" />
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (e.g. pharmacy run)"
              className="h-9 flex-1 rounded-lg border border-slate-200 px-2 text-sm" />
          </div>
          <div className="flex items-center justify-between">
            {err && <span className="text-xs text-coral-600">{err}</span>}
            <span className="text-[11px] text-ink-muted">New total: {current + (parseInt(units, 10) || 0)} doses</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button onClick={() => { setOpen(null); setErr(null); }} className="text-xs text-ink-muted px-2 py-1">Cancel</button>
              <button onClick={refill} disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-mint-600 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {done ? <Check className="h-3 w-3" /> : 'Save refill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {open === 'adjust' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
          <div className="grid grid-cols-[1fr_1fr_2fr] gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-muted">Delta (+/-)</label>
              <input type="number" value={delta} onChange={e => setDelta(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-muted">Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value as typeof reason)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm">
                <option value="manual_adjust">Manual adjust</option>
                <option value="expiry">Expired</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-semibold text-ink-muted">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 px-2 text-sm" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            {err && <span className="text-xs text-coral-600">{err}</span>}
            <span className="text-[11px] text-ink-muted ml-auto">New total: {current + (parseInt(delta, 10) || 0)} doses {low ? '· still low' : ''}</span>
            <div className="flex items-center gap-1.5 ml-3">
              <button onClick={() => { setOpen(null); setErr(null); }} className="text-xs text-ink-muted px-2 py-1">Cancel</button>
              <button onClick={adjust} disabled={busy}
                className="inline-flex items-center gap-1 rounded-full bg-ink text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
                {busy && <Loader2 className="h-3 w-3 animate-spin" />}
                {done ? <Check className="h-3 w-3" /> : 'Save adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

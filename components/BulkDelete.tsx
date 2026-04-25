'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { localInputToIso, dayWindow } from '@/lib/dates';
import {
  Trash2, X, Loader2, AlertTriangle, Calendar, Layers, Check,
} from 'lucide-react';

type Table =
  | 'feedings' | 'stool_logs' | 'medications' | 'medication_logs'
  | 'measurements' | 'temperature_logs' | 'vaccinations' | 'sleep_logs'
  | 'screen_time_logs' | 'activity_logs' | 'lab_panels'
  | 'prenatal_visits' | 'ultrasounds' | 'fetal_movements'
  | 'teething_logs' | 'speaking_logs' | 'developmental_milestones';

/**
 * Bulk-delete dialog for any log table. Two modes:
 *   - "view"  - soft-deletes every id in `visibleIds` (the rows currently
 *               rendered by the parent list, i.e. already filtered by range
 *               and any type filter).
 *   - "range" - soft-deletes every row where `<timeColumn>` is in the
 *               user-picked inclusive window.
 *
 * Everything is a `deleted_at = now()` UPDATE under RLS — nothing is hard
 * deleted, so a DBA can recover rows later if needed.
 */
export function BulkDelete({
  babyId, table, timeColumn, visibleIds, kindLabel = 'records',
}: {
  babyId: string;
  table: Table;
  /** The column we compare against for date-range deletes. */
  timeColumn: string;
  /** IDs currently rendered — used for the "delete current view" option. */
  visibleIds: string[];
  kindLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'view' | 'range' | 'day'>('view');
  const [fromDate, setFromDate] = useState<string>(''); // yyyy-mm-dd
  const [toDate,   setToDate]   = useState<string>(''); // yyyy-mm-dd
  const [oneDate,  setOneDate]  = useState<string>(''); // yyyy-mm-dd
  const [confirmText, setConfirmText] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  function reset() {
    setMode('view');
    setFromDate(''); setToDate(''); setOneDate('');
    setConfirmText('');
    setErr(null); setDone(null);
  }

  function close() {
    if (pending) return;
    reset();
    setOpen(false);
  }

  const confirmPhrase = 'DELETE';

  async function run() {
    if (confirmText !== confirmPhrase) { setErr(`Type ${confirmPhrase} to confirm.`); return; }
    setErr(null); setDone(null);

    start(async () => {
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      if (mode === 'view') {
        if (visibleIds.length === 0) { setErr('Nothing to delete in this view.'); return; }
        const { error, count } = await supabase.from(table)
          .update({ deleted_at: nowIso }, { count: 'exact' })
          .in('id', visibleIds)
          .is('deleted_at', null);
        if (error) { setErr(error.message); return; }
        setDone(count ?? visibleIds.length);
      } else if (mode === 'day') {
        if (!oneDate) { setErr('Pick a date.'); return; }
        const w = dayWindow(oneDate);
        const { error, count } = await supabase.from(table)
          .update({ deleted_at: nowIso }, { count: 'exact' })
          .eq('baby_id', babyId)
          .is('deleted_at', null)
          .gte(timeColumn, w.start).lt(timeColumn, w.end);
        if (error) { setErr(error.message); return; }
        setDone(count ?? 0);
      } else {
        if (!fromDate || !toDate) { setErr('Pick both dates.'); return; }
        const fromIso = localInputToIso(`${fromDate}T00:00`);
        const toIso   = localInputToIso(`${toDate}T23:59`);
        if (!fromIso || !toIso) { setErr('Invalid date.'); return; }
        if (new Date(fromIso).getTime() > new Date(toIso).getTime()) {
          setErr('"From" date must be earlier than "To".'); return;
        }
        const { error, count } = await supabase.from(table)
          .update({ deleted_at: nowIso }, { count: 'exact' })
          .eq('baby_id', babyId)
          .is('deleted_at', null)
          .gte(timeColumn, fromIso).lte(timeColumn, toIso);
        if (error) { setErr(error.message); return; }
        setDone(count ?? 0);
      }

      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-coral-200 bg-white hover:bg-coral-50 text-coral-700 text-sm font-semibold px-3 py-1.5 shadow-sm">
        <Trash2 className="h-4 w-4" /> Bulk delete
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={close}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-panel p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={close} disabled={pending}
              className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100 disabled:opacity-60"
              aria-label="Close">
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-coral-100 text-coral-600 grid place-items-center">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink-strong">Bulk delete {kindLabel}</h3>
                <p className="text-xs text-ink-muted">Soft-delete — rows are preserved in the database but hidden from the app.</p>
              </div>
            </div>

            {/* Mode picker */}
            <div className="mt-5 space-y-2">
              <ModeRow
                active={mode === 'view'}
                onClick={() => setMode('view')}
                icon={Layers}
                title={`Delete current view (${visibleIds.length})`}
                body="Everything currently shown in the list, after range + type filters." />
              <ModeRow
                active={mode === 'day'}
                onClick={() => setMode('day')}
                icon={Calendar}
                title="Delete a specific day"
                body="All records on one calendar date (Cairo time)." />
              <ModeRow
                active={mode === 'range'}
                onClick={() => setMode('range')}
                icon={Calendar}
                title="Delete a date range"
                body="All records between two dates, inclusive." />
            </div>

            {mode === 'day' && (
              <div className="mt-4">
                <Label>Date</Label>
                <Input type="date" value={oneDate} onChange={e => setOneDate(e.target.value)} />
              </div>
            )}

            {mode === 'range' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <Label>From</Label>
                  <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label>To</Label>
                  <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                </div>
              </div>
            )}

            {/* Confirm gate */}
            <div className="mt-5 rounded-xl bg-coral-50 border border-coral-200 p-3 text-xs text-coral-900">
              To confirm, type <span className="font-mono font-bold">{confirmPhrase}</span> below.
              This only hides rows — they can still be restored from the database if needed.
            </div>
            <div className="mt-2">
              <Input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmPhrase} />
            </div>

            {err  && <p className="mt-3 text-sm text-coral-600 font-medium">{err}</p>}
            {done != null && (
              <div className="mt-3 rounded-xl bg-mint-50 border border-mint-200 text-mint-900 px-3 py-2 text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-mint-600" />
                Deleted {done} {kindLabel}.
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              <Button type="button" variant="secondary" onClick={close} disabled={pending} className="flex-1">
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={run}
                disabled={pending || confirmText !== confirmPhrase}
                className="flex-1">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ModeRow({
  active, onClick, icon: Icon, title, body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string; body: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
        active ? 'ring-2 ring-coral-400 border-transparent bg-coral-50/60' : 'border-slate-200 hover:bg-slate-50'
      }`}>
      <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${
        active ? 'bg-coral-500 text-white' : 'bg-slate-100 text-ink-muted'
      }`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-ink-strong text-sm">{title}</span>
        <span className="block text-xs text-ink-muted">{body}</span>
      </span>
    </button>
  );
}

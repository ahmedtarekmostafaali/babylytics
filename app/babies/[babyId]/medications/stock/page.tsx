import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';
import { fmtDate, fmtDateTime, fmtRelative } from '@/lib/dates';
import { MedicationStockActions } from '@/components/MedicationStockActions';
import { AddMedToShopping } from '@/components/AddMedToShopping';
import { Pill, AlertTriangle, ArrowDown, ArrowUp, Minus, Plus, Calendar, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Medication stock' };

type Summary = {
  medication_id: string;
  baby_id: string;
  name: string;
  dosage: string | null;
  route: string;
  stock_unit: string;
  low_stock_threshold: number;
  current_stock: number;
  doses_taken: number;
  refills_count: number;
  last_txn_at: string | null;
};

type Txn = {
  id: string;
  medication_id: string;
  delta: number;
  reason: 'refill'|'dose'|'manual_adjust'|'expiry'|'lost';
  notes: string | null;
  created_at: string;
  source_log_id: string | null;
};

const REASON_META: Record<Txn['reason'], { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  refill:        { label: 'Refill',         icon: Plus,            tint: 'bg-mint-100 text-mint-700' },
  dose:          { label: 'Dose taken',     icon: Minus,           tint: 'bg-coral-100 text-coral-700' },
  manual_adjust: { label: 'Manual adjust',  icon: ArrowUp,         tint: 'bg-slate-100 text-ink' },
  expiry:        { label: 'Expired',        icon: ArrowDown,       tint: 'bg-peach-100 text-peach-700' },
  lost:          { label: 'Lost',           icon: ArrowDown,       tint: 'bg-coral-100 text-coral-700' },
};

export default async function MedicationStockPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  // Fetch in parallel: per-medication current stock summary + latest 200
  // transactions across every medication.
  const [{ data: summaryData }, { data: txnData }] = await Promise.all([
    supabase.from('medication_stock_summary')
      .select('medication_id,baby_id,name,dosage,route,stock_unit,low_stock_threshold,current_stock,doses_taken,refills_count,last_txn_at')
      .eq('baby_id', params.babyId)
      .order('current_stock', { ascending: true }),
    supabase.from('medication_stock_txn')
      .select('id,medication_id,delta,reason,notes,created_at,source_log_id')
      .eq('baby_id', params.babyId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const summaries = (summaryData ?? []) as Summary[];
  const txns      = (txnData ?? []) as Txn[];
  const medById   = new Map(summaries.map(s => [s.medication_id, s.name]));

  const lowCount  = summaries.filter(s => s.current_stock <= s.low_stock_threshold).length;
  const oosCount  = summaries.filter(s => s.current_stock <= 0).length;

  return (
    <PageShell max="5xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/medications`}
        backLabel="medications"
        eyebrow="Inventory"
        eyebrowTint="lavender"
        title="Medication stock"
        subtitle="Aggregated totals + every refill / dose deduction in one place."
      />

      {/* Top alert strip */}
      {(oosCount > 0 || lowCount > 0) ? (
        <section className="rounded-2xl bg-coral-50 border border-coral-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-coral-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-coral-900">
            <div className="font-bold">
              {oosCount > 0 && `${oosCount} out of stock`}
              {oosCount > 0 && lowCount > oosCount && ' · '}
              {lowCount > oosCount && `${lowCount - oosCount} below threshold`}
            </div>
            <div className="text-xs text-coral-800/90 mt-0.5">Refill before next dose to keep adherence on track.</div>
          </div>
        </section>
      ) : summaries.length > 0 && (
        <section className="rounded-2xl bg-mint-50 border border-mint-200 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-mint-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-mint-900">
            <div className="font-bold">Every medication has stock above its threshold.</div>
            <div className="text-xs text-mint-800/90 mt-0.5">You'll get an alert here and in the bell when any drops to its low-stock level.</div>
          </div>
        </section>
      )}

      {/* Aggregated stock table */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-strong">Current stock</h2>
          <span className="text-xs text-ink-muted">{summaries.length} active medication{summaries.length === 1 ? '' : 's'}</span>
        </div>

        {summaries.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-muted">
            No medications yet. Add one from the medications page to start tracking stock.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {summaries.map(s => {
              const low = s.current_stock <= s.low_stock_threshold;
              const oos = s.current_stock <= 0;
              return (
                <li key={s.medication_id} className="px-5 py-4 grid lg:grid-cols-[40px_1fr_180px_240px] items-center gap-3">
                  <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
                    oos ? 'bg-coral-500 text-white' : low ? 'bg-coral-100 text-coral-600' : 'bg-lavender-100 text-lavender-600'
                  }`}>
                    <Pill className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink-strong">{s.name}</span>
                      {s.dosage && <span className="text-xs text-ink-muted">· {s.dosage}</span>}
                      {oos && (
                        <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-coral-500 text-white px-1.5 py-0.5">
                          out of stock
                        </span>
                      )}
                      {low && !oos && (
                        <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-coral-100 text-coral-700 px-1.5 py-0.5">
                          low
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-muted">
                      {s.route} · threshold {s.low_stock_threshold} {s.stock_unit}
                      {s.last_txn_at && <> · last change {fmtRelative(s.last_txn_at)}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-bold tabular-nums leading-none ${oos ? 'text-coral-600' : low ? 'text-coral-500' : 'text-ink-strong'}`}>
                      {s.current_stock}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{s.stock_unit} left</div>
                    <div className="text-[10px] text-ink-muted mt-0.5">{s.doses_taken} taken · {s.refills_count} refills</div>
                  </div>
                  <div>
                    {perms.canWriteLogs && (
                      <>
                        <MedicationStockActions
                          medId={s.medication_id}
                          current={s.current_stock}
                          threshold={s.low_stock_threshold}
                        />
                        {/* Highlight the shopping shortcut when stock is low —
                            that's when a refill is most urgent. */}
                        <div className={`mt-2 flex justify-end ${low ? '' : 'opacity-70'}`}>
                          <AddMedToShopping medId={s.medication_id}
                            label={low ? 'Add refill to shopping' : 'Add to shopping'} />
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Transaction history */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-strong">Transaction history</h2>
          <span className="text-xs text-ink-muted">last 200 events</span>
        </div>
        {txns.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-muted">
            <Calendar className="inline h-4 w-4 mr-1" /> No stock changes yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {txns.map(tx => {
              const meta = REASON_META[tx.reason];
              const isOut = tx.delta < 0;
              return (
                <li key={tx.id} className="px-5 py-3 grid grid-cols-[36px_1fr_auto] items-center gap-3">
                  <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${meta.tint}`}>
                    <meta.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-strong truncate">
                      {meta.label} · <span className="text-ink-muted font-normal">{medById.get(tx.medication_id) ?? 'medication'}</span>
                    </div>
                    <div className="text-[11px] text-ink-muted truncate">
                      {fmtDateTime(tx.created_at)}{tx.notes ? ` · ${tx.notes}` : ''}
                    </div>
                  </div>
                  <div className={`text-base font-bold tabular-nums ${isOut ? 'text-coral-600' : 'text-mint-600'}`}>
                    {isOut ? '' : '+'}{tx.delta}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

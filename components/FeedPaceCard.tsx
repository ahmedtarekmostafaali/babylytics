import { Milk, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmtMl } from '@/lib/units';
import type { FeedPaceComparison } from '@/lib/feed-kpis';

/**
 * "Feed pace vs 7-day average" card. Drops into the overview KPI grid
 * alongside the other LastCard tiles. Self-hides when there's no baseline
 * (first week of tracking) to avoid showing meaningless deltas.
 */
export function FeedPaceCard({ cmp }: { cmp: FeedPaceComparison }) {
  const noBaseline = cmp.baseline_days === 0 || cmp.avg_so_far_ml === 0;

  // Subtle visual: red if behind by >15%, green if ahead by >15%, neutral otherwise.
  const status: 'ahead'|'behind'|'on_track' =
    cmp.delta_pct == null ? 'on_track'
      : cmp.delta_pct >  15 ? 'ahead'
      : cmp.delta_pct < -15 ? 'behind'
      : 'on_track';

  const ringCss = {
    ahead:    'border-mint-200    bg-gradient-to-br from-mint-50/70    via-white to-brand-50/40',
    behind:   'border-coral-200   bg-gradient-to-br from-coral-50/70   via-white to-peach-50/40',
    on_track: 'border-brand-200   bg-gradient-to-br from-brand-50/70   via-white to-mint-50/40',
  }[status];
  const iconCss = {
    ahead:    'bg-mint-500    text-white',
    behind:   'bg-coral-500   text-white',
    on_track: 'bg-brand-500   text-white',
  }[status];

  return (
    <div className={`rounded-2xl border p-4 shadow-card ${ringCss}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${iconCss}`}>
          <Milk className="h-3.5 w-3.5" />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Feed pace</div>
        <div className="ml-auto text-[10px] text-ink-muted">{cmp.cutoff_label}</div>
      </div>

      <div className="text-2xl font-bold tabular-nums text-ink-strong">
        {fmtMl(cmp.today_so_far_ml)}
      </div>
      <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
        Today so far
        {!noBaseline && (
          <> · 7-day avg <strong className="text-ink">{fmtMl(cmp.avg_so_far_ml)}</strong></>
        )}
      </div>

      {noBaseline ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink-muted text-[11px] font-bold px-2 py-0.5">
          Baseline forming…
        </div>
      ) : status === 'ahead' ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[11px] font-bold px-2 py-0.5">
          <TrendingUp className="h-3 w-3" /> +{fmtMl(cmp.delta_ml)} ({cmp.delta_pct!.toFixed(0)}%) ahead
        </div>
      ) : status === 'behind' ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-50 text-coral-700 text-[11px] font-bold px-2 py-0.5">
          <TrendingDown className="h-3 w-3" /> {fmtMl(cmp.delta_ml)} ({cmp.delta_pct!.toFixed(0)}%) behind
        </div>
      ) : (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold px-2 py-0.5">
          <Minus className="h-3 w-3" /> on pace
        </div>
      )}
    </div>
  );
}

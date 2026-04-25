import Link from 'next/link';
import { Scale, Ruler, Sparkles, TrendingUp, ArrowRight, Brain } from 'lucide-react';
import { fmtKg, fmtCm } from '@/lib/units';
import {
  whoMedianFor, compareToMedian, spurtStateFor, milestoneFor, type Sex,
} from '@/lib/growth-standards';

type Props = {
  babyId: string;
  babyName: string;
  ageDays: number;
  sex: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm:   number | null;
};

/**
 * Horizontal strip of dynamic insights for the post-birth dashboard. Replaces
 * the prior "Weekly insight" banner. All four cards self-hide when their
 * underlying data is missing — never an empty state.
 *
 * 1. Weight-for-age vs WHO median
 * 2. Length-for-age vs WHO median
 * 3. Growth spurt window (current / next)
 * 4. Developmental milestone for current age bucket
 */
export function GrowthInsights({ babyId, babyName, ageDays, sex, weightKg, heightCm, headCm }: Props) {
  const sexT = (sex as Sex) ?? 'unspecified';
  const median = whoMedianFor(ageDays, sexT);
  const wCmp = compareToMedian(weightKg, median.weight_kg_median);
  const hCmp = compareToMedian(heightCm, median.length_cm_median);
  const spurt = spurtStateFor(ageDays);
  const milestone = milestoneFor(ageDays);

  // First name only in headlines so the strip stays compact.
  const first = babyName.split(/\s+/)[0] ?? babyName;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg grid place-items-center bg-gradient-to-br from-mint-500 to-brand-500 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Growth insights</h2>
        <span className="text-[10px] text-ink-muted">vs WHO median</span>
        <Link href={`/babies/${babyId}/measurements`}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium px-3 py-1 text-ink-strong">
          Log measurement <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Weight */}
        <InsightCard tint="brand" icon={Scale} label="Weight">
          {weightKg != null && median.weight_kg_median != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtKg(weightKg)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Median for age: <strong>{fmtKg(median.weight_kg_median)}</strong>
              </div>
              <StatusLine status={wCmp.status} delta={wCmp.delta} unit="kg" />
            </>
          ) : weightKg != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtKg(weightKg)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">No reference yet for this age</div>
            </>
          ) : (
            <Empty>Log a weight to see {first} vs WHO median.</Empty>
          )}
        </InsightCard>

        {/* 2. Length / height */}
        <InsightCard tint="mint" icon={Ruler} label="Length / height">
          {heightCm != null && median.length_cm_median != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtCm(heightCm)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                Median for age: <strong>{fmtCm(median.length_cm_median)}</strong>
              </div>
              <StatusLine status={hCmp.status} delta={hCmp.delta} unit="cm" />
            </>
          ) : heightCm != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtCm(heightCm)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">No reference yet for this age</div>
            </>
          ) : (
            <Empty>Log a height to see {first} vs WHO median.</Empty>
          )}
          {/* Bonus: head circumference if we have one */}
          {headCm != null && median.head_cm_median != null && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-ink-muted">
              Head: <strong className="text-ink">{fmtCm(headCm)}</strong> · median <strong>{fmtCm(median.head_cm_median)}</strong>
            </div>
          )}
        </InsightCard>

        {/* 3. Growth spurt */}
        <InsightCard
          tint={spurt.state === 'in' ? 'coral' : spurt.state === 'soon' ? 'peach' : 'lavender'}
          icon={TrendingUp}
          label={spurt.state === 'in' ? 'Growth spurt now' : spurt.state === 'soon' ? 'Growth spurt soon' : 'Next growth spurt'}>
          <div className="text-lg font-bold text-ink-strong leading-tight">
            {spurt.label}
          </div>
          <div className="text-[11px] text-ink-muted mt-1 leading-snug">{spurt.sub}</div>
          {spurt.state === 'soon' && spurt.days_until != null && (
            <div className="text-[11px] text-peach-700 mt-1.5 font-semibold">
              ~{spurt.days_until} day{spurt.days_until === 1 ? '' : 's'} away
            </div>
          )}
          {spurt.state === 'after' && spurt.days_since != null && (
            <div className="text-[11px] text-ink-muted mt-1.5">
              {spurt.days_since} days since the last one
            </div>
          )}
        </InsightCard>

        {/* 4. Milestone */}
        <InsightCard tint="lavender" icon={Brain} label={`Milestones · ${milestone.age_label}`}>
          <div className="text-sm font-bold text-ink-strong leading-snug">{milestone.headline}</div>
          <div className="text-[11px] text-ink-muted mt-1 leading-snug">
            <strong className="text-ink">Watch for:</strong> {milestone.watch_for}
          </div>
        </InsightCard>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InsightCard({
  tint, icon: Icon, label, children,
}: {
  tint: 'brand' | 'mint' | 'coral' | 'peach' | 'lavender';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  const ring = {
    brand:    'border-brand-200    bg-gradient-to-br from-brand-50/70    via-white to-mint-50/40',
    mint:     'border-mint-200     bg-gradient-to-br from-mint-50/70     via-white to-brand-50/40',
    coral:    'border-coral-200    bg-gradient-to-br from-coral-50/70    via-white to-peach-50/40',
    peach:    'border-peach-200    bg-gradient-to-br from-peach-50/70    via-white to-coral-50/40',
    lavender: 'border-lavender-200 bg-gradient-to-br from-lavender-50/70 via-white to-brand-50/40',
  }[tint];
  const iconCss = {
    brand:    'bg-brand-500    text-white',
    mint:     'bg-mint-500     text-white',
    coral:    'bg-coral-500    text-white',
    peach:    'bg-peach-500    text-white',
    lavender: 'bg-lavender-500 text-white',
  }[tint];
  return (
    <div className={`rounded-2xl border p-4 shadow-card ${ring}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${iconCss}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted truncate">{label}</div>
      </div>
      {children}
    </div>
  );
}

function StatusLine({ status, delta, unit }: {
  status: 'on_track' | 'above' | 'below' | 'unknown';
  delta: number | null;
  unit: string;
}) {
  if (status === 'unknown' || delta == null) return null;
  const sign = delta >= 0 ? '+' : '';
  if (status === 'on_track') {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[11px] font-bold px-2 py-0.5">
        ✓ on track ({sign}{delta.toFixed(1)} {unit})
      </div>
    );
  }
  if (status === 'above') {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-peach-50 text-peach-700 text-[11px] font-bold px-2 py-0.5">
        ↑ above median ({sign}{delta.toFixed(1)} {unit})
      </div>
    );
  }
  return (
    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-50 text-coral-700 text-[11px] font-bold px-2 py-0.5">
      ↓ below median ({delta.toFixed(1)} {unit})
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-ink-muted italic mt-1">{children}</div>;
}

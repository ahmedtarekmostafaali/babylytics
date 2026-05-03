// CycleBaselineCard — your numbers at a glance, computed server-side from
// your own historical cycles via the cycle_personal_baseline RPC.
// Renders even before the first cycle is logged with sensible empties +
// a "log your first period" nudge.

import { Activity, Calendar, Heart, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export interface CycleBaseline {
  median_cycle_length:  number | null;
  median_period_length: number | null;
  cycle_count:          number;
  first_logged:         string | null;
  regularity_score:     number | null;  // 1–5
  top_symptoms:         string[] | null;
}

const REGULARITY_LABEL: Record<number, { label: string; tint: string }> = {
  1: { label: 'Very irregular',  tint: 'bg-coral-100 text-coral-700' },
  2: { label: 'Irregular',       tint: 'bg-coral-50  text-coral-600' },
  3: { label: 'Somewhat regular',tint: 'bg-peach-100 text-peach-700' },
  4: { label: 'Mostly regular',  tint: 'bg-mint-100  text-mint-700'  },
  5: { label: 'Very regular',    tint: 'bg-mint-200  text-mint-800'  },
};

export function CycleBaselineCard({
  baseline, babyId,
}: {
  baseline: CycleBaseline | null;
  babyId: string;
}) {
  // Even when there's no data yet we render — gives a clear empty state
  // pointing at the "Log period" CTA.
  const hasAny = baseline && baseline.cycle_count > 0;
  const reg = baseline?.regularity_score ? REGULARITY_LABEL[baseline.regularity_score] : null;

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-mint-50 flex items-center gap-2">
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-brand-100 text-brand-600">
          <Activity className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-strong leading-tight">Your baseline</h3>
          <p className="text-[11px] text-ink-muted leading-tight">
            Computed entirely from your own data — no comparison to other users.
          </p>
        </div>
      </div>

      {!hasAny ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          <div className="mx-auto h-10 w-10 rounded-full bg-coral-100 text-coral-600 grid place-items-center mb-2">
            <AlertTriangle className="h-5 w-5" />
          </div>
          No cycles logged yet — your numbers will appear here after the first one.
          <div className="mt-3">
            <Link href={`/babies/${babyId}/planner/cycles/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-xs font-semibold px-3 py-1.5">
              Log your first period
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-4 gap-4 p-5">
          <Stat icon={Calendar} tint="coral" label="Median cycle"
            value={baseline!.median_cycle_length != null
              ? `${Math.round(baseline!.median_cycle_length)} days`
              : '—'} />
          <Stat icon={Heart} tint="lavender" label="Median period"
            value={baseline!.median_period_length != null
              ? `${Math.round(baseline!.median_period_length)} days`
              : 'log period end to see'} />
          <Stat icon={Activity} tint="mint" label="Regularity"
            value={reg ? reg.label : 'needs 3+ cycles'}
            chipClass={reg?.tint} />
          <Stat icon={Activity} tint="peach" label="Cycles logged"
            value={`${baseline!.cycle_count}`}
            sub={baseline!.first_logged ? `since ${baseline!.first_logged}` : undefined} />

          {baseline!.top_symptoms && baseline!.top_symptoms.length > 0 && (
            <div className="sm:col-span-4 mt-2 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-ink-muted font-semibold uppercase tracking-wider text-[10px]">
                Most-reported symptoms
              </span>
              {baseline!.top_symptoms.map(s => (
                <span key={s}
                  className="inline-flex items-center rounded-full bg-slate-100 text-ink-strong text-xs font-semibold px-2 py-0.5">
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({
  icon: Icon, tint, label, value, sub, chipClass,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'lavender' | 'mint' | 'peach';
  label: string;
  value: string;
  sub?: string;
  chipClass?: string;
}) {
  const iconCls = {
    coral:    'bg-coral-100 text-coral-600',
    lavender: 'bg-lavender-100 text-lavender-600',
    mint:     'bg-mint-100 text-mint-600',
    peach:    'bg-peach-100 text-peach-600',
  }[tint];
  return (
    <div className="flex items-start gap-3 min-w-0">
      <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${iconCls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</div>
        {chipClass ? (
          <span className={`mt-0.5 inline-flex items-center rounded-full text-xs font-bold px-2 py-0.5 ${chipClass}`}>
            {value}
          </span>
        ) : (
          <div className="mt-0.5 text-sm font-bold text-ink-strong leading-tight truncate">{value}</div>
        )}
        {sub && <div className="text-[10px] text-ink-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

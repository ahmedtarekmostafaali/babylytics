import Link from 'next/link';
import { Scale, Ruler, Sparkles, TrendingUp, ArrowRight, Brain } from 'lucide-react';
import { fmtKg, fmtCm } from '@/lib/units';
import {
  whoMedianFor, whoMinFor, compareToMedian, compareToMin,
  spurtStateFor, milestoneFor, type Sex,
} from '@/lib/growth-standards';
import { tFor, type Lang } from '@/lib/i18n';

type Props = {
  babyId: string;
  babyName: string;
  ageDays: number;
  sex: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm:   number | null;
  /** Language for translated labels. Defaults to English when omitted. */
  lang?: Lang;
};

/**
 * Horizontal strip of dynamic insights for the post-birth dashboard. Replaces
 * the prior "Weekly insight" banner. All four cards self-hide when their
 * underlying data is missing — never an empty state.
 *
 * 1. Weight-for-age vs WHO median (+ minimum)
 * 2. Length-for-age vs WHO median (+ minimum)
 * 3. Growth spurt window (current / next)
 * 4. Developmental milestone for current age bucket
 */
export function GrowthInsights({ babyId, babyName, ageDays, sex, weightKg, heightCm, headCm, lang = 'en' }: Props) {
  const t = tFor(lang);
  const sexT = (sex as Sex) ?? 'unspecified';
  const median = whoMedianFor(ageDays, sexT);
  const min    = whoMinFor(ageDays, sexT);
  const wCmp   = compareToMedian(weightKg, median.weight_kg_median);
  const wMin   = compareToMin(weightKg, min.weight_kg_min);
  const hCmp   = compareToMedian(heightCm, median.length_cm_median);
  const hMin   = compareToMin(heightCm, min.length_cm_min);
  const spurt  = spurtStateFor(ageDays, t);
  const milestone = milestoneFor(ageDays, t);

  // First name only in headlines so the strip stays compact.
  const first = babyName.split(/\s+/)[0] ?? babyName;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg grid place-items-center bg-gradient-to-br from-mint-500 to-brand-500 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('growth.title')}</h2>
        <span className="text-[10px] text-ink-muted">{t('growth.vs_who')}</span>
        <Link href={`/babies/${babyId}/measurements`}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-xs font-medium px-3 py-1 text-ink-strong">
          {t('growth.log_measurement')} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Weight */}
        <InsightCard tint="brand" icon={Scale} label={t('growth.weight')}>
          {weightKg != null && median.weight_kg_median != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtKg(weightKg)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                {t('growth.median')}: <strong className="text-ink">{fmtKg(median.weight_kg_median)}</strong>
                {min.weight_kg_min != null && (
                  <> · {t('growth.min')}: <strong className="text-ink">{fmtKg(min.weight_kg_min)}</strong></>
                )}
              </div>
              <StatusLine status={wCmp.status} delta={wCmp.delta} unit="kg" t={t} />
              {wMin.status === 'below_min' && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-100 text-coral-800 text-[11px] font-bold px-2 py-0.5">
                  ⚠ {t('growth.below_who_min')}
                </div>
              )}
            </>
          ) : weightKg != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtKg(weightKg)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{t('growth.no_reference_yet')}</div>
            </>
          ) : (
            <Empty>{t('growth.log_weight_to_see', { first })}</Empty>
          )}
        </InsightCard>

        {/* 2. Length / height */}
        <InsightCard tint="mint" icon={Ruler} label={t('growth.length_height')}>
          {heightCm != null && median.length_cm_median != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtCm(heightCm)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                {t('growth.median')}: <strong className="text-ink">{fmtCm(median.length_cm_median)}</strong>
                {min.length_cm_min != null && (
                  <> · {t('growth.min')}: <strong className="text-ink">{fmtCm(min.length_cm_min)}</strong></>
                )}
              </div>
              <StatusLine status={hCmp.status} delta={hCmp.delta} unit="cm" t={t} />
              {hMin.status === 'below_min' && (
                <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-100 text-coral-800 text-[11px] font-bold px-2 py-0.5">
                  ⚠ {t('growth.below_who_min')}
                </div>
              )}
            </>
          ) : heightCm != null ? (
            <>
              <div className="text-2xl font-bold tabular-nums text-ink-strong">{fmtCm(heightCm)}</div>
              <div className="text-[11px] text-ink-muted mt-0.5">{t('growth.no_reference_yet')}</div>
            </>
          ) : (
            <Empty>{t('growth.log_height_to_see', { first })}</Empty>
          )}
          {/* Bonus: head circumference if we have one */}
          {headCm != null && median.head_cm_median != null && (
            <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-ink-muted">
              {t('growth.head')}: <strong className="text-ink">{fmtCm(headCm)}</strong> · {t('growth.median').toLowerCase()} <strong>{fmtCm(median.head_cm_median)}</strong>
              {min.head_cm_min != null && (
                <> · {t('growth.min')} <strong>{fmtCm(min.head_cm_min)}</strong></>
              )}
            </div>
          )}
        </InsightCard>

        {/* 3. Growth spurt */}
        <InsightCard
          tint={spurt.state === 'in' ? 'coral' : spurt.state === 'soon' ? 'peach' : 'lavender'}
          icon={TrendingUp}
          label={spurt.state === 'in' ? t('growth.growth_spurt_now') : spurt.state === 'soon' ? t('growth.growth_spurt_soon') : t('growth.next_growth_spurt')}>
          <div className="text-lg font-bold text-ink-strong leading-tight">
            {spurt.label}
          </div>
          <div className="text-[11px] text-ink-muted mt-1 leading-snug">{spurt.sub}</div>
          {spurt.state === 'soon' && spurt.days_until != null && (
            <div className="text-[11px] text-peach-700 mt-1.5 font-semibold">
              {t('growth.days_away', { n: spurt.days_until, s: spurt.days_until === 1 ? '' : 's' })}
            </div>
          )}
          {spurt.state === 'after' && spurt.days_since != null && (
            <div className="text-[11px] text-ink-muted mt-1.5">
              {t('growth.days_since_last', { n: spurt.days_since })}
            </div>
          )}
        </InsightCard>

        {/* 4. Milestone */}
        <InsightCard tint="lavender" icon={Brain} label={`${t('growth.milestones')} · ${milestone.age_label}`}>
          <div className="text-sm font-bold text-ink-strong leading-snug">{milestone.headline}</div>
          <div className="text-[11px] text-ink-muted mt-1 leading-snug">
            <strong className="text-ink">{t('growth.watch_for')}:</strong> {milestone.watch_for}
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

function StatusLine({ status, delta, unit, t }: {
  status: 'on_track' | 'above' | 'below' | 'unknown';
  delta: number | null;
  unit: string;
  t: ReturnType<typeof tFor>;
}) {
  if (status === 'unknown' || delta == null) return null;
  const sign = delta >= 0 ? '+' : '';
  if (status === 'on_track') {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[11px] font-bold px-2 py-0.5">
        ✓ {t('growth.on_track')} ({sign}{delta.toFixed(1)} {unit})
      </div>
    );
  }
  if (status === 'above') {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-peach-50 text-peach-700 text-[11px] font-bold px-2 py-0.5">
        ↑ {t('growth.above_median')} ({sign}{delta.toFixed(1)} {unit})
      </div>
    );
  }
  return (
    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-coral-50 text-coral-700 text-[11px] font-bold px-2 py-0.5">
      ↓ {t('growth.below_median')} ({delta.toFixed(1)} {unit})
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-ink-muted italic mt-1">{children}</div>;
}

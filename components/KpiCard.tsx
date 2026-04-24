import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sparkline } from '@/components/Sparkline';

type Tint = 'neutral' | 'brand' | 'mint' | 'coral' | 'lavender' | 'peach';
type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const TINT_CSS: Record<Tint, { bg: string; iconBg: string; iconFg: string; accent: string; color: string }> = {
  neutral:  { bg: 'bg-white',                                          iconBg: 'bg-slate-100',    iconFg: 'text-ink-muted',    accent: 'bg-slate-100',    color: '#94A3B8' },
  brand:    { bg: 'bg-gradient-to-br from-brand-50 via-white to-white', iconBg: 'bg-brand-500',    iconFg: 'text-white',        accent: 'bg-brand-100',    color: '#7BAEDC' },
  mint:     { bg: 'bg-gradient-to-br from-mint-50 via-white to-white',  iconBg: 'bg-mint-500',     iconFg: 'text-white',        accent: 'bg-mint-100',     color: '#7FC8A9' },
  coral:    { bg: 'bg-gradient-to-br from-coral-50 via-white to-white', iconBg: 'bg-coral-500',    iconFg: 'text-white',        accent: 'bg-coral-100',    color: '#F4A6A6' },
  lavender: { bg: 'bg-gradient-to-br from-lavender-50 via-white to-white', iconBg: 'bg-lavender-500', iconFg: 'text-white',     accent: 'bg-lavender-100', color: '#B9A7D8' },
  peach:    { bg: 'bg-gradient-to-br from-peach-50 via-white to-white', iconBg: 'bg-peach-500',    iconFg: 'text-white',        accent: 'bg-peach-100',    color: '#F6C177' },
};

const toneText: Record<Tone, string> = {
  neutral:  'text-ink-strong',
  positive: 'text-mint-700',
  warning:  'text-peach-700',
  danger:   'text-coral-700',
};

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tint?: Tint;
  tone?: Tone;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  trendLabel?: string;
  /** Optional tiny trend line below the value */
  spark?: number[];
}

export function KpiCard({
  label, value, sub, tint = 'neutral', tone = 'neutral', icon: Icon, trend, trendLabel, spark,
}: KpiCardProps) {
  const t = TINT_CSS[tint];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'   ? 'text-mint-700 bg-mint-100'  :
    trend === 'down' ? 'text-coral-700 bg-coral-100' :
                       'text-ink-muted bg-slate-100';

  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl border border-slate-200/70 p-5 shadow-card',
      t.bg,
    )}>
      {/* decorative glow */}
      <div className={cn('absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-60', t.accent)} />

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
          {Icon && (
            <div className={cn('h-10 w-10 rounded-2xl grid place-items-center shrink-0 shadow-sm', t.iconBg, t.iconFg)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className={cn('mt-3 text-3xl font-bold tracking-tight', toneText[tone])}>
          {value}
        </div>

        {spark && spark.length > 1 && (
          <div className="mt-2">
            <Sparkline data={spark} color={t.color} width={160} height={28} />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {sub && <div className="text-xs text-ink-muted">{sub}</div>}
          {trend && (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ml-auto', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {trendLabel ?? (trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

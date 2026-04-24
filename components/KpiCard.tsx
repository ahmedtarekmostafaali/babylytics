import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Tint = 'neutral' | 'brand' | 'mint' | 'coral' | 'lavender' | 'peach';
type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const tintBg: Record<Tint, string> = {
  neutral:  'bg-white',
  brand:    'bg-gradient-to-br from-brand-50 to-white',
  mint:     'bg-gradient-to-br from-mint-50 to-white',
  coral:    'bg-gradient-to-br from-coral-50 to-white',
  lavender: 'bg-gradient-to-br from-lavender-50 to-white',
  peach:    'bg-gradient-to-br from-peach-50 to-white',
};

const tintIcon: Record<Tint, string> = {
  neutral:  'bg-slate-100 text-ink-muted',
  brand:    'bg-brand-100 text-brand-600',
  mint:     'bg-mint-100 text-mint-600',
  coral:    'bg-coral-100 text-coral-600',
  lavender: 'bg-lavender-100 text-lavender-600',
  peach:    'bg-peach-100 text-peach-600',
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
  /** Optional trend direction shown as an arrow + tone color */
  trend?: 'up' | 'down' | 'flat';
  /** Optional short text next to the trend arrow, e.g. "+12% vs last week" */
  trendLabel?: string;
}

export function KpiCard({
  label, value, sub, tint = 'neutral', tone = 'neutral', icon: Icon, trend, trendLabel,
}: KpiCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'   ? 'text-mint-700  bg-mint-100' :
    trend === 'down' ? 'text-coral-700 bg-coral-100' :
                       'text-ink-muted bg-slate-100';

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border border-slate-200/70 p-4 sm:p-5 shadow-card',
      tintBg[tint],
    )}>
      {/* subtle watermark icon in the corner */}
      {Icon && (
        <div className="absolute -top-3 -right-3 opacity-10">
          <Icon className="h-16 w-16" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        {Icon && (
          <div className={cn('h-9 w-9 rounded-xl grid place-items-center shrink-0', tintIcon[tint])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className={cn('mt-3 text-2xl sm:text-3xl font-bold tracking-tight', toneText[tone])}>
        {value}
      </div>

      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}

      {trend && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {trendLabel ?? (trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'flat')}
          </span>
        </div>
      )}
    </div>
  );
}

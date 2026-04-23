import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Tint = 'neutral' | 'brand' | 'mint' | 'coral' | 'lavender' | 'peach';
type Tone = 'neutral' | 'positive' | 'warning' | 'danger';

const tintBg: Record<Tint, string> = {
  neutral:  'bg-white',
  brand:    'bg-brand-50',
  mint:     'bg-mint-50',
  coral:    'bg-coral-50',
  lavender: 'bg-lavender-50',
  peach:    'bg-peach-50',
};

const tintIcon: Record<Tint, string> = {
  neutral:  'text-ink-muted',
  brand:    'text-brand-600',
  mint:     'text-mint-600',
  coral:    'text-coral-600',
  lavender: 'text-lavender-600',
  peach:    'text-peach-600',
};

const toneText: Record<Tone, string> = {
  neutral:  'text-ink-strong',
  positive: 'text-mint-700',
  warning:  'text-peach-700',
  danger:   'text-coral-700',
};

export function KpiCard({
  label,
  value,
  sub,
  tint = 'neutral',
  tone = 'neutral',
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tint?: Tint;
  tone?: Tone;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 shadow-card p-4', tintBg[tint])}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-ink-muted uppercase tracking-wider">{label}</div>
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', tintIcon[tint])} />}
      </div>
      <div className={cn('mt-2 text-2xl font-bold tracking-tight', toneText[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtRelative } from '@/lib/dates';
import type { LucideIcon } from 'lucide-react';

type Tint = 'brand' | 'mint' | 'coral' | 'peach' | 'lavender';

const tiles: Record<Tint, string> = {
  brand:    'bg-brand-50 hover:bg-brand-100/70',
  mint:     'bg-mint-50 hover:bg-mint-100/70',
  coral:    'bg-coral-50 hover:bg-coral-100/70',
  peach:    'bg-peach-50 hover:bg-peach-100/70',
  lavender: 'bg-lavender-50 hover:bg-lavender-100/70',
};
const dotBg: Record<Tint, string> = {
  brand:    'bg-brand-100    text-brand-600',
  mint:     'bg-mint-100     text-mint-600',
  coral:    'bg-coral-100    text-coral-600',
  peach:    'bg-peach-100    text-peach-600',
  lavender: 'bg-lavender-100 text-lavender-600',
};

/**
 * Timeline-style row — colored tile with icon on the left, a headline + subline
 * in the middle, and a "time ago" label on the right. Inspired by the Sophie
 * mockup. Use for feedings/stool/measurement/doses lists.
 */
export function TimelineRow({
  href,
  icon: Icon,
  tint,
  title,
  subtitle,
  time,
}: {
  href: string;
  icon: LucideIcon;
  tint: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** ISO timestamp — shown as "X minutes ago" */
  time: string;
}) {
  return (
    <Link href={href} className={cn(
      'flex items-center gap-4 rounded-2xl p-3 sm:p-4 transition-colors border border-transparent hover:border-slate-200/80',
      tiles[tint],
    )}>
      <span className={cn('h-11 w-11 rounded-xl grid place-items-center shrink-0', dotBg[tint])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-ink-strong truncate">{title}</span>
        {subtitle && <span className="block text-xs text-ink-muted truncate mt-0.5">{subtitle}</span>}
      </span>
      <span className="text-xs text-ink-muted whitespace-nowrap">{fmtRelative(time)}</span>
    </Link>
  );
}

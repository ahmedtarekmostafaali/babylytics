import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fmtRelative } from '@/lib/dates';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

type Tint = 'coral' | 'mint' | 'peach' | 'lavender' | 'brand';

const fills: Record<Tint, { bg: string; iconBg: string; iconFg: string; ring: string; chipBg: string; chipFg: string }> = {
  coral:    { bg: 'bg-coral-50',    iconBg: 'bg-white',         iconFg: 'text-coral-600',    ring: 'hover:ring-coral-200',    chipBg: 'bg-white/70',     chipFg: 'text-coral-700'    },
  mint:     { bg: 'bg-mint-50',     iconBg: 'bg-white',         iconFg: 'text-mint-600',     ring: 'hover:ring-mint-200',     chipBg: 'bg-white/70',     chipFg: 'text-mint-700'     },
  peach:    { bg: 'bg-peach-50',    iconBg: 'bg-white',         iconFg: 'text-peach-600',    ring: 'hover:ring-peach-200',    chipBg: 'bg-white/70',     chipFg: 'text-peach-700'    },
  lavender: { bg: 'bg-lavender-50', iconBg: 'bg-white',         iconFg: 'text-lavender-600', ring: 'hover:ring-lavender-200', chipBg: 'bg-white/70',     chipFg: 'text-lavender-700' },
  brand:    { bg: 'bg-brand-50',    iconBg: 'bg-white',         iconFg: 'text-brand-600',    ring: 'hover:ring-brand-200',    chipBg: 'bg-white/70',     chipFg: 'text-brand-700'    },
};

/**
 * Colorful "latest activity" tile — icon, title, a "X ago" chip on top.
 * Inspired by the Sophie mockup:
 *   ╭─────────────╮
 *   │ [icon]      │
 *   │ 1 hr 10 min │  ← time chip
 *   │ Formula 165 │
 *   ╰─────────────╯
 */
export function ActivityTile({
  href, icon: Icon, tint, title, subtitle, time, empty,
}: {
  href: string;
  icon: LucideIcon;
  tint: Tint;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** ISO timestamp — shown as relative time chip at the top */
  time: string | null;
  empty?: string;
}) {
  const f = fills[tint];
  return (
    <Link href={href}
      className={cn(
        'relative block rounded-2xl p-5 transition ring-1 ring-transparent hover:shadow-panel',
        f.bg, f.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('h-11 w-11 rounded-xl shadow-card grid place-items-center shrink-0', f.iconBg, f.iconFg)}>
          <Icon className="h-5 w-5" />
        </div>
        {time ? (
          <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5', f.chipBg, f.chipFg)}>
            {fmtRelative(time)}
          </span>
        ) : (
          <span className={cn('text-[11px] font-medium rounded-full px-2 py-0.5', f.chipBg, f.chipFg)}>
            no data
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-lg font-bold text-ink-strong leading-tight">
          {time ? title : (empty ?? 'Nothing yet')}
        </div>
        {subtitle && time && (
          <div className="mt-0.5 text-xs text-ink-muted">{subtitle}</div>
        )}
      </div>
      <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-ink-muted" />
    </Link>
  );
}

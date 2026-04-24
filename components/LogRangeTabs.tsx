'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

type Range = '24h' | '7d' | '30d' | '90d' | 'custom';

/**
 * URL-aware range tabs shown at the top of every log page. Picks up the
 * current `?range=` param and renders an active state for it. The "Custom"
 * tab just lights up when `range=custom` is present.
 */
export function LogRangeTabs({
  current,
}: {
  current?: Range;
}) {
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const active: Range = (current ?? (params?.get('range') as Range) ?? '24h') as Range;

  function href(r: Range) {
    const next = new URLSearchParams(Array.from(params?.entries() ?? []));
    next.set('range', r);
    return `${pathname}?${next.toString()}`;
  }

  const tabs: { key: Range; label: string }[] = [
    { key: '24h', label: '24 h' },
    { key: '7d',  label: '7 d' },
    { key: '30d', label: '30 d' },
    { key: '90d', label: '90 d' },
  ];

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 p-1 shadow-sm">
      {tabs.map(t => {
        const on = active === t.key;
        return (
          <Link key={t.key} href={href(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-semibold transition',
              on ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-sm' : 'text-ink-muted hover:text-ink',
            )}>
            {t.label}
          </Link>
        );
      })}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <Link href={href('custom')}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold transition',
          active === 'custom' ? 'bg-lavender-500 text-white' : 'text-ink-muted hover:text-ink',
        )}>
        <Calendar className="h-3.5 w-3.5" /> Custom
      </Link>
    </div>
  );
}

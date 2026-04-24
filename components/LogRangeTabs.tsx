'use client';

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, Check } from 'lucide-react';

type Range = '24h' | '7d' | '30d' | '90d' | 'custom';

/**
 * URL-aware range tabs shown at the top of every log page.
 *
 * - 24h / 7d / 30d / 90d → set `?range=KEY`, clear `start`/`end`.
 * - Custom → reveal an inline From/To pair of date inputs. On Apply we
 *   replace the URL with `?range=custom&start=ISO&end=ISO`.
 *
 * The parent page uses `parseRangeParam(searchParams)` from `lib/dates` which
 * already understands `start`/`end`, so the rest of the page (list query,
 * summary card) just sees a proper window.
 */
export function LogRangeTabs({
  current,
}: {
  current?: Range;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const params = useSearchParams();
  const active: Range = (current ?? (params?.get('range') as Range) ?? '24h') as Range;

  const initialStart = params?.get('start')?.slice(0, 10) ?? '';
  const initialEnd   = params?.get('end')?.slice(0, 10) ?? '';
  const [openCustom, setOpenCustom] = useState(active === 'custom');
  const [from, setFrom] = useState(initialStart);
  const [to,   setTo]   = useState(initialEnd);

  useEffect(() => {
    setOpenCustom(active === 'custom');
    setFrom(initialStart);
    setTo(initialEnd);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function presetHref(r: Exclude<Range, 'custom'>) {
    const next = new URLSearchParams(Array.from(params?.entries() ?? []));
    next.set('range', r);
    next.delete('start'); next.delete('end');
    return `${pathname}?${next.toString()}`;
  }

  function applyCustom() {
    if (!from || !to) return;
    const startIso = new Date(`${from}T00:00:00`).toISOString();
    const endIso   = new Date(`${to}T23:59:59`).toISOString();
    const next = new URLSearchParams(Array.from(params?.entries() ?? []));
    next.set('range', 'custom');
    next.set('start', startIso);
    next.set('end',   endIso);
    router.push(`${pathname}?${next.toString()}`);
  }

  const tabs: { key: Exclude<Range, 'custom'>; label: string }[] = [
    { key: '24h', label: '24 h' },
    { key: '7d',  label: '7 d' },
    { key: '30d', label: '30 d' },
    { key: '90d', label: '90 d' },
  ];

  return (
    <div className="inline-flex items-start gap-2 flex-wrap">
      <div className="inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 p-1 shadow-sm">
        {tabs.map(t => {
          const on = active === t.key;
          return (
            <Link key={t.key} href={presetHref(t.key)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-semibold transition',
                on ? 'bg-gradient-to-r from-coral-500 to-coral-600 text-white shadow-sm' : 'text-ink-muted hover:text-ink',
              )}>
              {t.label}
            </Link>
          );
        })}
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <button type="button"
          onClick={() => setOpenCustom(o => !o)}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold transition',
            active === 'custom' || openCustom ? 'bg-lavender-500 text-white' : 'text-ink-muted hover:text-ink',
          )}>
          <Calendar className="h-3.5 w-3.5" /> Custom
        </button>
      </div>

      {openCustom && (
        <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 p-2 shadow-sm flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted px-1">From</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:border-lavender-500" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted px-1">To</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:border-lavender-500" />
          <button type="button" onClick={applyCustom}
            disabled={!from || !to}
            className="inline-flex items-center gap-1 rounded-lg bg-lavender-500 hover:bg-lavender-600 text-white text-xs font-semibold px-3 h-8 disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> Apply
          </button>
        </div>
      )}
    </div>
  );
}

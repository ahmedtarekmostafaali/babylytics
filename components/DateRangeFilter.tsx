'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { RangeKey } from '@/lib/dates';

const QUICK: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: '24h', label: '24 h' },
  { key: '7d',  label: '7 d'  },
  { key: '30d', label: '30 d' },
  { key: '90d', label: '90 d' },
];

export function DateRangeFilter({ currentKey }: { currentKey: RangeKey }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(currentKey === 'custom');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal]     = useState('');

  function go(nextParams: URLSearchParams) {
    router.push(`${pathname}?${nextParams.toString()}`);
  }

  function setQuick(k: Exclude<RangeKey, 'custom'>) {
    const p = new URLSearchParams(searchParams?.toString());
    p.delete('start'); p.delete('end');
    if (k === '24h') p.delete('range'); else p.set('range', k);
    go(p);
    setOpen(false);
  }

  function applyCustom() {
    if (!startLocal || !endLocal) return;
    const p = new URLSearchParams(searchParams?.toString());
    p.delete('range');
    p.set('start', new Date(startLocal).toISOString());
    p.set('end',   new Date(endLocal).toISOString());
    go(p);
    // keep panel open so user knows custom is active
  }

  const customActive = currentKey === 'custom' || open;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
        {QUICK.map(r => (
          <button
            key={r.key}
            onClick={() => setQuick(r.key)}
            className={cn(
              'px-3 py-1.5 text-sm transition',
              currentKey === r.key ? 'bg-brand-500 text-white' : 'text-ink hover:bg-slate-50'
            )}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            'px-3 py-1.5 text-sm transition border-l border-slate-200',
            customActive ? 'bg-brand-500 text-white' : 'text-ink hover:bg-slate-50'
          )}
        >
          Custom
        </button>
      </div>

      {open && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-white p-3 shadow-card">
          <div>
            <label className="block text-xs text-ink-muted mb-1">From</label>
            <input type="datetime-local" value={startLocal} onChange={e => setStartLocal(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">To</label>
            <input type="datetime-local" value={endLocal} onChange={e => setEndLocal(e.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm" />
          </div>
          <button
            onClick={applyCustom}
            disabled={!startLocal || !endLocal}
            className="h-9 rounded-md bg-brand-500 px-3 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

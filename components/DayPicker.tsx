'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export function DayPicker({ babyId, value }: { babyId: string; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);

  function go(iso: string) {
    router.push(`${pathname ?? `/babies/${babyId}/reports/daily`}?d=${iso}`);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white">
      <button onClick={() => go(shiftDay(v, -1))} className="h-9 w-9 grid place-items-center hover:bg-slate-50" aria-label="Previous day">
        <ChevronLeft className="h-4 w-4 text-ink-muted" />
      </button>
      <input
        type="date"
        value={v}
        onChange={e => { setV(e.target.value); go(e.target.value); }}
        className="h-9 bg-transparent px-2 text-sm focus:outline-none"
      />
      <button onClick={() => go(shiftDay(v, 1))} className="h-9 w-9 grid place-items-center hover:bg-slate-50" aria-label="Next day">
        <ChevronRight className="h-4 w-4 text-ink-muted" />
      </button>
    </div>
  );
}

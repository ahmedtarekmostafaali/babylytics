'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Check, Edit3, AlertTriangle, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  priority: 'low'|'normal'|'high';
  is_done: boolean;
  done_at: string | null;
  notes: string | null;
};

const PRIORITY_BADGE = {
  high:   'bg-coral-100 text-coral-700 border-coral-200',
  normal: 'bg-peach-100 text-peach-700 border-peach-200',
  low:    'bg-mint-100  text-mint-700  border-mint-200',
};

const PRIORITY_ICON = {
  high:   AlertTriangle,
  normal: () => null,
  low:    ArrowDown,
};

export function ShoppingItemRow({
  item, babyId, scope, canWrite,
}: {
  item: Row;
  babyId: string;
  scope: 'baby'|'pregnancy';
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimisticDone, setOptimisticDone] = useState(item.is_done);

  function toggle() {
    if (!canWrite) return;
    const next = !optimisticDone;
    setOptimisticDone(next);
    start(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('shopping_list_items')
        .update({
          is_done: next,
          done_at: next ? new Date().toISOString() : null,
          done_by: next ? user?.id ?? null : null,
        })
        .eq('id', item.id);
      if (error) {
        // Roll back the optimistic flip on failure.
        setOptimisticDone(!next);
      }
      router.refresh();
    });
  }

  const PriorityIcon = PRIORITY_ICON[item.priority];

  return (
    <li className={cn(
      'flex items-center gap-3 px-4 py-3 transition border-b border-slate-100 last:border-b-0',
      optimisticDone && 'opacity-60',
    )}>
      <button
        type="button"
        onClick={toggle}
        disabled={!canWrite || pending}
        aria-label={optimisticDone ? 'Mark as not purchased' : 'Mark as purchased'}
        className={cn(
          'h-7 w-7 rounded-full border-2 grid place-items-center shrink-0 transition',
          optimisticDone
            ? 'bg-mint-500 border-mint-500 text-white'
            : 'border-slate-300 hover:border-mint-500 bg-white',
          !canWrite && 'cursor-not-allowed',
        )}>
        {optimisticDone && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={cn('font-semibold text-ink-strong truncate', optimisticDone && 'line-through text-ink-muted')}>
          {item.name}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-muted mt-0.5">
          {item.category && <span className="font-semibold">{item.category}</span>}
          {item.category && item.quantity && <span>·</span>}
          {item.quantity && <span>{item.quantity}</span>}
        </div>
      </div>

      {item.priority !== 'normal' && (
        <span className={cn(
          'inline-flex items-center gap-1 rounded-full text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border',
          PRIORITY_BADGE[item.priority],
        )}>
          <PriorityIcon className="h-3 w-3" />
          {item.priority}
        </span>
      )}

      {canWrite && (
        <Link href={`/babies/${babyId}/shopping/${item.id}?scope=${scope}`}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-2.5 py-1 shrink-0">
          <Edit3 className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

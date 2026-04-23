import { cn } from '@/lib/utils';

export function ConfidenceBadge({ score }: { score: number | string | null | undefined }) {
  if (score == null || score === '') return null;
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return null;
  const pct = Math.round(n * 100);
  const tone =
    n >= 0.85 ? 'bg-emerald-100 text-emerald-800' :
    n >= 0.7  ? 'bg-amber-100 text-amber-800'     :
                'bg-red-100 text-red-800';
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', tone)}>
      {pct}% confidence{n < 0.7 ? ' · review carefully' : ''}
    </span>
  );
}

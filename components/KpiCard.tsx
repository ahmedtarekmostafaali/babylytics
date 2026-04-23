import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'neutral'|'positive'|'warning'|'danger' }) {
  const toneCls = {
    neutral:  'text-slate-900',
    positive: 'text-emerald-600',
    warning:  'text-amber-600',
    danger:   'text-red-600',
  }[tone];
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tracking-tight', toneCls)}>{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </CardContent>
    </Card>
  );
}

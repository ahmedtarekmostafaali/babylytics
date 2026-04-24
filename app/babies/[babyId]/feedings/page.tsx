import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { fmtDateTime, parseRangeParam } from '@/lib/dates';
import { fmtMl } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function FeedingsList({
  params,
  searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: rows } = await supabase
    .from('feedings')
    .select('id,feeding_time,milk_type,quantity_ml,kcal,source')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('feeding_time', range.start)
    .lte('feeding_time', range.end)
    .order('feeding_time', { ascending: false }).limit(500);

  const total = (rows ?? []).reduce((acc, r) => acc + (Number(r.quantity_ml) || 0), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/babies/${params.babyId}`} className="text-sm text-ink-muted hover:underline">← {baby.name}</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">Feedings</h1>
          <p className="text-sm text-ink-muted">{range.label} · {(rows ?? []).length} feedings · total {fmtMl(total)}</p>
        </div>
        <Link href={`/babies/${params.babyId}/feedings/new`}><Button variant="peach">+ Log feed</Button></Link>
      </div>
      <DateRangeFilter currentKey={range.key} />

      <Card>
        <CardHeader><CardTitle>Feedings in this range</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(rows ?? []).length === 0 && <p className="text-ink-muted">No feedings in this time window.</p>}
          {rows?.map(r => (
            <Link key={r.id} href={`/babies/${params.babyId}/feedings/${r.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
              <div>
                <div className="font-medium text-ink-strong">{fmtMl(r.quantity_ml)} · {r.milk_type}{r.kcal ? ` · ${r.kcal} kcal` : ''}</div>
                <div className="text-xs text-ink-muted">{fmtDateTime(r.feeding_time)}{r.source !== 'manual' ? ` · ${r.source}` : ''}</div>
              </div>
              <span className="text-xs text-ink-muted">edit</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

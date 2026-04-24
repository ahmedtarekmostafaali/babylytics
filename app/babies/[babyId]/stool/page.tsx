import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { fmtDateTime, parseRangeParam } from '@/lib/dates';
import { fmtMl } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function StoolList({
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
    .from('stool_logs')
    .select('id,stool_time,quantity_category,quantity_ml,color,consistency,source')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('stool_time', range.start)
    .lte('stool_time', range.end)
    .order('stool_time', { ascending: false }).limit(500);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href={`/babies/${params.babyId}`} className="text-sm text-ink-muted hover:underline">← {baby.name}</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">Stool logs</h1>
          <p className="text-sm text-ink-muted">{range.label} · {(rows ?? []).length} logs</p>
        </div>
        <Link href={`/babies/${params.babyId}/stool/new`}><Button variant="mint">+ Log stool</Button></Link>
      </div>
      <DateRangeFilter currentKey={range.key} />

      <Card>
        <CardHeader><CardTitle>Stool logs in this range</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(rows ?? []).length === 0 && <p className="text-ink-muted">No stool logs in this time window.</p>}
          {rows?.map(r => (
            <Link key={r.id} href={`/babies/${params.babyId}/stool/${r.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
              <div>
                <div className="font-medium text-ink-strong">{r.quantity_category ?? 'stool'}{r.quantity_ml ? ` · ${fmtMl(r.quantity_ml)}` : ''}{r.color ? ` · ${r.color}` : ''}</div>
                <div className="text-xs text-ink-muted">{fmtDateTime(r.stool_time)}{r.source !== 'manual' ? ` · ${r.source}` : ''}</div>
              </div>
              <span className="text-xs text-ink-muted">edit</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

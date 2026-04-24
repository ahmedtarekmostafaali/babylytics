import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { TimelineRow } from '@/components/TimelineRow';
import { parseRangeParam } from '@/lib/dates';
import { fmtMl } from '@/lib/units';
import { Milk } from 'lucide-react';

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
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Feedings"
        eyebrowTint="peach"
        title="Bottle, breast, and solids"
        subtitle={`${range.label} · ${(rows ?? []).length} feedings · total ${fmtMl(total)}`}
        right={<Link href={`/babies/${params.babyId}/feedings/new`}><Button variant="peach">+ Log feed</Button></Link>}
      />
      <DateRangeFilter currentKey={range.key} />

      <div className="space-y-2">
        {(rows ?? []).length === 0 && <EmptyState message="No feedings in this time window." />}
        {rows?.map(r => (
          <TimelineRow
            key={r.id}
            href={`/babies/${params.babyId}/feedings/${r.id}`}
            icon={Milk}
            tint="peach"
            title={`${fmtMl(r.quantity_ml)} · ${r.milk_type}${r.kcal ? ` · ${r.kcal} kcal` : ''}`}
            subtitle={r.source !== 'manual' ? `entered via ${r.source}` : 'manual entry'}
            time={r.feeding_time}
          />
        ))}
      </div>
    </PageShell>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-ink-muted">
      {message}
    </div>
  );
}

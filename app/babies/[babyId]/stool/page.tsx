import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { TimelineRow } from '@/components/TimelineRow';
import { parseRangeParam } from '@/lib/dates';
import { fmtMl } from '@/lib/units';
import { Droplet } from 'lucide-react';

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
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Stool & diaper"
        eyebrowTint="mint"
        title="Stool logs"
        subtitle={`${range.label} · ${(rows ?? []).length} logs`}
        right={<Link href={`/babies/${params.babyId}/stool/new`}><Button variant="mint">+ Log stool</Button></Link>}
      />
      <DateRangeFilter currentKey={range.key} />

      <div className="space-y-2">
        {(rows ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-ink-muted">
            No stool logs in this time window.
          </div>
        )}
        {rows?.map(r => {
          const details = [r.quantity_category ?? 'stool',
            r.quantity_ml ? fmtMl(r.quantity_ml) : null,
            r.color ?? null,
            r.consistency ?? null].filter(Boolean).join(' · ');
          return (
            <TimelineRow
              key={r.id}
              href={`/babies/${params.babyId}/stool/${r.id}`}
              icon={Droplet}
              tint="mint"
              title={details}
              subtitle={r.source !== 'manual' ? `entered via ${r.source}` : 'manual entry'}
              time={r.stool_time}
            />
          );
        })}
      </div>
    </PageShell>
  );
}

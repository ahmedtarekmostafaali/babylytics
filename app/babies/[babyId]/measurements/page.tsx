import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/Button';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { TimelineRow } from '@/components/TimelineRow';
import { fmtCm, fmtKg } from '@/lib/units';
import { Scale } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MeasurementsList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const { data: rows } = await supabase
    .from('measurements')
    .select('id,measured_at,weight_kg,height_cm,head_circ_cm,source')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('measured_at', { ascending: false }).limit(200);

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Growth"
        eyebrowTint="brand"
        title="Measurements"
        subtitle={`${(rows ?? []).length} measurements recorded`}
        right={<Link href={`/babies/${params.babyId}/measurements/new`}><Button>+ Log measurement</Button></Link>}
      />

      <div className="space-y-2">
        {(rows ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-ink-muted">
            No measurements yet.
          </div>
        )}
        {rows?.map(r => {
          const parts = [
            r.weight_kg  ? fmtKg(r.weight_kg) : null,
            r.height_cm  ? fmtCm(r.height_cm) : null,
            r.head_circ_cm ? `head ${fmtCm(r.head_circ_cm)}` : null,
          ].filter(Boolean).join(' · ');
          return (
            <TimelineRow
              key={r.id}
              href={`/babies/${params.babyId}/measurements/${r.id}`}
              icon={Scale}
              tint="brand"
              title={parts || 'measurement'}
              subtitle={r.source !== 'manual' ? `entered via ${r.source}` : 'manual entry'}
              time={r.measured_at}
            />
          );
        })}
      </div>
    </PageShell>
  );
}

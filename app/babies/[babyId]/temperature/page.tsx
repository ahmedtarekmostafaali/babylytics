import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fmtDateTime, fmtRelative } from '@/lib/dates';
import { Thermometer } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Temperature' };

export default async function TemperatureList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const { data: rows } = await supabase
    .from('temperature_logs')
    .select('id,measured_at,temperature_c,method,notes,source')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('measured_at', { ascending: false }).limit(200);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Temperature" eyebrowTint="coral" title="Temperature readings"
        subtitle={`${(rows ?? []).length} readings recorded`}
        right={<Link href={`/babies/${params.babyId}/temperature/new`}><Button variant="primary">+ Log reading</Button></Link>} />

      <div className="space-y-2">
        {(rows ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-ink-muted">
            No readings yet.
          </div>
        )}
        {rows?.map(r => {
          const t = Number(r.temperature_c);
          const tint = t >= 38 ? 'coral' : t >= 37.5 ? 'peach' : t < 36 ? 'brand' : 'mint';
          const tintBg = { coral: 'bg-coral-50', peach: 'bg-peach-50', mint: 'bg-mint-50', brand: 'bg-brand-50' }[tint];
          const dot = { coral: 'bg-coral-500', peach: 'bg-peach-500', mint: 'bg-mint-500', brand: 'bg-brand-500' }[tint];
          return (
            <Link key={r.id} href={`/babies/${params.babyId}/temperature/${r.id}`}
              className={`flex items-center gap-4 rounded-2xl p-4 transition ${tintBg} hover:shadow-panel`}>
              <span className="h-11 w-11 rounded-xl bg-white shadow-sm grid place-items-center shrink-0">
                <Thermometer className={`h-5 w-5 ${dot.replace('bg-','text-')}`} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-ink-strong text-xl">{t.toFixed(1)} °C</span>
                  <span className="text-xs text-ink-muted">· {r.method}</span>
                </span>
                {r.notes && <span className="block text-xs text-ink-muted truncate">{r.notes}</span>}
              </span>
              <span className="text-xs text-ink-muted whitespace-nowrap">{fmtRelative(r.measured_at)}</span>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

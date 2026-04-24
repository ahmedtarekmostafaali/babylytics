import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { TimelineRow } from '@/components/TimelineRow';
import { fmtDateTime } from '@/lib/dates';
import { Pill } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MedicationsList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const [{ data: meds }, { data: logs }] = await Promise.all([
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('medication_logs')
      .select('id,medication_id,medication_time,status,actual_dosage,source')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('medication_time', { ascending: false }).limit(50),
  ]);

  const medName = (id: string) => meds?.find(m => m.id === id)?.name ?? '—';

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Medications"
        eyebrowTint="lavender"
        title="Prescriptions & doses"
        subtitle={`${(meds ?? []).length} medication${(meds ?? []).length === 1 ? '' : 's'} · ${(logs ?? []).length} recent doses`}
        right={
          <div className="flex gap-2">
            <Link href={`/babies/${params.babyId}/medications/new`}><Button variant="secondary">+ Medication</Button></Link>
            <Link href={`/babies/${params.babyId}/medications/log`}><Button variant="lavender">+ Log dose</Button></Link>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(meds ?? []).length === 0 && <p className="text-ink-muted text-sm">No medications yet.</p>}
          {meds?.map(m => {
            const active = !m.ends_at || new Date(m.ends_at).getTime() > Date.now();
            return (
              <Link
                key={m.id}
                href={`/babies/${params.babyId}/medications/${m.id}`}
                className="flex items-center gap-4 rounded-2xl p-3 sm:p-4 bg-lavender-50/70 hover:bg-lavender-100/70 border border-transparent hover:border-slate-200/80 transition-colors"
              >
                <span className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                  <Pill className="h-5 w-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink-strong truncate">
                    {m.name}{m.dosage ? ` · ${m.dosage}` : ''}{m.route !== 'oral' ? ` · ${m.route}` : ''}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    every {m.frequency_hours ?? '—'}h · {fmtDateTime(m.starts_at)}{m.ends_at ? ` → ${fmtDateTime(m.ends_at)}` : ''}
                    {m.prescribed_by ? ` · ${m.prescribed_by}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${active ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-ink-muted'}`}>
                  {active ? 'Active' : 'Ended'}
                </span>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent doses</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(logs ?? []).length === 0 && <p className="text-ink-muted text-sm">No doses logged yet.</p>}
          {logs?.map(l => (
            <TimelineRow
              key={l.id}
              href={`/babies/${params.babyId}/medications/log/${l.id}`}
              icon={Pill}
              tint="lavender"
              title={`${medName(l.medication_id)} · ${l.status}${l.actual_dosage ? ` · ${l.actual_dosage}` : ''}`}
              subtitle={l.source !== 'manual' ? `entered via ${l.source}` : 'manual entry'}
              time={l.medication_time}
            />
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

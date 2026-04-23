import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fmtDateTime } from '@/lib/dates';

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
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← {baby.name}</Link>
            <h1 className="text-xl font-semibold mt-1">Medications</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/babies/${params.babyId}/medications/new`}><Button variant="secondary">Add medication</Button></Link>
            <Link href={`/babies/${params.babyId}/medications/log`}><Button>Log dose</Button></Link>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {(meds ?? []).length === 0 && <p className="text-slate-500">No medications yet.</p>}
            {meds?.map(m => (
              <Link key={m.id} href={`/babies/${params.babyId}/medications/${m.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{m.name}{m.dosage ? ` · ${m.dosage}` : ''}{m.route !== 'oral' ? ` · ${m.route}` : ''}</div>
                  <div className="text-xs text-slate-500">
                    every {m.frequency_hours ?? '—'}h · {fmtDateTime(m.starts_at)}{m.ends_at ? ` → ${fmtDateTime(m.ends_at)}` : ''}
                    {m.prescribed_by ? ` · ${m.prescribed_by}` : ''}
                  </div>
                </div>
                <span className="text-xs text-slate-400">edit</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent doses</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {(logs ?? []).length === 0 && <p className="text-slate-500">No doses logged yet.</p>}
            {logs?.map(l => (
              <Link key={l.id} href={`/babies/${params.babyId}/medications/log/${l.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{medName(l.medication_id)} · {l.status}{l.actual_dosage ? ` · ${l.actual_dosage}` : ''}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(l.medication_time)}{l.source !== 'manual' ? ` · ${l.source}` : ''}</div>
                </div>
                <span className="text-xs text-slate-400">edit</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

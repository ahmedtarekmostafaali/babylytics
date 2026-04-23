import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fmtDateTime } from '@/lib/dates';
import { fmtCm, fmtKg } from '@/lib/units';

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
    <div>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← {baby.name}</Link>
            <h1 className="text-xl font-semibold mt-1">Measurements</h1>
          </div>
          <Link href={`/babies/${params.babyId}/measurements/new`}><Button>Log measurement</Button></Link>
        </div>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {(rows ?? []).length === 0 && <p className="text-slate-500">No measurements yet.</p>}
            {rows?.map(r => (
              <Link key={r.id} href={`/babies/${params.babyId}/measurements/${r.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{fmtKg(r.weight_kg)} · {fmtCm(r.height_cm)} · head {fmtCm(r.head_circ_cm)}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(r.measured_at)}{r.source !== 'manual' ? ` · ${r.source}` : ''}</div>
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

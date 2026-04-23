import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fmtDateTime } from '@/lib/dates';
import { fmtMl } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function StoolList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const { data: rows } = await supabase
    .from('stool_logs')
    .select('id,stool_time,quantity_category,quantity_ml,color,consistency,source')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('stool_time', { ascending: false }).limit(200);
  return (
    <div>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← {baby.name}</Link>
            <h1 className="text-xl font-semibold mt-1">Stool logs</h1>
          </div>
          <Link href={`/babies/${params.babyId}/stool/new`}><Button>Log stool</Button></Link>
        </div>
        <Card>
          <CardHeader><CardTitle>Last 200 stool logs</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {(rows ?? []).length === 0 && <p className="text-slate-500">No stool logs yet.</p>}
            {rows?.map(r => (
              <Link key={r.id} href={`/babies/${params.babyId}/stool/${r.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                <div>
                  <div className="font-medium">{r.quantity_category ?? 'stool'}{r.quantity_ml ? ` · ${fmtMl(r.quantity_ml)}` : ''}{r.color ? ` · ${r.color}` : ''}</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(r.stool_time)}{r.source !== 'manual' ? ` · ${r.source}` : ''}</div>
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

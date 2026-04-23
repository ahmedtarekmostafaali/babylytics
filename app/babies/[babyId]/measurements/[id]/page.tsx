import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MeasurementForm } from '@/components/forms/MeasurementForm';

export const dynamic = 'force-dynamic';

export default async function EditMeasurement({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('measurements')
    .select('id,baby_id,measured_at,weight_kg,height_cm,head_circ_cm,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Edit measurement</CardTitle></CardHeader>
          <CardContent>
            <MeasurementForm babyId={params.babyId} initial={{
              id: data.id, baby_id: data.baby_id,
              measured_at: data.measured_at,
              weight_kg: data.weight_kg, height_cm: data.height_cm,
              head_circ_cm: data.head_circ_cm, notes: data.notes,
            }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

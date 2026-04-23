import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MedicationLogForm } from '@/components/forms/MedicationLogForm';

export const dynamic = 'force-dynamic';

export default async function EditMedLog({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('medication_logs')
    .select('id,baby_id,medication_id,medication_time,status,actual_dosage,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}/medications`} className="text-sm text-slate-500 hover:underline">← medications</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Edit dose log</CardTitle></CardHeader>
          <CardContent>
            <MedicationLogForm babyId={params.babyId} initial={{
              id: data.id, baby_id: data.baby_id,
              medication_id: data.medication_id,
              medication_time: data.medication_time,
              status: data.status as 'taken',
              actual_dosage: data.actual_dosage, notes: data.notes,
            }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

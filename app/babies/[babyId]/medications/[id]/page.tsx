import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MedicationForm } from '@/components/forms/MedicationForm';

export const dynamic = 'force-dynamic';

export default async function EditMedication({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('medications')
    .select('id,baby_id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}/medications`} className="text-sm text-slate-500 hover:underline">← medications</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Edit medication</CardTitle></CardHeader>
          <CardContent>
            <MedicationForm babyId={params.babyId} initial={{
              id: data.id, baby_id: data.baby_id,
              name: data.name, dosage: data.dosage,
              route: data.route as 'oral',
              frequency_hours: data.frequency_hours,
              total_doses: data.total_doses,
              starts_at: data.starts_at, ends_at: data.ends_at,
              prescribed_by: data.prescribed_by, notes: data.notes,
            }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

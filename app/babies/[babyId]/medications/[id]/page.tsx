import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/Card';
import { MedicationForm } from '@/components/forms/MedicationForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditMedication({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const [{ data }, { data: docs }] = await Promise.all([
    supabase.from('medications')
      .select('id,baby_id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,doctor_id,prescribed_by,notes')
      .eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('doctors')
      .select('id,name,specialty')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  if (!data) notFound();
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medications`} backLabel="medications"
        eyebrow="Edit medication" eyebrowTint="lavender" title={data.name} />
      <Card><CardContent className="py-6">
        <MedicationForm babyId={params.babyId}
          doctors={(docs ?? []) as { id: string; name: string; specialty: string | null }[]}
          initial={{
            id: data.id, baby_id: data.baby_id,
            name: data.name, dosage: data.dosage,
            route: data.route as 'oral',
            frequency_hours: data.frequency_hours,
            total_doses: data.total_doses,
            starts_at: data.starts_at, ends_at: data.ends_at,
            doctor_id: data.doctor_id,
            prescribed_by: data.prescribed_by, notes: data.notes,
          }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="medications" targetId={data.id} />
    </PageShell>
  );
}

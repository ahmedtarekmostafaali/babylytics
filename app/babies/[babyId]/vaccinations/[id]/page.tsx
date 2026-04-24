import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/Card';
import { VaccinationForm } from '@/components/forms/VaccinationForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditVaccination({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('vaccinations')
    .select('id,baby_id,vaccine_name,scheduled_at,administered_at,dose_number,total_doses,batch_number,provider,notes,status')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/vaccinations`} backLabel="vaccinations"
        eyebrow="Edit" eyebrowTint="lavender" title={data.vaccine_name} />
      <Card><CardContent className="py-6">
        <VaccinationForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          vaccine_name: data.vaccine_name,
          scheduled_at: data.scheduled_at, administered_at: data.administered_at,
          dose_number: data.dose_number, total_doses: data.total_doses,
          batch_number: data.batch_number, provider: data.provider,
          notes: data.notes, status: data.status as 'scheduled',
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="vaccinations" targetId={data.id} />
    </PageShell>
  );
}

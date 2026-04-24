import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { MeasurementForm } from '@/components/forms/MeasurementForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditMeasurement({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('measurements')
    .select('id,baby_id,measured_at,weight_kg,height_cm,head_circ_cm,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/measurements`} backLabel="measurements"
        eyebrow="Edit measurement" eyebrowTint="brand" title="Adjust this measurement" />
      <Card><CardContent className="py-6">
        <MeasurementForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          measured_at: data.measured_at,
          weight_kg: data.weight_kg, height_cm: data.height_cm,
          head_circ_cm: data.head_circ_cm, notes: data.notes,
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="measurements" targetId={data.id} />
    </PageShell>
  );
}

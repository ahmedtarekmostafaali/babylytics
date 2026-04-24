import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { TemperatureForm } from '@/components/forms/TemperatureForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditTemperature({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('temperature_logs')
    .select('id,baby_id,measured_at,temperature_c,method,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/temperature`} backLabel="temperature readings"
        eyebrow="Edit" eyebrowTint="coral" title="Adjust this reading" />
      <Card><CardContent className="py-6">
        <TemperatureForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          measured_at: data.measured_at,
          temperature_c: Number(data.temperature_c),
          method: data.method as 'axillary',
          notes: data.notes,
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="temperature_logs" targetId={data.id} />
    </PageShell>
  );
}

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { MedicationLogForm } from '@/components/forms/MedicationLogForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditMedLog({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('medication_logs')
    .select('id,baby_id,medication_id,medication_time,status,actual_dosage,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medications`} backLabel="medications"
        eyebrow="Edit dose" eyebrowTint="lavender" title="Adjust this dose" />
      <Card><CardContent className="py-6">
        <MedicationLogForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          medication_id: data.medication_id,
          medication_time: data.medication_time,
          status: data.status as 'taken',
          actual_dosage: data.actual_dosage, notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

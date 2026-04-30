import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { CycleForm } from '@/components/forms/CycleForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditCycle({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('menstrual_cycles')
    .select('id,baby_id,period_start,period_end,cycle_length,flow_intensity,symptoms,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/planner`}
        backLabel="planner"
        eyebrow="Edit"
        eyebrowTint="coral"
        title="Edit cycle"
        subtitle="Edits keep the original date in the audit trail."
      />
      <Card><CardContent className="py-6">
        <CycleForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          period_start: data.period_start, period_end: data.period_end,
          cycle_length: data.cycle_length, flow_intensity: data.flow_intensity,
          symptoms: data.symptoms, notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

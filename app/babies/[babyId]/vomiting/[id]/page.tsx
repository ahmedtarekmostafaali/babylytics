import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { VomitingForm } from '@/components/forms/VomitingForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditVomiting({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('vomiting_logs')
    .select('id,baby_id,vomited_at,severity,content_type,triggered_by,related_food,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/vomiting`}
        backLabel="vomiting"
        eyebrow="Edit"
        eyebrowTint="coral"
        title="Adjust this episode"
        subtitle="Edits keep the original details in the audit trail."
      />
      <Card><CardContent className="py-6">
        <VomitingForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          vomited_at: data.vomited_at,
          severity: data.severity, content_type: data.content_type,
          triggered_by: data.triggered_by, related_food: data.related_food,
          notes: data.notes,
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="vomiting_logs" targetId={data.id} />
    </PageShell>
  );
}

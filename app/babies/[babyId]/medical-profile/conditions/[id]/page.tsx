import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ConditionForm } from '@/components/forms/ConditionForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditCondition({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  const { data } = await supabase.from('medical_conditions')
    .select('*').eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Edit" eyebrowTint="brand" title="Medical condition" />
      <Card><CardContent className="py-6">
        <ConditionForm babyId={params.babyId} initial={{
          id: data.id, name: data.name, icd_code: data.icd_code, diagnosed_at: data.diagnosed_at,
          status: data.status as 'active'|'resolved'|'chronic'|'suspected',
          treatment: data.treatment, notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

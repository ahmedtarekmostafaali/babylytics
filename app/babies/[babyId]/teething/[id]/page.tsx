import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeethingForm } from '@/components/forms/TeethingForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditTeething({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/teething`);

  const { data } = await supabase.from('teething_logs').select('*')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/teething`} backLabel="Teething"
        eyebrow="Edit" eyebrowTint="peach" title="Teething event" />
      <Card><CardContent className="py-6">
        <TeethingForm babyId={params.babyId} initial={{
          id: data.id, observed_at: data.observed_at,
          tooth_label: data.tooth_label,
          event_type: data.event_type as 'eruption'|'swelling'|'pain'|'fever'|'soothing'|'lost',
          pain_level: data.pain_level,
          fever_c: data.fever_c,
          soother_used: data.soother_used,
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

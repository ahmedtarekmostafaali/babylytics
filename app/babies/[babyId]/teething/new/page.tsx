import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeethingForm } from '@/components/forms/TeethingForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewTeething({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/teething`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/teething`} backLabel="Teething"
        eyebrow="Log" eyebrowTint="peach" title="Teething event" />
      <Card><CardContent className="py-6">
        <TeethingForm babyId={params.babyId} initial={{ observed_at: new Date().toISOString(), event_type: 'eruption' }} />
      </CardContent></Card>
    </PageShell>
  );
}

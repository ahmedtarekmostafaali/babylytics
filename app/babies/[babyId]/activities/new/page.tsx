import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ActivityForm } from '@/components/forms/ActivityForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewActivity({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/activities`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/activities`} backLabel="Activities"
        eyebrow="Log" eyebrowTint="mint" title="Activity" />
      <Card><CardContent className="py-6">
        <ActivityForm babyId={params.babyId} initial={{ started_at: new Date().toISOString(), activity_type: '' }} />
      </CardContent></Card>
    </PageShell>
  );
}

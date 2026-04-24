import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdmissionForm } from '@/components/forms/AdmissionForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewAdmission({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Add" eyebrowTint="lavender" title="Hospital admission" />
      <Card><CardContent className="py-6">
        <AdmissionForm babyId={params.babyId} />
      </CardContent></Card>
    </PageShell>
  );
}

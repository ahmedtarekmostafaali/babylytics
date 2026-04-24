import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AllergyForm } from '@/components/forms/AllergyForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewAllergy({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Add" eyebrowTint="coral" title="Allergy" />
      <Card><CardContent className="py-6">
        <AllergyForm babyId={params.babyId} initial={{ allergen: '', severity: 'mild', status: 'active' }} />
      </CardContent></Card>
    </PageShell>
  );
}

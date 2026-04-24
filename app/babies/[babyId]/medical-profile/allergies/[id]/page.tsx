import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AllergyForm } from '@/components/forms/AllergyForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditAllergy({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  const { data } = await supabase.from('allergies')
    .select('*').eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Edit" eyebrowTint="coral" title="Allergy" />
      <Card><CardContent className="py-6">
        <AllergyForm babyId={params.babyId} initial={{
          id: data.id, allergen: data.allergen, category: data.category as 'food'|'drug'|'environmental'|'contact'|'latex'|'other'|null,
          reaction: data.reaction, severity: data.severity as 'mild'|'moderate'|'severe'|'life_threatening',
          diagnosed_at: data.diagnosed_at, status: data.status as 'active'|'resolved'|'suspected', notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PregnancyProfileForm } from '@/components/forms/PregnancyProfileForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function PregnancyProfilePage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}`);

  const { data } = await supabase.from('pregnancy_profile')
    .select('*').eq('baby_id', params.babyId).maybeSingle();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Settings" eyebrowTint="lavender" title="Pregnancy profile"
        subtitle="Maternal info that helps the dashboard contextualize trends." />
      <Card><CardContent className="py-6">
        <PregnancyProfileForm babyId={params.babyId}
          initial={data ? {
            mother_dob: data.mother_dob,
            mother_blood_type: data.mother_blood_type,
            gravida: data.gravida, para: data.para,
            pre_pregnancy_weight_kg: data.pre_pregnancy_weight_kg,
            pre_pregnancy_height_cm: data.pre_pregnancy_height_cm,
            risk_factors: data.risk_factors, notes: data.notes,
          } : undefined} />
      </CardContent></Card>
    </PageShell>
  );
}

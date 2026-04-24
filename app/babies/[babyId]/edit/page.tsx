import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/Card';
import { BabyEditForm, type BabyEditValue } from '@/components/forms/BabyEditForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditBabyPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,birth_height_cm,feeding_factor_ml_per_kg_per_day,notes')
    .eq('id', params.babyId)
    .is('deleted_at', null)
    .single();
  if (!baby) notFound();

  const [{ data: membership }, { data: currentWeight }] = await Promise.all([
    supabase.from('baby_users')
      .select('role')
      .eq('baby_id', params.babyId)
      .eq('user_id', user?.id ?? '')
      .single(),
    supabase.rpc('current_weight_kg', { p_baby: params.babyId }),
  ]);

  const canDelete = membership?.role === 'owner';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Profile" eyebrowTint="brand" title="Edit baby profile"
        subtitle="Name, date of birth, birth stats, and feeding factor." />
      <Card><CardContent className="py-6">
        <BabyEditForm
          baby={baby as BabyEditValue}
          currentWeightKg={currentWeight as number | null}
          canDelete={canDelete}
        />
      </CardContent></Card>
    </PageShell>
  );
}

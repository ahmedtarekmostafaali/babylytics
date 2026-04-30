import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { FeedingForm } from '@/components/forms/FeedingForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditFeeding({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('feedings')
    .select('id,baby_id,feeding_time,milk_type,quantity_ml,kcal,duration_min,notes,formula_name,food_name,food_symptoms,post_feed_effect')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/feedings`}
        backLabel="feedings"
        eyebrow="Edit feeding"
        eyebrowTint="peach"
        title="Adjust this feeding"
        subtitle="Edit any value — we keep a quiet history of the change behind the scenes."
      />
      <Card><CardContent className="py-6">
        <FeedingForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          feeding_time: data.feeding_time,
          milk_type: data.milk_type as 'formula',
          quantity_ml: data.quantity_ml, kcal: data.kcal,
          duration_min: data.duration_min, notes: data.notes,
          formula_name: data.formula_name ?? null,
          food_name: data.food_name ?? null,
          food_symptoms: data.food_symptoms ?? null,
          post_feed_effect: data.post_feed_effect ?? null,
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="feedings" targetId={data.id} />
    </PageShell>
  );
}

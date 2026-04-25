import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrenatalVisitForm } from '@/components/forms/PrenatalVisitForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditVisit({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/prenatal/visits`);

  const [{ data }, { data: doctors }] = await Promise.all([
    supabase.from('prenatal_visits').select('*').eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('doctors').select('id,name,specialty')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false }),
  ]);
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/prenatal/visits`} backLabel="Visits"
        eyebrow="Edit" eyebrowTint="lavender" title="Prenatal visit" />
      <Card><CardContent className="py-6">
        <PrenatalVisitForm babyId={params.babyId}
          doctors={(doctors ?? []) as { id: string; name: string; specialty: string | null }[]}
          initial={{
            id: data.id, visited_at: data.visited_at,
            gestational_week: data.gestational_week, gestational_day: data.gestational_day,
            maternal_weight_kg: data.maternal_weight_kg,
            bp_systolic: data.bp_systolic, bp_diastolic: data.bp_diastolic,
            fetal_heart_rate_bpm: data.fetal_heart_rate_bpm, fundal_height_cm: data.fundal_height_cm,
            doctor_id: data.doctor_id, file_id: data.file_id, notes: data.notes,
          }} />
      </CardContent></Card>
    </PageShell>
  );
}

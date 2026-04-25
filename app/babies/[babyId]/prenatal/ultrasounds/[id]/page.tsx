import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UltrasoundForm } from '@/components/forms/UltrasoundForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditUltrasound({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/prenatal/ultrasounds`);

  const { data } = await supabase.from('ultrasounds').select('*')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/prenatal/ultrasounds`} backLabel="Ultrasounds"
        eyebrow="Edit" eyebrowTint="brand" title="Ultrasound" />
      <Card><CardContent className="py-6">
        <UltrasoundForm babyId={params.babyId} initial={{
          id: data.id, scanned_at: data.scanned_at,
          gestational_week: data.gestational_week, gestational_day: data.gestational_day,
          bpd_mm: data.bpd_mm, hc_mm: data.hc_mm, ac_mm: data.ac_mm, fl_mm: data.fl_mm,
          efw_g: data.efw_g, fhr_bpm: data.fhr_bpm,
          placenta_position: data.placenta_position, amniotic_fluid: data.amniotic_fluid,
          sex_predicted: data.sex_predicted as 'male'|'female'|'undetermined'|null,
          anomalies: data.anomalies, summary: data.summary, file_id: data.file_id,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

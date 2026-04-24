import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DischargeForm } from '@/components/forms/DischargeForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditDischarge({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  const [{ data }, { data: admissions }] = await Promise.all([
    supabase.from('discharges').select('*').eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('admissions').select('id,admitted_at,hospital,reason')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('admitted_at', { ascending: false }),
  ]);
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Edit" eyebrowTint="mint" title="Hospital discharge" />
      <Card><CardContent className="py-6">
        <DischargeForm babyId={params.babyId}
          admissions={(admissions ?? []) as { id: string; admitted_at: string; hospital: string | null; reason: string | null }[]}
          initial={{
            id: data.id, discharged_at: data.discharged_at, admission_id: data.admission_id,
            hospital: data.hospital, diagnosis: data.diagnosis, treatment: data.treatment,
            follow_up: data.follow_up, notes: data.notes, file_id: data.file_id,
          }} />
      </CardContent></Card>
    </PageShell>
  );
}

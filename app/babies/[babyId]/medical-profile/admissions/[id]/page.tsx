import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdmissionForm } from '@/components/forms/AdmissionForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditAdmission({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  const { data } = await supabase.from('admissions')
    .select('*').eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Edit" eyebrowTint="lavender" title="Hospital admission" />
      <Card><CardContent className="py-6">
        <AdmissionForm babyId={params.babyId} initial={{
          id: data.id, admitted_at: data.admitted_at,
          hospital: data.hospital, department: data.department,
          reason: data.reason, diagnosis: data.diagnosis, notes: data.notes,
          file_id: data.file_id,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

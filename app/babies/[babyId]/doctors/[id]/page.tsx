import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DoctorForm } from '@/components/forms/DoctorForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditDoctor({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = membership?.role as string | undefined;
  if (role !== 'owner' && role !== 'parent' && role !== 'editor') {
    redirect(`/babies/${params.babyId}`);
  }

  const { data } = await supabase.from('doctors')
    .select('id,name,specialty,clinic,phone,email,address,notes,is_primary')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/doctors`} backLabel="Doctors"
        eyebrow="Edit" eyebrowTint="lavender" title="Edit doctor" />
      <Card><CardContent className="py-6">
        <DoctorForm babyId={params.babyId} initial={{
          id: data.id, name: data.name,
          specialty: data.specialty, clinic: data.clinic, phone: data.phone,
          email: data.email, address: data.address, notes: data.notes,
          is_primary: data.is_primary,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DoctorForm } from '@/components/forms/DoctorForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add doctor' };

export default async function NewDoctor({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = membership?.role as string | undefined;
  if (role !== 'owner' && role !== 'parent' && role !== 'editor') {
    redirect(`/babies/${params.babyId}`);
  }
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/doctors`} backLabel="Doctors"
        eyebrow="Health" eyebrowTint="lavender" title="Add a doctor"
        subtitle="Pediatrician, specialist, dentist — save their contact info for one-tap booking." />
      <Card><CardContent className="py-6">
        <DoctorForm babyId={params.babyId} />
      </CardContent></Card>
    </PageShell>
  );
}

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Book appointment' };

export default async function NewAppointment({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { doctor?: string };
}) {
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

  const { data: docs } = await supabase.from('doctors')
    .select('id,name,specialty')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('is_primary', { ascending: false }).order('created_at', { ascending: false });

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/doctors`} backLabel="Doctors"
        eyebrow="Appointment" eyebrowTint="lavender" title="Book appointment"
        subtitle="Doctor visits, check-ups, vaccinations — anything with a date." />
      <Card><CardContent className="py-6">
        <AppointmentForm
          babyId={params.babyId}
          doctors={(docs ?? []) as { id: string; name: string; specialty: string | null }[]}
          initial={searchParams.doctor ? {
            doctor_id: searchParams.doctor,
            scheduled_at: new Date().toISOString(),
          } : undefined}
        />
      </CardContent></Card>
    </PageShell>
  );
}

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { Card, CardContent } from '@/components/ui/Card';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditAppointment({
  params,
}: {
  params: { babyId: string; id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = membership?.role as string | undefined;
  if (role !== 'owner' && role !== 'parent' && role !== 'editor') {
    redirect(`/babies/${params.babyId}`);
  }

  const [{ data }, { data: docs }] = await Promise.all([
    supabase.from('appointments')
      .select('id,doctor_id,scheduled_at,duration_min,purpose,location,status,notes')
      .eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('doctors').select('id,name,specialty')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false }),
  ]);
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/doctors`} backLabel="Doctors"
        eyebrow="Edit" eyebrowTint="lavender" title="Edit appointment" />
      <Card><CardContent className="py-6">
        <AppointmentForm
          babyId={params.babyId}
          doctors={(docs ?? []) as { id: string; name: string; specialty: string | null }[]}
          initial={{
            id: data.id, doctor_id: data.doctor_id, scheduled_at: data.scheduled_at,
            duration_min: data.duration_min, purpose: data.purpose, location: data.location,
            status: data.status as 'scheduled'|'completed'|'cancelled'|'missed'|'rescheduled',
            notes: data.notes,
          }}
        />
      </CardContent></Card>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        title="Notes for this appointment" scopeDate={data.scheduled_at?.slice(0, 10)} />
    </PageShell>
  );
}

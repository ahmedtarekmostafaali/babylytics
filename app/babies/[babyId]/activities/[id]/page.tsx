import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ActivityForm } from '@/components/forms/ActivityForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditActivity({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/activities`);

  const { data } = await supabase.from('activity_logs').select('*')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/activities`} backLabel="Activities"
        eyebrow="Edit" eyebrowTint="mint" title="Activity" />
      <Card><CardContent className="py-6">
        <ActivityForm babyId={params.babyId} initial={{
          id: data.id, started_at: data.started_at, duration_min: data.duration_min,
          activity_type: data.activity_type,
          intensity: data.intensity as 'low'|'moderate'|'high'|null,
          location: data.location,
          mood: data.mood as 'happy'|'calm'|'fussy'|'tired'|'curious'|'other'|null,
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

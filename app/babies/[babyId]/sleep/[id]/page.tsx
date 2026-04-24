import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { SleepForm } from '@/components/forms/SleepForm';
import { Comments } from '@/components/Comments';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditSleep({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data } = await supabase
    .from('sleep_logs')
    .select('id,baby_id,start_at,end_at,location,quality,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/sleep`} backLabel="sleep"
        eyebrow="Edit" eyebrowTint="lavender" title="Adjust sleep session" />
      <Card><CardContent className="py-6">
        <SleepForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id,
          start_at: data.start_at,
          end_at: data.end_at,
          location: data.location as 'crib',
          quality: data.quality as 'sound' | 'restless' | 'woke_often' | 'unknown' | null,
          notes: data.notes,
        }} />
      </CardContent></Card>
      <Comments babyId={params.babyId} target="sleep_logs" targetId={data.id} />
    </PageShell>
  );
}

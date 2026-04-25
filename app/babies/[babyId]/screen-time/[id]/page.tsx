import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ScreenTimeForm } from '@/components/forms/ScreenTimeForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditScreenTime({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/screen-time`);

  const { data } = await supabase.from('screen_time_logs').select('*')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/screen-time`} backLabel="Screen time"
        eyebrow="Edit" eyebrowTint="lavender" title="Screen time" />
      <Card><CardContent className="py-6">
        <ScreenTimeForm babyId={params.babyId} initial={{
          id: data.id, started_at: data.started_at, duration_min: data.duration_min,
          content_type: data.content_type as 'educational'|'entertainment'|'video_call'|'passive'|'other'|null,
          device: data.device as 'tv'|'tablet'|'phone'|'laptop'|'other'|null,
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

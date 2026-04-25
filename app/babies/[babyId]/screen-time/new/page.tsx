import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ScreenTimeForm } from '@/components/forms/ScreenTimeForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewScreenTime({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/screen-time`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/screen-time`} backLabel="Screen time"
        eyebrow="Log" eyebrowTint="lavender" title="Screen time" />
      <Card><CardContent className="py-6">
        <ScreenTimeForm babyId={params.babyId} initial={{ started_at: new Date().toISOString(), duration_min: 15 }} />
      </CardContent></Card>
    </PageShell>
  );
}

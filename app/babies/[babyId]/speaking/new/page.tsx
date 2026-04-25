import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SpeakingForm } from '@/components/forms/SpeakingForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewSpeaking({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/speaking`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/speaking`} backLabel="Speaking"
        eyebrow="Log" eyebrowTint="brand" title="New speech" />
      <Card><CardContent className="py-6">
        <SpeakingForm babyId={params.babyId} initial={{ observed_at: new Date().toISOString(), category: 'word' }} />
      </CardContent></Card>
    </PageShell>
  );
}

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SpeakingForm } from '@/components/forms/SpeakingForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditSpeaking({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') redirect(`/babies/${params.babyId}/speaking`);

  const { data } = await supabase.from('speaking_logs').select('*')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/speaking`} backLabel="Speaking"
        eyebrow="Edit" eyebrowTint="brand" title="Edit speech" />
      <Card><CardContent className="py-6">
        <SpeakingForm babyId={params.babyId} initial={{
          id: data.id, observed_at: data.observed_at,
          word_or_phrase: data.word_or_phrase,
          category: data.category as 'coo'|'babble'|'word'|'phrase'|'sentence'|'other',
          language: data.language,
          is_first_use: data.is_first_use,
          context: data.context,
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

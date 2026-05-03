import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { AppleHealthImporter } from '@/components/AppleHealthImporter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import from Apple Health' };

export default async function AppleHealthImportPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Parent/owner only — import_menstrual_cycles RPC enforces this server-
  // side too, but bouncing here saves a confusing client-side error.
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user.id).maybeSingle();
  if (!['owner','parent','editor'].includes(m?.role as string)) redirect(`/babies/${params.babyId}`);

  const { data: baby } = await supabase.from('babies')
    .select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/planner`} backLabel="My cycle"
        eyebrow="IMPORT" eyebrowTint="coral"
        title="Apple Health"
        subtitle="Drop your export.zip — your data is parsed locally in your browser. Only the cycle entries leave your device." />
      <AppleHealthImporter babyId={params.babyId} />
    </PageShell>
  );
}

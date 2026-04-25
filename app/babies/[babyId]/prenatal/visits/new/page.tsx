import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrenatalVisitForm } from '@/components/forms/PrenatalVisitForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewVisit({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/prenatal/visits`);

  const { data: doctors } = await supabase.from('doctors').select('id,name,specialty')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('is_primary', { ascending: false });

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/prenatal/visits`} backLabel="Visits"
        eyebrow="Add" eyebrowTint="lavender" title="Prenatal visit" />
      <Card><CardContent className="py-6">
        <PrenatalVisitForm babyId={params.babyId}
          doctors={(doctors ?? []) as { id: string; name: string; specialty: string | null }[]} />
      </CardContent></Card>
    </PageShell>
  );
}

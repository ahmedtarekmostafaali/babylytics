import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VitalSignsForm } from '@/components/forms/VitalSignsForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function NewVitals({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/vitals`);

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/vitals`} backLabel={t('vitals.back_label')}
        eyebrow={t('vitals.eyebrow_add')} eyebrowTint="coral" title={t('vitals.add_title')} />
      <Card><CardContent className="py-6">
        <VitalSignsForm babyId={params.babyId} />
      </CardContent></Card>
    </PageShell>
  );
}

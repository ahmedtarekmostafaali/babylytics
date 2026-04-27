import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SymptomForm } from '@/components/forms/SymptomForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditSymptom({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/prenatal/symptoms`);

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data } = await supabase.from('maternal_symptoms')
    .select('id,baby_id,logged_at,kind,severity,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/prenatal/symptoms`} backLabel={t('symptoms.back_label')}
        eyebrow={t('symptoms.eyebrow_edit')} eyebrowTint="lavender" title={t('symptoms.edit_title')} />
      <Card><CardContent className="py-6">
        <SymptomForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id, logged_at: data.logged_at,
          kind: data.kind, severity: data.severity, notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

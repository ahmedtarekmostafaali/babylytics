import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BloodSugarForm } from '@/components/forms/BloodSugarForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditBloodSugar({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/blood-sugar`);

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data } = await supabase.from('blood_sugar_logs')
    .select('id,baby_id,measured_at,value_mgdl,meal_context,method,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/blood-sugar`} backLabel={t('bs.back_label')}
        eyebrow={t('bs.eyebrow_edit')} eyebrowTint="coral" title={t('bs.edit_title')} />
      <Card><CardContent className="py-6">
        <BloodSugarForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id, measured_at: data.measured_at,
          value_mgdl: data.value_mgdl != null ? Number(data.value_mgdl) : null,
          meal_context: data.meal_context, method: data.method ?? 'finger_stick',
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VitalSignsForm } from '@/components/forms/VitalSignsForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function EditVitals({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/vitals`);

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data } = await supabase.from('vital_signs_logs')
    .select('id,baby_id,measured_at,bp_systolic,bp_diastolic,heart_rate_bpm,oxygen_pct,position,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/vitals`} backLabel={t('vitals.back_label')}
        eyebrow={t('vitals.eyebrow_edit')} eyebrowTint="coral" title={t('vitals.edit_title')} />
      <Card><CardContent className="py-6">
        <VitalSignsForm babyId={params.babyId} initial={{
          id: data.id, baby_id: data.baby_id, measured_at: data.measured_at,
          bp_systolic: data.bp_systolic, bp_diastolic: data.bp_diastolic,
          heart_rate_bpm: data.heart_rate_bpm,
          oxygen_pct: data.oxygen_pct != null ? Number(data.oxygen_pct) : null,
          position: data.position ?? 'sitting',
          notes: data.notes,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

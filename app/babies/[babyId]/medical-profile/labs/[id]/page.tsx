import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LabPanelForm } from '@/components/forms/LabPanelForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditLab({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  const [{ data }, { data: items }] = await Promise.all([
    supabase.from('lab_panels').select('*').eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('lab_panel_items').select('*').eq('panel_id', params.id),
  ]);
  if (!data) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Edit" eyebrowTint="peach" title="Lab / analysis result" />
      <Card><CardContent className="py-6">
        <LabPanelForm babyId={params.babyId}
          initial={{
            id: data.id, panel_kind: data.panel_kind as 'blood'|'urine'|'stool'|'culture'|'imaging'|'genetic'|'other',
            panel_name: data.panel_name, sample_at: data.sample_at, result_at: data.result_at,
            lab_name: data.lab_name, summary: data.summary, abnormal: data.abnormal,
            file_id: data.file_id, notes: data.notes,
          }}
          initialItems={(items ?? []).map((it: { id: string; test_name: string; value: string | null; unit: string | null; reference: string | null; is_abnormal: boolean; flag: string | null }) => ({
            id: it.id, test_name: it.test_name, value: it.value, unit: it.unit,
            reference: it.reference, is_abnormal: it.is_abnormal,
            flag: it.flag as 'low'|'high'|'critical'|'positive'|'negative'|null,
          }))} />
      </CardContent></Card>
    </PageShell>
  );
}

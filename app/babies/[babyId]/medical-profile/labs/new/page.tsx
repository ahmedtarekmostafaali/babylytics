import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LabPanelForm } from '@/components/forms/LabPanelForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { SmartScanUploader } from '@/components/SmartScanUploader';
import { FlaskConical } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewLab({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}/medical-profile`);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/medical-profile`} backLabel="Medical profile"
        eyebrow="Add" eyebrowTint="peach" title="Lab / analysis result" />
      <Card><CardContent className="py-6">
        <LabPanelForm babyId={params.babyId} />
      </CardContent></Card>

      {/* Optional file attachment via Smart Scan */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-peach-600" />
          <h3 className="text-sm font-bold text-ink-strong">Attach the original report</h3>
          <span className="text-[11px] text-ink-muted">OCR-friendly or just archive</span>
        </div>
        <div className="p-4 grid gap-4 md:grid-cols-2">
          <SmartScanUploader babyId={params.babyId} mode="ocr" />
          <SmartScanUploader babyId={params.babyId} mode="archive" />
        </div>
      </section>
    </PageShell>
  );
}

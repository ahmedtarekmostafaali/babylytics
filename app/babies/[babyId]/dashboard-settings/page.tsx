import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { DashboardSettingsForm } from '@/components/DashboardSettingsForm';
import { SlidersHorizontal } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard preferences' };

export default async function DashboardSettings({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, {});

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? '';

  const { data: rows } = await supabase.from('dashboard_preferences')
    .select('scope,hidden_widgets')
    .eq('user_id', userId)
    .eq('baby_id', params.babyId);

  const initialHidden: Record<'overview'|'daily_report'|'full_report', string[]> = {
    overview: [], daily_report: [], full_report: [],
  };
  for (const r of (rows ?? []) as { scope: 'overview'|'daily_report'|'full_report'; hidden_widgets: string[] }[]) {
    initialHidden[r.scope] = r.hidden_widgets;
  }

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Settings" eyebrowTint="brand" title="Dashboard preferences"
        subtitle="Choose which KPIs and sections show on the overview and reports. Per-user — each caregiver can pick their own view." />

      <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-mint-50 border border-brand-200 p-4 flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-brand-500 text-white grid place-items-center shrink-0">
          <SlidersHorizontal className="h-4 w-4" />
        </span>
        <div className="text-sm">
          <div className="font-semibold text-ink-strong">Customize your view</div>
          <p className="text-xs text-ink-muted mt-0.5">
            Toggle off anything you don&apos;t need. Hidden widgets stay in the database — toggling back shows them again immediately.
          </p>
        </div>
      </div>

      <Card><CardContent className="py-6">
        <DashboardSettingsForm babyId={params.babyId} initialHidden={initialHidden} />
      </CardContent></Card>
    </PageShell>
  );
}

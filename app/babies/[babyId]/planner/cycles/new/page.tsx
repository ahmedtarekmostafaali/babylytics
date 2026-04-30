import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { CycleForm } from '@/components/forms/CycleForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewCycle({ params }: { params: { babyId: string } }) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/planner`}
        backLabel="planner"
        eyebrow="Log"
        eyebrowTint="coral"
        title="Log your period"
        subtitle="Even one cycle unlocks the fertile-window calendar."
      />
      <Card><CardContent className="py-6">
        <CycleForm babyId={params.babyId} />
      </CardContent></Card>
    </PageShell>
  );
}

import { Card, CardContent } from '@/components/ui/Card';
import { StoolForm } from '@/components/forms/StoolForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';

export default async function NewStool({ params }: { params: { babyId: string } }) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/stool`}
        backLabel="stool logs"
        eyebrow="Stool & diaper"
        eyebrowTint="mint"
        title="Log a diaper"
        subtitle="Size, color, consistency, rash — anything you notice helps spot patterns."
      />
      <Card><CardContent className="py-6"><StoolForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

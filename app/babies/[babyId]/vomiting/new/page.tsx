import { assertRole } from '@/lib/role-guard';
import { Card, CardContent } from '@/components/ui/Card';
import { VomitingForm } from '@/components/forms/VomitingForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewVomiting({ params }: { params: { babyId: string } }) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/vomiting`}
        backLabel="vomiting"
        eyebrow="Log"
        eyebrowTint="coral"
        title="Log a vomiting episode"
        subtitle="Severity, content, and timing — pediatricians ask for these three first."
      />
      <Card><CardContent className="py-6">
        <VomitingForm babyId={params.babyId} />
      </CardContent></Card>
    </PageShell>
  );
}

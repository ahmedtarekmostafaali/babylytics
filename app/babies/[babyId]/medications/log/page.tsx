import { Card, CardContent } from '@/components/ui/Card';
import { MedicationLogForm } from '@/components/forms/MedicationLogForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';

export default async function NewMedLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { m?: string };
}) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/medications`}
        backLabel="medications"
        eyebrow="Medications"
        eyebrowTint="lavender"
        title="Log a dose"
        subtitle="Record each administered dose to keep adherence accurate."
      />
      <Card><CardContent className="py-6">
        <MedicationLogForm babyId={params.babyId} defaultMedId={searchParams.m} />
      </CardContent></Card>
    </PageShell>
  );
}

import { Card, CardContent } from '@/components/ui/Card';
import { MedicationLogForm } from '@/components/forms/MedicationLogForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function NewMedLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { m?: string };
}) {
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel="dashboard"
        eyebrow="Medications"
        eyebrowTint="lavender"
        title="Log a dose"
      />
      <Card><CardContent className="py-6">
        <MedicationLogForm babyId={params.babyId} defaultMedId={searchParams.m} />
      </CardContent></Card>
    </PageShell>
  );
}

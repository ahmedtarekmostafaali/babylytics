import { Card, CardContent } from '@/components/ui/Card';
import { MeasurementForm } from '@/components/forms/MeasurementForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';

export default async function NewMeasurement({ params }: { params: { babyId: string } }) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/measurements`}
        backLabel="measurements"
        eyebrow="Growth"
        eyebrowTint="brand"
        title="Log a measurement"
        subtitle="Keeping growth data current refines feeding recommendations (all in metric: kg, cm)."
      />
      <Card><CardContent className="py-6"><MeasurementForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

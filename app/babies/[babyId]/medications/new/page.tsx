import { Card, CardContent } from '@/components/ui/Card';
import { MedicationForm } from '@/components/forms/MedicationForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function NewMedication({ params }: { params: { babyId: string } }) {
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/medications`}
        backLabel="medications"
        eyebrow="New prescription"
        eyebrowTint="lavender"
        title="Add medication"
      />
      <Card><CardContent className="py-6"><MedicationForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

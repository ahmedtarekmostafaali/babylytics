import { Card, CardContent } from '@/components/ui/Card';
import { FeedingForm } from '@/components/forms/FeedingForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function NewFeeding({ params }: { params: { babyId: string } }) {
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}/feedings`}
        backLabel="feedings"
        eyebrow="Feedings"
        eyebrowTint="peach"
        title="Log a feeding"
        subtitle="Breast, bottle or solid — the sooner logged, the more accurate your patterns."
      />
      <Card><CardContent className="py-6"><FeedingForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

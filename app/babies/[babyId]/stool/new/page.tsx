import { Card, CardContent } from '@/components/ui/Card';
import { StoolForm } from '@/components/forms/StoolForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function NewStool({ params }: { params: { babyId: string } }) {
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel="dashboard"
        eyebrow="Stool & diaper"
        eyebrowTint="mint"
        title="Log a stool"
      />
      <Card><CardContent className="py-6"><StoolForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

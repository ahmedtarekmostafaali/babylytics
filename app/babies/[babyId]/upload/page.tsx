import { Card, CardContent } from '@/components/ui/Card';
import { UploadForm } from '@/components/forms/UploadForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function UploadPage({ params }: { params: { babyId: string } }) {
  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel="dashboard"
        eyebrow="Smart Scan"
        eyebrowTint="coral"
        title="Upload a medical file"
        subtitle="Daily notes · prescriptions · reports · stool images. Handwritten notes get OCR'd automatically."
      />
      <Card><CardContent className="py-6"><UploadForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

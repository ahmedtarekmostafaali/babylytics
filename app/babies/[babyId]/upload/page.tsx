import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { UploadForm } from '@/components/forms/UploadForm';

export default function UploadPage({ params }: { params: { babyId: string } }) {
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Upload a medical file</CardTitle></CardHeader>
          <CardContent><UploadForm babyId={params.babyId} /></CardContent>
        </Card>
      </main>
    </div>
  );
}

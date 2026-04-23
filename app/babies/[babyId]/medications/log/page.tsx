import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MedicationLogForm } from '@/components/forms/MedicationLogForm';

export default function NewMedLog({
  params,
  searchParams,
}: {
  params: { babyId: string };
  searchParams: { m?: string };
}) {
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Log a dose</CardTitle></CardHeader>
          <CardContent>
            <MedicationLogForm babyId={params.babyId} defaultMedId={searchParams.m} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

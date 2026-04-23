import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { MedicationForm } from '@/components/forms/MedicationForm';

export default function NewMedication({ params }: { params: { babyId: string } }) {
  return (
    <div>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}/medications`} className="text-sm text-slate-500 hover:underline">← medications</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Add medication</CardTitle></CardHeader>
          <CardContent><MedicationForm babyId={params.babyId} /></CardContent>
        </Card>
      </main>
    </div>
  );
}

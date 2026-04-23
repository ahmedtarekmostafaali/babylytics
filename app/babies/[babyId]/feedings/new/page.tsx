import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FeedingForm } from '@/components/forms/FeedingForm';
import Link from 'next/link';

export default function NewFeeding({ params }: { params: { babyId: string } }) {
  return (
    <div>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Log a feeding</CardTitle></CardHeader>
          <CardContent><FeedingForm babyId={params.babyId} /></CardContent>
        </Card>
      </main>
    </div>
  );
}

import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StoolForm } from '@/components/forms/StoolForm';

export default function NewStool({ params }: { params: { babyId: string } }) {
  return (
    <div>
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Log a stool</CardTitle></CardHeader>
          <CardContent><StoolForm babyId={params.babyId} /></CardContent>
        </Card>
      </main>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FeedingForm } from '@/components/forms/FeedingForm';

export const dynamic = 'force-dynamic';

export default async function EditFeeding({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('feedings')
    .select('id,baby_id,feeding_time,milk_type,quantity_ml,kcal,duration_min,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Edit feeding</CardTitle></CardHeader>
          <CardContent>
            <FeedingForm babyId={params.babyId} initial={{
              id: data.id,
              baby_id: data.baby_id,
              feeding_time: data.feeding_time,
              milk_type: data.milk_type as 'formula',
              quantity_ml: data.quantity_ml,
              kcal: data.kcal,
              duration_min: data.duration_min,
              notes: data.notes,
            }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

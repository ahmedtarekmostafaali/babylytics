import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { StoolForm } from '@/components/forms/StoolForm';

export const dynamic = 'force-dynamic';

export default async function EditStool({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('stool_logs')
    .select('id,baby_id,stool_time,quantity_category,quantity_ml,color,consistency,has_diaper_rash,notes')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();
  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle>Edit stool log</CardTitle></CardHeader>
          <CardContent>
            <StoolForm babyId={params.babyId} initial={{
              id: data.id, baby_id: data.baby_id,
              stool_time: data.stool_time,
              quantity_category: data.quantity_category as 'medium',
              quantity_ml: data.quantity_ml, color: data.color, consistency: data.consistency,
              has_diaper_rash: data.has_diaper_rash, notes: data.notes,
            }} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BabyEditForm, type BabyEditValue } from '@/components/forms/BabyEditForm';

export const dynamic = 'force-dynamic';

export default async function EditBabyPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,birth_height_cm,feeding_factor_ml_per_kg_per_day,notes')
    .eq('id', params.babyId)
    .is('deleted_at', null)
    .single();
  if (!baby) notFound();

  // Look up role — only owners can delete
  const [{ data: membership }, { data: currentWeight }] = await Promise.all([
    supabase.from('baby_users')
      .select('role')
      .eq('baby_id', params.babyId)
      .eq('user_id', user?.id ?? '')
      .single(),
    supabase.rpc('current_weight_kg', { p_baby: params.babyId }),
  ]);

  const canDelete = membership?.role === 'owner';

  return (
    <div>
      <main className="max-w-xl mx-auto px-4 py-6">
        <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← back to {baby.name}</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-base">Edit baby profile</CardTitle></CardHeader>
          <CardContent>
            <BabyEditForm
              baby={baby as BabyEditValue}
              currentWeightKg={currentWeight as number | null}
              canDelete={canDelete}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

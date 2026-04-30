import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShoppingItemForm } from '@/components/forms/ShoppingItemForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditShoppingItem({
  params,
}: {
  params: { babyId: string; id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') {
    redirect(`/babies/${params.babyId}/shopping`);
  }

  const { data } = await supabase.from('shopping_list_items')
    .select('*').eq('id', params.id).is('deleted_at', null).single();
  if (!data) notFound();

  const scope: 'baby'|'pregnancy'|'medication' = (data.scope as 'baby'|'pregnancy'|'medication') ?? 'baby';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/shopping?scope=${scope}`} backLabel="Shopping list"
        eyebrow="Edit" eyebrowTint="mint"
        title="Item" />
      <Card><CardContent className="py-6">
        <ShoppingItemForm babyId={params.babyId} scope={scope} initial={{
          id: data.id,
          scope,
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          priority: data.priority as 'low'|'normal'|'high',
          notes: data.notes,
          is_done: data.is_done,
        }} />
      </CardContent></Card>
    </PageShell>
  );
}

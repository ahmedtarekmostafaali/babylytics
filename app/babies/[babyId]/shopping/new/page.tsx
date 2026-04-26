import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ShoppingItemForm } from '@/components/forms/ShoppingItemForm';
import { Card, CardContent } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewShoppingItem({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { scope?: 'baby'|'pregnancy' };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = m?.role as string | undefined;
  if (!role || role === 'viewer' || role === 'doctor' || role === 'nurse') {
    redirect(`/babies/${params.babyId}/shopping`);
  }

  const scope: 'baby'|'pregnancy' = searchParams.scope === 'pregnancy' ? 'pregnancy' : 'baby';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/shopping?scope=${scope}`} backLabel="Shopping list"
        eyebrow="Add" eyebrowTint="mint"
        title={scope === 'pregnancy' ? 'Pregnancy & mom item' : 'Baby item'} />
      <Card><CardContent className="py-6">
        <ShoppingItemForm babyId={params.babyId} scope={scope}
          initial={{ scope, name: '', priority: 'normal' }} />
      </CardContent></Card>
    </PageShell>
  );
}

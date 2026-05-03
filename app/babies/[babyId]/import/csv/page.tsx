import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { CsvBulkImporter } from '@/components/CsvBulkImporter';
import { loadUserPrefs } from '@/lib/user-prefs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk CSV import' };

export default async function CsvImportPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Parent/owner only — every import RPC also enforces this server-side
  // via is_baby_parent, but bouncing here saves a confusing error.
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user.id).maybeSingle();
  if (!['owner', 'parent', 'editor'].includes(m?.role as string)) {
    redirect(`/babies/${params.babyId}`);
  }

  const { data: baby } = await supabase.from('babies')
    .select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow={isAr ? 'استيراد' : 'IMPORT'}
        eyebrowTint="coral"
        title={isAr ? 'استيراد جماعي بصيغة CSV' : 'Bulk CSV import'}
        subtitle={isAr
          ? 'الصقي تاريخ الدورة، الوزن، الضغط، السكر، أو أي مؤشر حيوي. أعيدي الاستيراد بأمان — التكرارات لن تحدث.'
          : 'Backfill cycle history, weight, BP, glucose, or any vital signs. Safe to re-run — duplicates are detected and skipped.'} />

      <CsvBulkImporter babyId={params.babyId} lang={userPrefs.language} />
    </PageShell>
  );
}

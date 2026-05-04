import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { BulkFileUploader } from '@/components/BulkFileUploader';
import { loadUserPrefs } from '@/lib/user-prefs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk file upload' };

export default async function BulkFileImportPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Parent/owner/editor only — same gate as the single-file UploadForm.
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
        title={isAr ? 'رفع ملفات بالجملة' : 'Bulk file upload'}
        subtitle={isAr
          ? 'اسحبي مجلد ملفات سونار، تحاليل، روشتات، أو تقارير. حتى ٥٠ ملف في الدفعة.'
          : 'Drop a folder of ultrasounds, lab reports, prescriptions, or doctor reports. Up to 50 files per batch.'} />

      <BulkFileUploader babyId={params.babyId} lang={userPrefs.language} />
    </PageShell>
  );
}

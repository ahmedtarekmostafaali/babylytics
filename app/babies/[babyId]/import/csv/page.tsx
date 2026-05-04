import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { CsvBulkImporter } from '@/components/CsvBulkImporter';
import { loadUserPrefs } from '@/lib/user-prefs';
import { Upload, ArrowRight } from 'lucide-react';

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

      {/* Wave 28: cross-link to bulk file upload for non-tabular data
          (PDFs, ultrasound images, lab reports). */}
      <Link href={`/babies/${params.babyId}/import/files`}
        className="block rounded-2xl border border-slate-200 hover:bg-slate-50 transition p-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
            <Upload className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {isAr ? 'ملفات بدلاً من بيانات جدولية؟' : 'Have files instead of tabular data?'}
            </div>
            <div className="font-bold text-ink-strong">
              {isAr ? 'رفع ملفات بالجملة' : 'Bulk file upload'}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {isAr
                ? 'اسحبي حتى ٥٠ ملف سونار أو تحاليل أو روشتات دفعة واحدة.'
                : 'Drop up to 50 ultrasound, lab, or prescription files at once.'}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-ink-muted" />
        </div>
      </Link>
    </PageShell>
  );
}

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { AppleHealthImporter } from '@/components/AppleHealthImporter';
import { FileText, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Import from Apple Health' };

export default async function AppleHealthImportPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Parent/owner only — import_menstrual_cycles RPC enforces this server-
  // side too, but bouncing here saves a confusing client-side error.
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user.id).maybeSingle();
  if (!['owner','parent','editor'].includes(m?.role as string)) redirect(`/babies/${params.babyId}`);

  const { data: baby } = await supabase.from('babies')
    .select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/planner`} backLabel="My cycle"
        eyebrow="IMPORT" eyebrowTint="coral"
        title="Apple Health"
        subtitle="Drop your export.zip — your data is parsed locally in your browser. Only the cycle entries leave your device." />
      <AppleHealthImporter babyId={params.babyId} />

      {/* Wave 27: cross-link to the new CSV bulk import for users whose
          history isn't on Apple Health. */}
      <Link href={`/babies/${params.babyId}/import/csv`}
        className="block rounded-2xl border border-slate-200 hover:bg-slate-50 transition p-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-mint-100 text-mint-700 grid place-items-center shrink-0">
            <FileText className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">Other source?</div>
            <div className="font-bold text-ink-strong">Bulk CSV import</div>
            <p className="text-xs text-ink-muted mt-0.5">
              Paste cycles, weight, BP, glucose, BBT, sleep, or any vital sign as CSV — same idempotency.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-ink-muted" />
        </div>
      </Link>
    </PageShell>
  );
}

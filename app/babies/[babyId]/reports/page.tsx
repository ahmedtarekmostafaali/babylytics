import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { CalendarDays, FileSpreadsheet, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports' };

export default async function ReportsIndex({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireExport: true });
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Reports"
        eyebrowTint="brand"
        title="Pediatrician-ready summaries"
        subtitle="Tap a card to open — both reports are printable with one click."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ReportCard
          href={`/babies/${params.babyId}/reports/daily`}
          icon={CalendarDays}
          tint="peach"
          title="Daily report"
          text="One-day summary: total feeds, stool count, doses administered, and measurements. Pick any day."
        />
        <ReportCard
          href={`/babies/${params.babyId}/reports/full`}
          icon={FileSpreadsheet}
          tint="brand"
          title="Full detail report"
          text="Comprehensive over a date range: summaries, medication list, full timelines, uploaded files. Printable."
        />
      </div>
    </PageShell>
  );
}

function ReportCard({ href, icon: Icon, tint, title, text }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'peach' | 'brand';
  title: string;
  text: string;
}) {
  const tintCss = {
    peach: { bg: 'from-peach-50 via-white to-peach-50', iconBg: 'bg-peach-500', link: 'text-peach-700' },
    brand: { bg: 'from-brand-50 via-white to-brand-50', iconBg: 'bg-brand-500', link: 'text-brand-700' },
  }[tint];
  return (
    <Link href={href}
      className={`group relative overflow-hidden rounded-3xl border border-slate-200/70 p-6 shadow-card bg-gradient-to-br ${tintCss.bg} transition hover:shadow-panel hover:-translate-y-0.5`}>
      <div className="flex items-start gap-4">
        <div className={`h-12 w-12 rounded-2xl ${tintCss.iconBg} text-white grid place-items-center shrink-0 shadow-sm`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-ink-strong">{title}</h3>
            <ArrowRight className={`h-5 w-5 ${tintCss.link} transition group-hover:translate-x-1`} />
          </div>
          <p className="mt-1 text-sm text-ink">{text}</p>
          <div className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${tintCss.link}`}>
            Open <ArrowRight className="h-3 w-3" />
          </div>
        </div>
      </div>
    </Link>
  );
}

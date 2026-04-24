import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CalendarDays, FileSpreadsheet } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ReportsIndex({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <Link href={`/babies/${params.babyId}`} className="text-sm text-ink-muted hover:underline">← {baby.name}</Link>
        <h1 className="text-xl font-semibold text-ink-strong mt-1">Reports</h1>
        <p className="text-sm text-ink-muted">Printable summaries for pediatrician visits and personal records.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/babies/${params.babyId}/reports/daily`} className="block">
          <Card className="hover:shadow-panel transition cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-9 w-9 rounded-lg bg-peach-100 text-peach-700 grid place-items-center"><CalendarDays className="h-5 w-5" /></span>
                Daily report
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink">
              One-day summary: total feeds, total stools, doses administered, measurements logged.
              Pick any day. Quick read for daily check-ins.
            </CardContent>
          </Card>
        </Link>

        <Link href={`/babies/${params.babyId}/reports/full`} className="block">
          <Card className="hover:shadow-panel transition cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-9 w-9 rounded-lg bg-brand-100 text-brand-700 grid place-items-center"><FileSpreadsheet className="h-5 w-5" /></span>
                Full detail report
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-ink">
              Comprehensive over a date range: aggregated KPIs, medication list, full feed / stool /
              measurement timelines, uploaded files. Printable.
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

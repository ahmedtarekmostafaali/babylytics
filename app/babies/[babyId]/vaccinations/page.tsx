import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { Syringe, Sparkles } from 'lucide-react';
import { SeedScheduleButton } from '@/components/SeedScheduleButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vaccinations' };

type Row = {
  id: string;
  vaccine_name: string;
  scheduled_at: string | null;
  administered_at: string | null;
  dose_number: number | null;
  total_doses: number | null;
  status: 'scheduled'|'administered'|'skipped'|'missed';
  provider: string | null;
  batch_number: string | null;
};

const STATUS_STYLES: Record<Row['status'], { bg: string; text: string; label: string }> = {
  scheduled:    { bg: 'bg-brand-100',    text: 'text-brand-700',    label: 'Scheduled' },
  administered: { bg: 'bg-mint-100',     text: 'text-mint-700',     label: 'Done' },
  skipped:      { bg: 'bg-peach-100',    text: 'text-peach-700',    label: 'Skipped' },
  missed:       { bg: 'bg-coral-100',    text: 'text-coral-700',    label: 'Missed' },
};

export default async function VaccinationsList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: rowsRaw } = await supabase
    .from('vaccinations')
    .select('id,vaccine_name,scheduled_at,administered_at,dose_number,total_doses,status,provider,batch_number')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(300);
  const rows = (rowsRaw ?? []) as Row[];

  const now = Date.now();
  const upcoming = rows.filter(r => r.status === 'scheduled' && (r.scheduled_at ? new Date(r.scheduled_at).getTime() >= now : true));
  const overdue  = rows.filter(r => r.status === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at).getTime() < now);
  const done     = rows.filter(r => r.status === 'administered').sort((a, b) =>
    new Date(b.administered_at ?? 0).getTime() - new Date(a.administered_at ?? 0).getTime());
  const other    = rows.filter(r => r.status === 'skipped' || r.status === 'missed');

  return (
    <PageShell max="4xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Health" eyebrowTint="lavender" title="Vaccinations"
        subtitle={`${rows.length} entries · ${done.length} administered`}
        right={
          <div className="flex gap-2">
            {rows.length === 0 && <SeedScheduleButton babyId={params.babyId} />}
            <Link href={`/babies/${params.babyId}/vaccinations/new`}><Button variant="lavender">+ Add vaccination</Button></Link>
          </div>
        } />

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-lavender-100 text-lavender-600 grid place-items-center">
            <Syringe className="h-8 w-8" />
          </div>
          <p className="mt-3 text-ink-muted">No vaccinations tracked yet.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <SeedScheduleButton babyId={params.babyId} />
            <Link href={`/babies/${params.babyId}/vaccinations/new`}><Button variant="secondary">+ Add manually</Button></Link>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            <Sparkles className="inline h-3 w-3" /> Suggested schedule fills the first 12 months with a standard vaccine plan — adjust freely afterwards.
          </p>
        </div>
      )}

      {overdue.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-coral-600">Overdue</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {overdue.map(r => <VaccineRow key={r.id} r={r} babyId={params.babyId} />)}
          </CardContent>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Upcoming</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.map(r => <VaccineRow key={r.id} r={r} babyId={params.babyId} />)}
          </CardContent>
        </Card>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Administered</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {done.map(r => <VaccineRow key={r.id} r={r} babyId={params.babyId} />)}
          </CardContent>
        </Card>
      )}

      {other.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Skipped / missed</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {other.map(r => <VaccineRow key={r.id} r={r} babyId={params.babyId} />)}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

function VaccineRow({ r, babyId }: { r: Row; babyId: string }) {
  const s = STATUS_STYLES[r.status];
  return (
    <Link href={`/babies/${babyId}/vaccinations/${r.id}`}
      className="flex items-center gap-4 rounded-2xl bg-lavender-50/60 hover:bg-lavender-100/60 p-4 transition">
      <span className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
        <Syringe className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-ink-strong truncate">
          {r.vaccine_name}
          {r.dose_number && r.total_doses ? <span className="text-ink-muted font-normal"> · dose {r.dose_number}/{r.total_doses}</span> : null}
        </span>
        <span className="block text-xs text-ink-muted truncate">
          {r.status === 'administered' && r.administered_at ? `Given ${fmtDateTime(r.administered_at)}` : ''}
          {r.status !== 'administered' && r.scheduled_at ? `Scheduled ${fmtDate(r.scheduled_at)}` : ''}
          {r.provider ? ` · ${r.provider}` : ''}
        </span>
      </span>
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text} shrink-0`}>
        {s.label}
      </span>
    </Link>
  );
}

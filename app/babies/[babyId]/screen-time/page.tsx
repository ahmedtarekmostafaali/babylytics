import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { fmtDateTime, fmtRelative, localDayKey, todayLocalDate, yesterdayLocalDate } from '@/lib/dates';
import { Tv, Plus, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Screen time' };

type Row = {
  id: string; started_at: string; duration_min: number;
  content_type: string | null; device: string | null; notes: string | null;
};

export default async function ScreenTimeList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { canWriteLogs } = await assertRole(params.babyId, { requireLogs: true });

  const { data: rows } = await supabase.from('screen_time_logs')
    .select('id,started_at,duration_min,content_type,device,notes')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('started_at', { ascending: false });
  const list = (rows ?? []) as Row[];

  // Today's total
  const today = todayLocalDate();
  const yesterday = yesterdayLocalDate();
  const todayMin = list.filter(r => localDayKey(r.started_at) === today).reduce((a, r) => a + r.duration_min, 0);
  const yesterdayMin = list.filter(r => localDayKey(r.started_at) === yesterday).reduce((a, r) => a + r.duration_min, 0);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Track" eyebrowTint="lavender" title="Screen time"
        right={canWriteLogs ? (
          <Link href={`/babies/${params.babyId}/screen-time/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> Log session
          </Link>
        ) : undefined} />

      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">Today</div>
          <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{todayMin} min</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">Yesterday</div>
          <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{yesterdayMin} min</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
          <Tv className="h-8 w-8 mx-auto text-ink-muted/60" />
          <p className="text-sm text-ink-muted mt-3">No screen-time sessions logged yet.</p>
          {canWriteLogs && (
            <Link href={`/babies/${params.babyId}/screen-time/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-sm font-semibold px-4 py-2">
              <Plus className="h-4 w-4" /> Log first session
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {list.map(r => (
            <li key={r.id}>
              <Link href={`/babies/${params.babyId}/screen-time/${r.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition">
                <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
                  <Tv className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-ink-strong tabular-nums">{r.duration_min} min</div>
                    {r.content_type && <span className="text-[11px] uppercase tracking-wider text-lavender-700 bg-lavender-50 px-2 py-0.5 rounded-full">{r.content_type.replace('_',' ')}</span>}
                    {r.device && <span className="text-[11px] uppercase tracking-wider text-ink-muted">{r.device}</span>}
                    <span className="ml-auto text-[11px] text-ink-muted">{fmtRelative(r.started_at)}</span>
                  </div>
                  <div className="text-xs text-ink-muted">{fmtDateTime(r.started_at)}</div>
                  {r.notes && <p className="mt-1 text-xs text-ink line-clamp-2">{r.notes}</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 mt-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="screen_time_list" title="Page comments" />
    </PageShell>
  );
}

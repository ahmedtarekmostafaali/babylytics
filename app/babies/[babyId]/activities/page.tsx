import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDateTime, fmtRelative, localDayKey, todayLocalDate } from '@/lib/dates';
import { Activity, Plus, ArrowRight, MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Activities' };

type Row = {
  id: string; started_at: string; duration_min: number | null;
  activity_type: string; intensity: string | null; location: string | null;
  mood: string | null; notes: string | null;
};

export default async function ActivitiesList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { canWriteLogs } = await assertRole(params.babyId, { requireLogs: true });

  const { data: rows } = await supabase.from('activity_logs')
    .select('id,started_at,duration_min,activity_type,intensity,location,mood,notes')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('started_at', { ascending: false });
  const list = (rows ?? []) as Row[];

  const today = todayLocalDate();
  const todaysActivities = list.filter(r => localDayKey(r.started_at) === today);
  const todayMinutes = todaysActivities.reduce((a, r) => a + (r.duration_min ?? 0), 0);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Track" eyebrowTint="mint" title="Activities"
        right={canWriteLogs ? (
          <Link href={`/babies/${params.babyId}/activities/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-mint-500 hover:bg-mint-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> Log activity
          </Link>
        ) : undefined} />

      <div className="grid gap-3 grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">Today</div>
          <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{todaysActivities.length}</div>
          <div className="text-xs text-ink-muted">{todayMinutes} min total</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">All-time</div>
          <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{list.length}</div>
          <div className="text-xs text-ink-muted">{list.reduce((a, r) => a + (r.duration_min ?? 0), 0)} min total</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
          <Activity className="h-8 w-8 mx-auto text-ink-muted/60" />
          <p className="text-sm text-ink-muted mt-3">No activities logged yet.</p>
          {canWriteLogs && (
            <Link href={`/babies/${params.babyId}/activities/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint-500 hover:bg-mint-600 text-white text-sm font-semibold px-4 py-2">
              <Plus className="h-4 w-4" /> Log first activity
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
          {list.map(r => (
            <li key={r.id}>
              <Link href={`/babies/${params.babyId}/activities/${r.id}`}
                className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition">
                <span className="h-9 w-9 rounded-xl bg-mint-100 text-mint-700 grid place-items-center shrink-0">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-ink-strong">{r.activity_type}</div>
                    {r.duration_min != null && <span className="text-[11px] uppercase tracking-wider text-mint-700 bg-mint-50 px-2 py-0.5 rounded-full">{r.duration_min} min</span>}
                    {r.intensity && <span className="text-[11px] uppercase tracking-wider text-ink-muted">{r.intensity}</span>}
                    {r.mood && <span className="text-[11px] uppercase tracking-wider text-coral-700 bg-coral-50 px-2 py-0.5 rounded-full">{r.mood}</span>}
                    <span className="ml-auto text-[11px] text-ink-muted">{fmtRelative(r.started_at)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted flex items-center gap-2 flex-wrap">
                    <span>{fmtDateTime(r.started_at)}</span>
                    {r.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" /> {r.location}</span>}
                  </div>
                  {r.notes && <p className="mt-1 text-xs text-ink line-clamp-2">{r.notes}</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 mt-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

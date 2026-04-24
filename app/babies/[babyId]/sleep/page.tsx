import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogTypeFilter } from '@/components/LogTypeFilter';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { assertRole } from '@/lib/role-guard';
import { Sparkline } from '@/components/Sparkline';
import {
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime, todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import {
  Moon, Bed, Car, Home, Armchair, Baby as BabyIcon, HelpCircle, Plus,
  Edit3, Sparkles, ArrowRight, Clock, Smile, Meh, Frown,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sleep' };

type Row = {
  id: string;
  start_at: string;
  end_at: string | null;
  duration_min: number | null;
  location: 'crib'|'bed'|'car'|'stroller'|'arms'|'other';
  quality: 'sound'|'restless'|'woke_often'|'unknown' | null;
  notes: string | null;
  created_at: string;
};

const LOC_ICON = { crib: BabyIcon, bed: Bed, car: Car, stroller: Home, arms: Armchair, other: HelpCircle } as const;
const QUALITY_META: Record<NonNullable<Row['quality']>, { icon: React.ComponentType<{ className?: string }>; chip: string; label: string }> = {
  sound:      { icon: Smile,      chip: 'bg-mint-100 text-mint-700',     label: 'Sound' },
  restless:   { icon: Meh,        chip: 'bg-peach-100 text-peach-700',   label: 'Restless' },
  woke_often: { icon: Frown,      chip: 'bg-coral-100 text-coral-700',   label: 'Woke often' },
  unknown:    { icon: HelpCircle, chip: 'bg-slate-100 text-ink',         label: 'Unknown' },
};

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

function fmtDur(min: number | null | undefined): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const SLEEP_QUALITIES = ['sound','restless','woke_often','unknown'] as const;
type SleepQuality = typeof SLEEP_QUALITIES[number];

export default async function SleepLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const activeQualities = rawTypes.filter((t): t is SleepQuality => (SLEEP_QUALITIES as readonly string[]).includes(t));
  const typeFilter = activeQualities.length > 0 && activeQualities.length < SLEEP_QUALITIES.length;

  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  let q = supabase.from('sleep_logs')
    .select('id,start_at,end_at,duration_min,location,quality,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('start_at', range.start).lte('start_at', range.end);
  if (typeFilter) q = q.in('quality', activeQualities);

  const [{ data: rowsData }, { data: todayData }, { data: weekData }] = await Promise.all([
    q.order('start_at', { ascending: false }).limit(500),
    (async () => {
      const w = dayWindow(todayLocalDate());
      return supabase.from('sleep_logs')
        .select('id,duration_min,end_at')
        .eq('baby_id', params.babyId).is('deleted_at', null)
        .gte('start_at', w.start).lt('start_at', w.end);
    })(),
    supabase.from('sleep_logs')
      .select('start_at,duration_min')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('start_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('start_at', { ascending: true }),
  ]);

  const rows = (rowsData ?? []) as Row[];
  const todays = (todayData ?? []) as { duration_min: number | null; end_at: string | null }[];
  const week   = (weekData ?? []) as { start_at: string; duration_min: number | null }[];
  const todayTotalMin = todays.reduce((a, r) => a + (r.duration_min ?? 0), 0);
  const running = rows.find(r => r.end_at == null);

  // Sleep minutes per day for last 7d — stacked into a sparkline of hours/day
  const byDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of week) {
    const k = r.start_at.slice(0, 10);
    if (!byDay.has(k)) continue;
    byDay.set(k, (byDay.get(k) ?? 0) + (r.duration_min ?? 0));
  }
  const sparkHours = Array.from(byDay.values()).map(v => v / 60);

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.start_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.start_at), list }));
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Sleep" eyebrowTint="lavender"
        title="Sleep Log"
        subtitle={`All sleep sessions for ${baby.name}.`}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="sleep_logs" timeColumn="start_at"
                visibleIds={rows.map(r => r.id)} kindLabel="sleep sessions" />
              <Link href={`/babies/${params.babyId}/sleep/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Log sleep
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">Read-only</span>
          )
        } />

      {running && (
        <div className="rounded-2xl border border-lavender-200 bg-gradient-to-r from-lavender-50 via-white to-brand-50 p-4 flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-lavender-500 text-white grid place-items-center shrink-0">
            <Moon className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-lavender-900">Sleeping now</div>
            <div className="text-xs text-lavender-900/80">Started at {fmtTime(running.start_at)}</div>
          </div>
          <Link href={`/babies/${params.babyId}/sleep/${running.id}`}
            className="rounded-full bg-lavender-500 text-white text-xs font-semibold px-3 py-1.5 hover:bg-lavender-600">
            Open
          </Link>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Quality"
          options={[
            { key: 'sound',      label: 'Sound' },
            { key: 'restless',   label: 'Restless' },
            { key: 'woke_often', label: 'Woke often' },
            { key: 'unknown',    label: 'Unknown' },
          ]}
          activeKeys={activeQualities}
          baseHref={`/babies/${params.babyId}/sleep`}
          extraParams={{ range: range.key }} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">No sleep sessions in this window.</div>
          )}
          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const LocIcon = LOC_ICON[r.location] ?? HelpCircle;
                  const qm = r.quality ? QUALITY_META[r.quality] : null;
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/sleep?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.start_at)}</div>
                        </div>
                        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                          <LocIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {fmtDur(r.duration_min)}
                            {r.end_at == null && <span className="text-[10px] font-semibold uppercase tracking-wider text-lavender-700 bg-lavender-200 rounded-full px-2 py-0.5 ml-2">live</span>}
                          </div>
                          <div className="text-xs text-ink-muted truncate capitalize">
                            {r.location}{r.end_at ? ` · ended ${fmtTime(r.end_at)}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {qm && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${qm.chip}`}>
                              <qm.icon className="h-3 w-3" /> {qm.label}
                            </span>
                          )}
                          <ArrowRight className="h-4 w-4 text-ink-muted" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-ink-strong">Sleep details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/sleep/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="sleep_logs" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick a session from the list.</div>
            ) : (() => {
              const LocIcon = LOC_ICON[selected.location] ?? HelpCircle;
              const qm = selected.quality ? QUALITY_META[selected.quality] : null;
              return (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                      <LocIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink-strong">{fmtDur(selected.duration_min)}</div>
                      <div className="text-xs text-ink-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(selected.start_at)}
                        {selected.end_at && ` → ${fmtTime(selected.end_at)}`}
                      </div>
                    </div>
                    {qm && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${qm.chip}`}>
                        <qm.icon className="h-3 w-3" /> {qm.label}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Location</div>
                      <div className="text-base font-bold text-ink-strong capitalize">{selected.location}</div>
                    </div>
                    <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Duration</div>
                      <div className="text-base font-bold text-ink-strong">{fmtDur(selected.duration_min)}</div>
                    </div>
                  </div>
                  {selected.notes && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Notes</div>
                      <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                    </div>
                  )}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Logged on</div>
                    <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                  </div>
                </div>
              );
            })()}
          </section>

          <section className="rounded-2xl bg-lavender-50 border border-lavender-200 p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-xl bg-lavender-500 text-white grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-lavender-900">Today so far</div>
              <div className="text-xs text-lavender-900/90">
                {todayTotalMin === 0
                  ? 'No sleep logged today yet.'
                  : `${fmtDur(todayTotalMin)} across ${todays.length} session${todays.length === 1 ? '' : 's'}.`}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-strong">Last 7 days</h3>
              <span className="text-xs text-ink-muted">hours / day</span>
            </div>
            <Sparkline data={sparkHours.length ? sparkHours : [0]} color="#B9A7D8" width={280} height={48} strokeWidth={2.5} />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Today" value={fmtDur(todayTotalMin)} />
              <MiniStat label="Sessions" value={todays.length} />
              <MiniStat label="Avg 7d" value={fmtDur(Math.round(sparkHours.reduce((a,b)=>a+b,0) * 60 / 7))} />
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</div>
      <div className="text-sm font-bold text-ink-strong leading-tight">{value}</div>
    </div>
  );
}

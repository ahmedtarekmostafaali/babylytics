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
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime, todayLocalDate,
} from '@/lib/dates';
import {
  Thermometer, Plus, Edit3, Sparkles, ArrowRight, Clock,
  AlertTriangle, ShieldCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Temperature' };

type Row = {
  id: string;
  measured_at: string;
  temperature_c: number | string;
  method: string;
  notes: string | null;
  source: string;
  created_at: string;
};

function statusOf(c: number): { label: string; chip: string; tint: 'mint'|'peach'|'coral'|'brand'; } {
  if (c >= 38)  return { label: 'Fever',    chip: 'bg-coral-100 text-coral-700', tint: 'coral' };
  if (c >= 37.5) return { label: 'Elevated', chip: 'bg-peach-100 text-peach-700', tint: 'peach' };
  if (c < 36)   return { label: 'Low',      chip: 'bg-brand-100 text-brand-700', tint: 'brand' };
  return { label: 'Normal', chip: 'bg-mint-100 text-mint-700', tint: 'mint' };
}

function groupKey(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const k = groupKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

const TEMP_STATUSES = ['normal','elevated','fever','low'] as const;
type TempStatus = typeof TEMP_STATUSES[number];

function statusKey(c: number): TempStatus {
  if (c >= 38)   return 'fever';
  if (c >= 37.5) return 'elevated';
  if (c < 36)    return 'low';
  return 'normal';
}

export default async function TemperatureLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const activeStatuses = rawTypes.filter((t): t is TempStatus => (TEMP_STATUSES as readonly string[]).includes(t));
  const typeFilter = activeStatuses.length > 0 && activeStatuses.length < TEMP_STATUSES.length;
  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const [{ data: rowsData }, { data: todayData }] = await Promise.all([
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c,method,notes,source,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('measured_at', range.start).lte('measured_at', range.end)
      .order('measured_at', { ascending: false }).limit(500),
    (async () => {
      const w = dayWindow(todayLocalDate());
      return supabase.from('temperature_logs')
        .select('id,temperature_c')
        .eq('baby_id', params.babyId).is('deleted_at', null)
        .gte('measured_at', w.start).lt('measured_at', w.end);
    })(),
  ]);

  const rowsAll = (rowsData ?? []) as Row[];
  const rows = typeFilter
    ? rowsAll.filter(r => activeStatuses.includes(statusKey(Number(r.temperature_c))))
    : rowsAll;
  const todays = (todayData ?? []) as { temperature_c: number | string }[];
  const values = todays.map(r => Number(r.temperature_c)).filter(Number.isFinite);
  const todayPeak = values.length ? Math.max(...values) : null;
  const todayAvg  = values.length ? values.reduce((a,b)=>a+b,0) / values.length : null;
  const hasFever = values.some(v => v >= 38);

  // Sparkline for the last window
  const sparkValues = rows.slice(0, 30).reverse().map(r => Number(r.temperature_c)).filter(Number.isFinite);

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r.measured_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.measured_at), list }));
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Temperature" eyebrowTint="coral"
        title="Temperature Log"
        subtitle={`All temperature readings for ${baby.name}.`}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="temperature_logs" timeColumn="measured_at"
                visibleIds={rows.map(r => r.id)} kindLabel="readings" />
              <Link href={`/babies/${params.babyId}/temperature/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-coral-600 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Log reading
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">Read-only</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Status"
          options={[
            { key: 'normal',   label: 'Normal' },
            { key: 'elevated', label: 'Elevated' },
            { key: 'fever',    label: 'Fever' },
            { key: 'low',      label: 'Low' },
          ]}
          activeKeys={activeStatuses}
          baseHref={`/babies/${params.babyId}/temperature`}
          extraParams={{ range: range.key }} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">No readings in this window.</div>
          )}
          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const t = Number(r.temperature_c);
                  const st = statusOf(t);
                  const active = selected?.id === r.id;
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/temperature?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-coral-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.measured_at)}</div>
                          <div className="text-[10px] text-ink-muted uppercase tracking-wider">
                            {new Date(r.measured_at).getHours() >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl bg-coral-100 text-coral-600 grid place-items-center shrink-0">
                          <Thermometer className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{t.toFixed(1)} °C · <span className="capitalize text-ink-muted font-normal">{r.method}</span></div>
                          {r.notes && <div className="text-xs text-ink-muted truncate">{r.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${st.chip}`}>{st.label}</span>
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
              <h3 className="text-sm font-bold text-ink-strong">Reading details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/temperature/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="temperature_logs" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick a reading from the list.</div>
            ) : (() => {
              const t = Number(selected.temperature_c);
              const st = statusOf(t);
              const tintBg = { mint: 'bg-mint-50', peach: 'bg-peach-50', coral: 'bg-coral-50', brand: 'bg-brand-50' }[st.tint];
              return (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 rounded-xl bg-coral-100 text-coral-600 grid place-items-center shrink-0">
                      <Thermometer className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink-strong">{t.toFixed(1)} °C</div>
                      <div className="text-xs text-ink-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(selected.measured_at)}
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{st.label}</span>
                  </div>

                  <div className={`rounded-xl px-3 py-2 ${tintBg}`}>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Method</div>
                    <div className="text-sm font-semibold text-ink-strong capitalize">{selected.method}</div>
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

          <section className={`rounded-2xl border p-4 flex items-start gap-3 ${hasFever ? 'bg-coral-50 border-coral-200' : 'bg-mint-50 border-mint-200'}`}>
            <span className={`h-8 w-8 rounded-xl text-white grid place-items-center shrink-0 ${hasFever ? 'bg-coral-500' : 'bg-mint-500'}`}>
              {hasFever ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{hasFever ? 'Fever today' : 'All clear'}</div>
              <div className={`text-xs ${hasFever ? 'text-coral-900/90' : 'text-mint-900/90'}`}>
                {hasFever
                  ? 'Keep a close eye — re-check in 30 minutes and call your pediatrician if it stays above 38 °C.'
                  : todayAvg != null
                    ? `Today's average is ${todayAvg.toFixed(1)} °C. Readings look normal.`
                    : 'No readings logged today yet.'}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink-strong">Summary (Today)</h3>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Readings" value={todays.length} />
              <MiniStat label="Avg" value={todayAvg != null ? `${todayAvg.toFixed(1)}°` : '—'} />
              <MiniStat label="Peak" value={todayPeak != null ? `${todayPeak.toFixed(1)}°` : '—'} />
            </div>
            {sparkValues.length > 1 && (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">Last {sparkValues.length} readings</div>
                <Sparkline data={sparkValues} color="#F4A6A6" width={280} height={44} strokeWidth={2.5} />
              </div>
            )}
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
      <div className="text-lg font-bold text-ink-strong leading-tight">{value}</div>
    </div>
  );
}

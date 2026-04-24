import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import {
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime, todayLocalDate,
} from '@/lib/dates';
import {
  Pill, Plus, Filter, Edit3, Trash2, Sparkles, ArrowRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Check,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Medications' };

type Med = { id: string; name: string; dosage: string | null; route: string; frequency_hours: number | null; total_doses: number | null; starts_at: string; ends_at: string | null; prescribed_by: string | null };
type LogRow = { id: string; medication_id: string; medication_time: string; status: 'taken'|'missed'|'skipped'; actual_dosage: string | null; notes: string | null; source: string; created_at: string };

function groupKey(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const k = groupKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

const STATUS_META: Record<LogRow['status'], { icon: React.ComponentType<{ className?: string }>; chip: string; label: string }> = {
  taken:   { icon: Check,          chip: 'bg-mint-100 text-mint-700',    label: 'Taken' },
  missed:  { icon: AlertTriangle,  chip: 'bg-coral-100 text-coral-700',  label: 'Missed' },
  skipped: { icon: XCircle,        chip: 'bg-peach-100 text-peach-700',  label: 'Skipped' },
};

export default async function MedicationsLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const [{ data: medsData }, { data: logsData }, { data: todayLogs }] = await Promise.all([
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('medication_logs')
      .select('id,medication_id,medication_time,status,actual_dosage,notes,source,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('medication_time', range.start).lte('medication_time', range.end)
      .order('medication_time', { ascending: false }).limit(500),
    (async () => {
      const w = dayWindow(todayLocalDate());
      return supabase.from('medication_logs')
        .select('id,status')
        .eq('baby_id', params.babyId).is('deleted_at', null)
        .gte('medication_time', w.start).lt('medication_time', w.end);
    })(),
  ]);

  const meds = (medsData ?? []) as Med[];
  const logs = (logsData ?? []) as LogRow[];
  const todays = (todayLogs ?? []) as { status: LogRow['status'] }[];
  const medById = new Map(meds.map(m => [m.id, m]));

  const todayTaken = todays.filter(t => t.status === 'taken').length;
  const todayMissed = todays.filter(t => t.status === 'missed').length;
  const todaySkipped = todays.filter(t => t.status === 'skipped').length;
  const adherence = todays.length > 0 ? Math.round((todayTaken / todays.length) * 100) : null;

  const activeMeds = meds.filter(m => !m.ends_at || new Date(m.ends_at).getTime() > Date.now());

  const buckets = new Map<string, LogRow[]>();
  for (const r of logs) {
    const k = groupKey(r.medication_time);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.medication_time), list }));
  const selected = searchParams.id ? logs.find(l => l.id === searchParams.id) : logs[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Medications" eyebrowTint="lavender"
        title="Medications"
        subtitle={`${activeMeds.length} active prescription${activeMeds.length === 1 ? '' : 's'} · ${logs.length} doses logged`}
        right={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
              <Filter className="h-4 w-4" /> Filter
            </button>
            <Link href={`/babies/${params.babyId}/medications/new`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-ink-strong text-sm font-semibold px-4 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Medication
            </Link>
            <Link href={`/babies/${params.babyId}/medications/log`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Log dose
            </Link>
          </div>
        } />

      {/* Active prescriptions strip */}
      {activeMeds.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-lavender-50 to-white border border-lavender-200 shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-ink-strong">Active prescriptions</div>
            <span className="text-xs text-ink-muted">every drug shown with its schedule</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeMeds.map(m => (
              <Link key={m.id} href={`/babies/${params.babyId}/medications/${m.id}`}
                className="flex items-center gap-3 rounded-xl bg-white border border-slate-100 p-3 hover:bg-lavender-50/50 transition">
                <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                  <Pill className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-strong truncate">{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</div>
                  <div className="text-xs text-ink-muted truncate">every {m.frequency_hours ?? '—'}h · {m.route}</div>
                </div>
                <Link href={`/babies/${params.babyId}/medications/log?m=${m.id}`}
                  className="rounded-full bg-lavender-500 text-white text-[11px] px-2.5 py-1 hover:bg-lavender-600">
                  Log
                </Link>
              </Link>
            ))}
          </div>
        </section>
      )}

      <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">No doses logged in this window.</div>
          )}
          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const med = medById.get(r.medication_id);
                  const meta = STATUS_META[r.status];
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/medications?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.medication_time)}</div>
                          <div className="text-[10px] text-ink-muted uppercase tracking-wider">
                            {new Date(r.medication_time).getHours() >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                          <Pill className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {med?.name ?? 'Medication'}{r.actual_dosage ? <span className="text-ink-muted font-normal"> · {r.actual_dosage}</span> : null}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            {med?.route ?? ''}{r.notes ? ` · ${r.notes}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${meta.chip}`}>
                            <meta.icon className="h-3 w-3" /> {meta.label}
                          </span>
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
              <h3 className="text-sm font-bold text-ink-strong">Dose details</h3>
              {selected && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/medications/log/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 bg-white text-coral-600" aria-hidden>
                    <Trash2 className="h-3 w-3" />
                  </span>
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick a dose from the list.</div>
            ) : (() => {
              const med = medById.get(selected.medication_id);
              const meta = STATUS_META[selected.status];
              return (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                      <Pill className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-ink-strong">{med?.name ?? 'Medication'}</div>
                      <div className="text-xs text-ink-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(selected.medication_time)}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                      <meta.icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.actual_dosage && (
                      <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Actual dosage</div>
                        <div className="text-base font-bold text-ink-strong leading-tight">{selected.actual_dosage}</div>
                      </div>
                    )}
                    {med?.dosage && (
                      <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Prescribed</div>
                        <div className="text-base font-bold text-ink-strong leading-tight">{med.dosage}</div>
                      </div>
                    )}
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
              <div className="text-sm font-bold text-lavender-900">
                {adherence == null ? 'No doses today yet' : adherence >= 90 ? 'Great adherence' : adherence >= 70 ? 'On track' : 'Needs attention'}
              </div>
              <div className="text-xs text-lavender-900/90">
                {adherence == null
                  ? 'Log your first dose of the day to see today\'s adherence.'
                  : `${todayTaken}/${todays.length} doses taken today · ${adherence}% adherence.`}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">Summary (Today)</h3>
            <ul className="space-y-2 text-sm">
              <AdhRow icon={CheckCircle2}    tint="mint"     label="Taken"   value={todayTaken} />
              <AdhRow icon={AlertTriangle}   tint="coral"    label="Missed"  value={todayMissed} />
              <AdhRow icon={XCircle}         tint="peach"    label="Skipped" value={todaySkipped} />
              <AdhRow icon={Pill}            tint="lavender" label="Total"   value={todays.length} />
            </ul>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function AdhRow({ icon: Icon, tint, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'mint'|'coral'|'peach'|'lavender'|'brand';
  label: string;
  value: React.ReactNode;
}) {
  const map = {
    mint:     'bg-mint-100 text-mint-700',
    coral:    'bg-coral-100 text-coral-700',
    peach:    'bg-peach-100 text-peach-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    brand:    'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <li className="flex items-center gap-3">
      <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${map}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="font-bold text-ink-strong">{value}</span>
    </li>
  );
}

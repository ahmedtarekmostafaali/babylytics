import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogTypeFilter } from '@/components/LogTypeFilter';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { AddMedToShopping } from '@/components/AddMedToShopping';
import { Comments } from '@/components/Comments';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';
import { tFor } from '@/lib/i18n';
import {
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime, todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import {
  Pill, Plus, Edit3, Sparkles, ArrowRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Check,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Medications' };

type Med = { id: string; name: string; dosage: string | null; route: string; frequency_hours: number | null; total_doses: number | null; starts_at: string; ends_at: string | null; prescribed_by: string | null; doctor_id: string | null };
type LogRow = { id: string; medication_id: string; medication_time: string; status: 'taken'|'missed'|'skipped'; actual_dosage: string | null; notes: string | null; source: string; created_at: string };

type TFn = (k: string, vars?: Record<string, string | number>) => string;

function groupHeading(iso: string, t: TFn): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `${t('trackers.today_grp')}, ${fmtDate(iso)}`;
  if (k === y)     return `${t('trackers.yesterday_grp')}, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

const STATUS_META: Record<LogRow['status'], { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  taken:   { icon: Check,          chip: 'bg-mint-100 text-mint-700' },
  missed:  { icon: AlertTriangle,  chip: 'bg-coral-100 text-coral-700' },
  skipped: { icon: XCircle,        chip: 'bg-peach-100 text-peach-700' },
};

const MED_STATUSES = ['taken','missed','skipped'] as const;
type MedStatus = typeof MED_STATUSES[number];

export default async function MedicationsLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);
  const range = parseRangeParam(searchParams);
  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const activeStatuses = rawTypes.filter((t): t is MedStatus => (MED_STATUSES as readonly string[]).includes(t));
  const typeFilter = activeStatuses.length > 0 && activeStatuses.length < MED_STATUSES.length;

  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  let logsQuery = supabase.from('medication_logs')
    .select('id,medication_id,medication_time,status,actual_dosage,notes,source,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('medication_time', range.start).lte('medication_time', range.end);
  if (typeFilter) logsQuery = logsQuery.in('status', activeStatuses);

  const [{ data: medsData }, { data: logsData }, { data: todayLogs }] = await Promise.all([
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by,doctor_id')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('created_at', { ascending: false }),
    logsQuery.order('medication_time', { ascending: false }).limit(500),
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
  const auditMap = await loadAuditSignatures(supabase, 'medication_logs', logs.map(l => l.id));
  const todays = (todayLogs ?? []) as { status: LogRow['status'] }[];
  const medById = new Map(meds.map(m => [m.id, m]));

  // Range-aware counts (driven by the active range, not "today"). The "due
  // today" denominator below stays calendar-specific because that's what
  // adherence means medically.
  const rangeTaken   = logs.filter(t => t.status === 'taken').length;
  const rangeMissed  = logs.filter(t => t.status === 'missed').length;
  const rangeSkipped = logs.filter(t => t.status === 'skipped').length;
  const todayTaken   = todays.filter(t => t.status === 'taken').length;
  const todayMissed  = todays.filter(t => t.status === 'missed').length;
  const todaySkipped = todays.filter(t => t.status === 'skipped').length;

  const activeMeds = meds.filter(m => !m.ends_at || new Date(m.ends_at).getTime() > Date.now());

  // Compute how many doses SHOULD be given today based on each active med's
  // schedule (starts_at + N × frequency_hours), clipped to today's window.
  // This gives Summary a real denominator instead of just "doses logged".
  const { start: todayStartIso, end: todayEndIso } = dayWindow(todayLocalDate());
  const todayStartMs = new Date(todayStartIso).getTime();
  const todayEndMs   = new Date(todayEndIso).getTime();
  const nowMs        = Date.now();
  let todayDueTotal   = 0;
  let todayDueByNow   = 0;
  for (const m of activeMeds) {
    if (!m.frequency_hours || !m.starts_at) continue;
    const step = Number(m.frequency_hours) * 3600000;
    if (step <= 0) continue;
    const startMs = new Date(m.starts_at).getTime();
    const endMs   = m.ends_at ? new Date(m.ends_at).getTime() : Number.POSITIVE_INFINITY;
    // First scheduled dose at or after today's start. Renamed from `t`
    // (which would shadow the i18n translator at the top of this file).
    let cursorMs = startMs;
    if (cursorMs < todayStartMs) cursorMs += Math.ceil((todayStartMs - cursorMs) / step) * step;
    for (; cursorMs < todayEndMs && cursorMs <= endMs; cursorMs += step) {
      todayDueTotal += 1;
      if (cursorMs <= nowMs) todayDueByNow += 1;
    }
  }
  const todayLogged  = todayTaken + todayMissed + todaySkipped;
  const todayPending = Math.max(0, todayDueByNow - todayLogged);
  const adherence    = todayDueTotal > 0
    ? Math.round((todayTaken / todayDueTotal) * 100)
    : (todayLogged > 0 ? Math.round((todayTaken / todayLogged) * 100) : null);

  const buckets = new Map<string, LogRow[]>();
  for (const r of logs) {
    const k = localDayKey(r.medication_time);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.medication_time, t), list }));
  const selected = searchParams.id ? logs.find(l => l.id === searchParams.id) : logs[0];

  // Map medication → ISO of its last "taken" dose (from the fetched logs). Used
  // to badge active prescriptions whose next computed dose time is overdue.
  const lastTakenByMed = new Map<string, string>();
  for (const l of logs) {
    if (l.status !== 'taken') continue;
    if (!lastTakenByMed.has(l.medication_id)) lastTakenByMed.set(l.medication_id, l.medication_time);
  }
  function medIsOverdue(m: Med): boolean {
    if (!m.frequency_hours) return false;
    const last = lastTakenByMed.get(m.id);
    const baseline = last ?? m.starts_at;
    if (!baseline) return false;
    const next = new Date(baseline).getTime() + Number(m.frequency_hours) * 3600000;
    return next <= nowMs;
  }

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="lavender"
        title={t('trackers.meds_title')}
        subtitle={t('trackers.meds_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <BulkDelete babyId={params.babyId} table="medication_logs" timeColumn="medication_time"
                visibleIds={logs.map(r => r.id)} kindLabel={t('trackers.meds_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/medications/new`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-ink-strong text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.meds_cta')}
              </Link>
              <Link href={`/babies/${params.babyId}/medications/log`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.meds_log_cta')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      {/* Active prescriptions strip */}
      {activeMeds.length > 0 && (
        <section className="rounded-2xl bg-gradient-to-br from-lavender-50 to-white border border-lavender-200 shadow-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-ink-strong">{t('trackers.meds_active_rx')}</div>
            <span className="text-xs text-ink-muted">{t('trackers.meds_active_sub')}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeMeds.map(m => {
              const overdue = medIsOverdue(m);
              return (
                <div key={m.id}
                  className={`flex items-center gap-3 rounded-xl p-3 transition border ${
                    overdue
                      ? 'bg-coral-50 border-coral-200 hover:bg-coral-100/70'
                      : 'bg-white border-slate-100 hover:bg-lavender-50/50'
                  }`}>
                  <Link href={`/babies/${params.babyId}/medications/${m.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
                      overdue ? 'bg-coral-500 text-white' : 'bg-lavender-100 text-lavender-600'
                    }`}>
                      <Pill className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-ink-strong truncate">{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</span>
                        {overdue && (
                          <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-coral-500 text-white px-1.5 py-0.5">
                            {t('trackers.meds_due_pill')}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs truncate ${overdue ? 'text-coral-800/90 font-medium' : 'text-ink-muted'}`}>
                        {t('trackers.meds_every_h', { h: m.frequency_hours ?? '—', route: m.route })}
                        {m.prescribed_by ? ` · ${t('trackers.meds_rx_by', { name: m.prescribed_by })}` : ''}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Quick-action: queue this med for the next pharmacy run.
                        Visible to anyone with write access — RLS does the
                        last-mile check on save. */}
                    {perms.canWriteLogs && <AddMedToShopping medId={m.id} label="Refill" />}
                    <Link href={`/babies/${params.babyId}/medications/log?m=${m.id}`}
                      className={`rounded-full text-white text-[11px] px-2.5 py-1 whitespace-nowrap font-semibold ${
                        overdue ? 'bg-coral-600 hover:bg-coral-700' : 'bg-lavender-500 hover:bg-lavender-600'
                      }`}>
                      {t('trackers.meds_log_btn')}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label={t('trackers.filter_status')}
          options={[
            { key: 'taken',   label: t('trackers.meds_status_taken') },
            { key: 'missed',  label: t('trackers.meds_status_missed') },
            { key: 'skipped', label: t('trackers.meds_status_skipped') },
          ]}
          activeKeys={activeStatuses}
          baseHref={`/babies/${params.babyId}/medications`}
          extraParams={{ range: range.key }}
          allLabel={t('trackers.filter_all')} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">{t('trackers.meds_no_in_window')}</div>
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
                        </div>
                        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                          <Pill className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {med?.name ?? t('trackers.meds_record_label')}{r.actual_dosage ? <span className="text-ink-muted font-normal"> · {r.actual_dosage}</span> : null}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            {med?.route ?? ''}{r.notes ? ` · ${r.notes}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${meta.chip}`}>
                            <meta.icon className="h-3 w-3" /> {t(`trackers.meds_status_${r.status}`)}
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
              <h3 className="text-sm font-bold text-ink-strong">{t('trackers.meds_dose_details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/medications/log/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> {t('trackers.edit_btn')}
                  </Link>
                  <LogRowDelete table="medication_logs" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">{t('trackers.meds_pick_to_see')}</div>
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
                      <div className="font-bold text-ink-strong">{med?.name ?? t('trackers.meds_record_label')}</div>
                      <div className="text-xs text-ink-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtDateTime(selected.medication_time)}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                      <meta.icon className="h-3 w-3" /> {t(`trackers.meds_status_${selected.status}`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selected.actual_dosage && (
                      <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">{t('trackers.meds_actual_dosage')}</div>
                        <div className="text-base font-bold text-ink-strong leading-tight">{selected.actual_dosage}</div>
                      </div>
                    )}
                    {med?.dosage && (
                      <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('trackers.meds_prescribed')}</div>
                        <div className="text-base font-bold text-ink-strong leading-tight">{med.dosage}</div>
                      </div>
                    )}
                    {med?.prescribed_by && (
                      <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2 col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">{t('trackers.meds_prescribed_by')}</div>
                        <div className="text-sm font-bold text-ink-strong leading-tight">{med.prescribed_by}</div>
                      </div>
                    )}
                  </div>
                  {selected.notes && (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('trackers.notes_label')}</div>
                      <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                    </div>
                  )}
                  <AuditFooter audit={auditMap.get(selected.id) ?? null}
                    fallbackCreatedAt={selected.created_at} lang={userPrefs.language} />
                </div>
              );
            })()}
          </section>

          {/* Adherence banner — compares taken vs scheduled doses for the day. */}
          <section className={`rounded-2xl border p-4 flex items-start gap-3 ${
            todayPending > 0
              ? 'bg-coral-50 border-coral-200'
              : adherence != null && adherence >= 90
                ? 'bg-mint-50 border-mint-200'
                : 'bg-lavender-50 border-lavender-200'
          }`}>
            <span className={`h-8 w-8 rounded-xl text-white grid place-items-center shrink-0 ${
              todayPending > 0 ? 'bg-coral-500' : adherence != null && adherence >= 90 ? 'bg-mint-500' : 'bg-lavender-500'
            }`}>
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink-strong">
                {todayDueTotal === 0
                  ? t('trackers.meds_no_due_today')
                  : todayPending > 0
                    ? (todayPending === 1
                        ? t('trackers.meds_pending', { n: todayPending })
                        : t('trackers.meds_pending_plural', { n: todayPending }))
                    : adherence != null && adherence >= 90
                      ? t('trackers.meds_great_adherence')
                      : adherence != null && adherence >= 70
                        ? t('trackers.meds_on_track')
                        : t('trackers.meds_needs_attention')}
              </div>
              <div className="text-xs text-ink-muted">
                {todayDueTotal === 0
                  ? t('trackers.meds_all_asneeded')
                  : t('trackers.meds_progress_msg', { taken: todayTaken, total: todayDueTotal, pct: adherence ?? 0 })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-strong">{t('trackers.summary_label', { range: range.label })}</h3>
              {todayDueTotal > 0 && (
                <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                  {t('trackers.meds_today_count', { logged: todayLogged, total: todayDueTotal })}
                </span>
              )}
            </div>
            <ul className="space-y-2 text-sm">
              <AdhRow icon={CheckCircle2}    tint="mint"     label={t('trackers.meds_summary_taken')}   value={rangeTaken} />
              <AdhRow icon={AlertTriangle}   tint="coral"    label={t('trackers.meds_summary_missed')}  value={rangeMissed} />
              <AdhRow icon={XCircle}         tint="peach"    label={t('trackers.meds_summary_skipped')} value={rangeSkipped} />
              <AdhRow icon={Pill}            tint="lavender" label={t('trackers.meds_summary_due')}     value={todayDueTotal} />
              {todayPending > 0 && (
                <AdhRow icon={AlertTriangle} tint="coral"    label={t('trackers.meds_summary_pending')} value={todayPending} />
              )}
            </ul>
            {todayDueTotal > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
                  <span>{t('trackers.meds_progress_label')}</span>
                  <span>{adherence ?? 0}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-mint-400 to-mint-600"
                    style={{ width: `${Math.max(4, Math.min(100, adherence ?? 0))}%` }} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="medications_list" title={t('page.page_comments')} />
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

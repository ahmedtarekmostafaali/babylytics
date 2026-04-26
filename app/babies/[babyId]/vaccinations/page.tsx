import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { SeedScheduleButton } from '@/components/SeedScheduleButton';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';
import { fmtDate, fmtDateTime, fmtRelative } from '@/lib/dates';
import {
  Syringe, Plus, Edit3, Sparkles, ArrowRight, Clock,
  AlertTriangle, CheckCircle2, XCircle, CalendarClock,
} from 'lucide-react';

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
  notes: string | null;
  created_at: string;
};

type DisplayStatus = Row['status'] | 'overdue';

const STATUS_META: Record<DisplayStatus, { icon: React.ComponentType<{ className?: string }>; chip: string; label: string }> = {
  scheduled:    { icon: CalendarClock, chip: 'bg-brand-100 text-brand-700',   label: 'Scheduled' },
  overdue:      { icon: AlertTriangle, chip: 'bg-coral-100 text-coral-700',   label: 'Overdue' },
  administered: { icon: CheckCircle2,  chip: 'bg-mint-100  text-mint-700',    label: 'Done' },
  skipped:      { icon: XCircle,       chip: 'bg-peach-100 text-peach-700',   label: 'Skipped' },
  missed:       { icon: AlertTriangle, chip: 'bg-coral-100 text-coral-700',   label: 'Missed' },
};

/** Promote "scheduled" → "overdue" when the scheduled time is already past. */
function effectiveStatus(r: Row, nowMs: number): DisplayStatus {
  if (r.status === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at).getTime() < nowMs) {
    return 'overdue';
  }
  return r.status;
}

type Tab = 'all' | 'overdue' | 'upcoming' | 'done';

const TABS: { key: Tab; label: string; tint: string }[] = [
  { key: 'all',      label: 'All',       tint: 'text-ink border-ink' },
  { key: 'overdue',  label: 'Overdue',   tint: 'text-coral-700 border-coral-500' },
  { key: 'upcoming', label: 'Upcoming',  tint: 'text-brand-700 border-brand-500' },
  { key: 'done',     label: 'Done',      tint: 'text-mint-700 border-mint-500' },
];

export default async function VaccinationsLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { tab?: Tab; id?: string };
}) {
  const supabase = createClient();
  const t = tFor((await loadUserPrefs(supabase)).language);
  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const tab: Tab = searchParams.tab ?? 'all';

  const { data: rowsRaw } = await supabase.from('vaccinations')
    .select('id,vaccine_name,scheduled_at,administered_at,dose_number,total_doses,status,provider,batch_number,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .limit(300);
  const rows = (rowsRaw ?? []) as Row[];

  const now = Date.now();
  const overdue  = rows.filter(r => r.status === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at).getTime() < now);
  const upcoming = rows.filter(r => r.status === 'scheduled' && (!r.scheduled_at || new Date(r.scheduled_at).getTime() >= now));
  const done     = rows.filter(r => r.status === 'administered');

  const tabLists: Record<Tab, Row[]> = {
    all: rows, overdue, upcoming, done,
  };
  const tabCounts: Record<Tab, number> = {
    all: rows.length, overdue: overdue.length, upcoming: upcoming.length, done: done.length,
  };

  const list = tabLists[tab];
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : list[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="lavender"
        title={t('trackers.vax_title')}
        subtitle={t('trackers.vax_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {rows.length === 0 && <SeedScheduleButton babyId={params.babyId} />}
              {rows.length > 0 && (
                <BulkDelete babyId={params.babyId} table="vaccinations" timeColumn="scheduled_at"
                  visibleIds={rows.map(r => r.id)} kindLabel={t('trackers.vax_title').toLowerCase()} />
              )}
              <Link href={`/babies/${params.babyId}/vaccinations/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.vax_cta')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-lavender-100 text-lavender-600 grid place-items-center">
            <Syringe className="h-8 w-8" />
          </div>
          <p className="mt-3 text-ink-muted">No vaccinations tracked yet.</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <SeedScheduleButton babyId={params.babyId} />
            <Link href={`/babies/${params.babyId}/vaccinations/new`}
              className="rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold px-4 py-1.5">
              + Add manually
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            <Sparkles className="inline h-3 w-3" /> Suggested schedule fills the first 12 months with a standard plan — adjust freely afterwards.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 px-2 bg-white rounded-2xl border border-slate-200 shadow-card overflow-x-auto">
            {TABS.map(t => {
              const on = tab === t.key;
              return (
                <Link key={t.key}
                  href={`/babies/${params.babyId}/vaccinations?tab=${t.key}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap border-b-2 ${on ? t.tint : 'border-transparent text-ink-muted hover:text-ink'}`}>
                  {t.label}
                  <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${on ? 'bg-ink text-white' : 'bg-slate-100 text-ink-muted'}`}>
                    {tabCounts[t.key]}
                  </span>
                </Link>
              );
            })}
          </div>

          {overdue.length > 0 && tab === 'all' && (
            <div className="rounded-2xl border border-coral-200 bg-coral-50 p-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-coral-600 shrink-0" />
              <div className="flex-1 text-sm text-coral-900">
                <span className="font-bold">{overdue.length}</span> overdue — check with your pediatrician.
              </div>
              <Link href={`/babies/${params.babyId}/vaccinations?tab=overdue`}
                className="rounded-full bg-coral-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-coral-700">
                See overdue
              </Link>
            </div>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
            <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              {list.length === 0 && (
                <div className="p-10 text-center text-sm text-ink-muted">
                  Nothing in this tab.
                </div>
              )}
              <ul className="divide-y divide-slate-100">
                {list.map(r => {
                  const active = selected?.id === r.id;
                  const meta = STATUS_META[effectiveStatus(r, now)];
                  const when = r.status === 'administered' && r.administered_at ? r.administered_at : r.scheduled_at;
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/vaccinations?tab=${tab}&id=${r.id}`}
                        className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                          <Syringe className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {r.vaccine_name}
                            {r.dose_number && r.total_doses ? <span className="text-ink-muted font-normal"> · {r.dose_number}/{r.total_doses}</span> : null}
                          </div>
                          <div className="text-xs text-ink-muted truncate flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {when ? fmtDate(when) : 'TBD'}
                            {r.provider ? ` · ${r.provider}` : ''}
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
            </div>

            <div className="space-y-4 lg:sticky lg:top-4 self-start">
              <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-ink-strong">Vaccination details</h3>
                  {selected && perms.canWriteLogs && (
                    <div className="flex items-center gap-1.5">
                      <Link href={`/babies/${params.babyId}/vaccinations/${selected.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                        <Edit3 className="h-3 w-3" /> Edit
                      </Link>
                      <LogRowDelete table="vaccinations" id={selected.id} />
                    </div>
                  )}
                </div>
                {!selected ? (
                  <div className="p-8 text-center text-sm text-ink-muted">Pick an entry from the list.</div>
                ) : (() => {
                  const meta = STATUS_META[effectiveStatus(selected, now)];
                  return (
                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                          <Syringe className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink-strong">{selected.vaccine_name}</div>
                          <div className="text-xs text-ink-muted">
                            {selected.dose_number && selected.total_doses
                              ? `Dose ${selected.dose_number} of ${selected.total_doses}`
                              : 'Single dose'}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.chip}`}>
                          <meta.icon className="h-3 w-3" /> {meta.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {selected.scheduled_at && (
                          <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Scheduled</div>
                            <div className="text-sm font-bold text-ink-strong">{fmtDate(selected.scheduled_at)}</div>
                            <div className="text-[10px] text-ink-muted">{fmtRelative(selected.scheduled_at)}</div>
                          </div>
                        )}
                        {selected.administered_at && (
                          <div className="rounded-xl bg-mint-50 border border-mint-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-mint-700 font-semibold">Administered</div>
                            <div className="text-sm font-bold text-ink-strong">{fmtDate(selected.administered_at)}</div>
                          </div>
                        )}
                        {selected.provider && (
                          <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Provider</div>
                            <div className="text-sm font-bold text-ink-strong truncate">{selected.provider}</div>
                          </div>
                        )}
                        {selected.batch_number && (
                          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Batch</div>
                            <div className="text-sm font-bold text-ink-strong truncate">{selected.batch_number}</div>
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
                        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                          {selected.status === 'administered' ? 'Logged on' : 'Added on'}
                        </div>
                        <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                      </div>
                    </div>
                  );
                })()}
              </section>

              <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
                <h3 className="text-sm font-bold text-ink-strong mb-3">Plan summary</h3>
                <ul className="space-y-2 text-sm">
                  <PlanRow icon={CalendarClock}  tint="brand"    label="Upcoming"     value={upcoming.length} />
                  <PlanRow icon={AlertTriangle}  tint="coral"    label="Overdue"      value={overdue.length} />
                  <PlanRow icon={CheckCircle2}   tint="mint"     label="Administered" value={done.length} />
                </ul>
              </section>
            </div>
          </div>
        </>
      )}
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="vaccinations_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

function PlanRow({ icon: Icon, tint, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'brand'|'coral'|'mint'|'lavender'|'peach';
  label: string;
  value: React.ReactNode;
}) {
  const map = {
    brand:    'bg-brand-100 text-brand-700',
    coral:    'bg-coral-100 text-coral-700',
    mint:     'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    peach:    'bg-peach-100 text-peach-700',
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

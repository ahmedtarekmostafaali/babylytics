import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';
import { tFor } from '@/lib/i18n';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime, todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import {
  Activity, Plus, Edit3, Sparkles, ArrowRight, Clock, AlertTriangle, ShieldCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vomiting' };

type Row = {
  id: string;
  vomited_at: string;
  severity: 'mild'|'moderate'|'severe'|'projectile' | null;
  content_type: 'milk'|'food'|'clear'|'bilious'|'blood_streaked'|'mixed'|'other' | null;
  triggered_by: string | null;
  related_food: string | null;
  notes: string | null;
  source: string;
  created_at: string;
};

const SEV_CHIP: Record<NonNullable<Row['severity']>, string> = {
  mild:       'bg-mint-100 text-mint-700',
  moderate:   'bg-peach-100 text-peach-700',
  severe:     'bg-coral-100 text-coral-700',
  projectile: 'bg-coral-200 text-coral-800',
};

const CONTENT_LABEL: Record<NonNullable<Row['content_type']>, string> = {
  milk:           'Milk',
  food:           'Food',
  clear:          'Clear',
  bilious:        'Bilious',
  blood_streaked: 'Blood-streaked',
  mixed:          'Mixed',
  other:          'Other',
};

function groupHeading(iso: string, t: (k: string) => string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `${t('trackers.today_grp')}, ${fmtDate(iso)}`;
  if (k === y)     return `${t('trackers.yesterday_grp')}, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function VomitingLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);
  const range = parseRangeParam(searchParams);

  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: rowsData } = await supabase.from('vomiting_logs')
    .select('id,vomited_at,severity,content_type,triggered_by,related_food,notes,source,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('vomited_at', range.start).lte('vomited_at', range.end)
    .order('vomited_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];
  const auditMap = await loadAuditSignatures(supabase, 'vomiting_logs', rows.map(r => r.id));

  const todayCount = rows.filter(r => localDayKey(r.vomited_at) === todayLocalDate()).length;
  const seriousCount = rows.filter(r =>
    r.content_type === 'bilious' || r.content_type === 'blood_streaked'
    || r.severity === 'severe' || r.severity === 'projectile'
  ).length;

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.vomited_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.vomited_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="coral"
        title="Vomiting"
        subtitle="Severity, content, trigger — every episode in one log."
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="vomiting_logs" timeColumn="vomited_at"
                visibleIds={rows.map(r => r.id)} kindLabel="vomiting" />
              <Link href={`/babies/${params.babyId}/vomiting/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-coral-600 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Log vomit
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">{t('page.no_in_window')}</div>
          )}
          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const sev = (r.severity ?? 'mild') as NonNullable<Row['severity']>;
                  const ct = r.content_type;
                  const danger = ct === 'bilious' || ct === 'blood_streaked';
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/vomiting?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-coral-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.vomited_at)}</div>
                        </div>
                        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${danger ? 'bg-coral-200 text-coral-700' : 'bg-coral-100 text-coral-600'}`}>
                          <Activity className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {ct ? CONTENT_LABEL[ct] : 'Vomit'}
                            {r.related_food && <span className="text-ink-muted font-normal"> · after {r.related_food}</span>}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            {r.triggered_by || r.notes || '—'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap capitalize ${SEV_CHIP[sev]}`}>{sev}</span>
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
              <h3 className="text-sm font-bold text-ink-strong">Episode details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/vomiting/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="vomiting_logs" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick an episode from the list.</div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-coral-100 text-coral-600 grid place-items-center shrink-0">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong">
                      {selected.content_type ? CONTENT_LABEL[selected.content_type] : 'Vomit'} · <span className="capitalize">{selected.severity ?? 'mild'}</span>
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.vomited_at)}
                    </div>
                  </div>
                </div>

                {(selected.triggered_by || selected.related_food) && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {selected.related_food && (
                      <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">Related food</div>
                        <div className="text-sm font-bold text-ink-strong">{selected.related_food}</div>
                      </div>
                    )}
                    {selected.triggered_by && (
                      <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Trigger / context</div>
                        <div className="text-sm font-bold text-ink-strong">{selected.triggered_by}</div>
                      </div>
                    )}
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Notes</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}

                <AuditFooter audit={auditMap.get(selected.id) ?? null}
                  fallbackCreatedAt={selected.created_at} lang={userPrefs.language} />
              </div>
            )}
          </section>

          {/* Insight banner — turns coral when a serious episode is in window. */}
          <section className={`rounded-2xl border p-4 flex items-start gap-3 ${seriousCount > 0 ? 'bg-coral-50 border-coral-200' : 'bg-mint-50 border-mint-200'}`}>
            <span className={`h-8 w-8 rounded-xl text-white grid place-items-center shrink-0 ${seriousCount > 0 ? 'bg-coral-500' : 'bg-mint-500'}`}>
              {seriousCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">
                {seriousCount > 0 ? `${seriousCount} serious episode${seriousCount === 1 ? '' : 's'} in window` : 'Nothing alarming in this window'}
              </div>
              <div className={`text-xs ${seriousCount > 0 ? 'text-coral-900/90' : 'text-mint-900/90'}`}>
                {seriousCount > 0
                  ? 'Bilious/blood-streaked or projectile vomit warrants a pediatrician call. Track frequency.'
                  : todayCount > 0
                    ? `${todayCount} episode${todayCount === 1 ? '' : 's'} today, all mild/moderate.`
                    : 'No vomiting logged today. Glad to hear it.'}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">Summary · {range.label}</h3>
            <ul className="space-y-2 text-sm">
              <SumRow label="Total episodes" value={rows.length} tint="coral" />
              <SumRow label="Today" value={todayCount} tint="peach" />
              <SumRow label="Serious (red flag)" value={seriousCount} tint={seriousCount > 0 ? 'coral' : 'mint'} />
            </ul>
          </section>
        </div>
      </div>
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="vomiting_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

function SumRow({ label, value, tint }: { label: string; value: React.ReactNode; tint: 'mint'|'coral'|'peach' }) {
  const map = {
    mint:  'bg-mint-100 text-mint-700',
    coral: 'bg-coral-100 text-coral-700',
    peach: 'bg-peach-100 text-peach-700',
  }[tint];
  return (
    <li className="flex items-center gap-3">
      <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 text-[11px] font-bold ${map}`}>
        {typeof value === 'number' ? value : '•'}
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="font-bold text-ink-strong">{value}</span>
    </li>
  );
}

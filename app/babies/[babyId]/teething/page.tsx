import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';
import { tFor } from '@/lib/i18n';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { Smile, Plus, Edit3, ArrowRight, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Teething' };

type Row = {
  id: string;
  observed_at: string;
  tooth_label: string | null;
  event_type: string;
  pain_level: number | null;
  fever_c: number | null;
  soother_used: string | null;
  notes: string | null;
  created_at: string;
};

const EVENT_LABEL: Record<string, string> = {
  eruption: 'New tooth out',
  swelling: 'Swollen gums',
  pain:     'Pain / fussy',
  fever:    'Fever',
  soothing: 'Soothing care',
  lost:     'Tooth fell out',
};

type TFn = (k: string, vars?: Record<string, string | number>) => string;

function groupHeading(iso: string, t: TFn): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `${t('trackers.today_grp')}, ${fmtDate(iso)}`;
  if (k === y)     return `${t('trackers.yesterday_grp')}, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function TeethingList({
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

  const { data: rowsData } = await supabase.from('teething_logs')
    .select('id,observed_at,tooth_label,event_type,pain_level,fever_c,soother_used,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('observed_at', range.start).lte('observed_at', range.end)
    .order('observed_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];
  const auditMap = await loadAuditSignatures(supabase, 'teething_logs', rows.map(r => r.id));

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.observed_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.observed_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('page.overview')}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="peach"
        title={t('trackers.teething_title')}
        subtitle={t('trackers.teething_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="teething_logs" timeColumn="observed_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('trackers.teething_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/teething/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-peach-500 to-coral-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.teething_cta')}
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
        {/* LIST */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">
              {t('page.no_in_window')}
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const subline = [r.tooth_label, r.soother_used].filter(Boolean).join(' · ') || r.notes || '';
                  const amount = r.pain_level != null ? `pain ${r.pain_level}/10` : (r.fever_c != null ? `${r.fever_c}°C` : '');
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/teething?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-peach-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.observed_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-peach-100 text-peach-600">
                          <Smile className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{EVENT_LABEL[r.event_type] ?? r.event_type}</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {amount && <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{amount}</span>}
                          <ArrowRight className="h-4 w-4 text-ink-muted" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {rows.length >= 500 && (
            <div className="px-5 py-3 text-center border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-brand-700 font-semibold">Showing most recent 500 entries. Narrow the range to see more.</span>
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-ink-strong">Teething details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/teething/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="teething_logs" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                {t('trackers.pick_to_see')}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-peach-100 text-peach-600">
                    <Smile className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong">{EVENT_LABEL[selected.event_type] ?? selected.event_type}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.observed_at)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {selected.tooth_label && (
                    <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2 col-span-2">
                      <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">Tooth</div>
                      <div className="text-base font-bold text-ink-strong leading-tight">{selected.tooth_label}</div>
                    </div>
                  )}
                  {selected.pain_level != null && (
                    <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">Pain</div>
                      <div className="text-xl font-bold text-ink-strong leading-tight">{selected.pain_level}/10</div>
                    </div>
                  )}
                  {selected.fever_c != null && (
                    <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">Fever</div>
                      <div className="text-xl font-bold text-ink-strong leading-tight">{selected.fever_c}°C</div>
                    </div>
                  )}
                  {selected.soother_used && (
                    <div className="rounded-xl bg-mint-50 border border-mint-100 px-3 py-2 col-span-2">
                      <div className="text-[10px] uppercase tracking-wider text-mint-700 font-semibold">What helped</div>
                      <div className="text-sm font-bold text-ink-strong leading-tight">{selected.soother_used}</div>
                    </div>
                  )}
                </div>

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
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="teething_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

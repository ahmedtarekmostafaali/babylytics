import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';
import { tFor } from '@/lib/i18n';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogTypeFilter } from '@/components/LogTypeFilter';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { Tv, Plus, Edit3, ArrowRight, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Screen time' };

type Row = {
  id: string;
  started_at: string;
  duration_min: number;
  content_type: string | null;
  device: string | null;
  notes: string | null;
  created_at: string;
};

type Device = 'tv' | 'tablet' | 'phone' | 'laptop' | 'other';
const DEVICES: Device[] = ['tv', 'tablet', 'phone', 'laptop', 'other'];

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function ScreenTimeList({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);
  const range = parseRangeParam(searchParams);

  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean) as Device[];
  const activeTypes: Device[] = rawTypes.filter((t): t is Device => DEVICES.includes(t));
  const typeFilterActive = activeTypes.length > 0 && activeTypes.length < DEVICES.length;

  const perms = await assertRole(params.babyId, { requireLogs: true });

  let query = supabase.from('screen_time_logs')
    .select('id,started_at,duration_min,content_type,device,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('started_at', range.start).lte('started_at', range.end);
  if (typeFilterActive) query = query.in('device', activeTypes);

  const { data: rowsData } = await query.order('started_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];
  const auditMap = await loadAuditSignatures(supabase, 'screen_time_logs', rows.map(r => r.id));

  // Group rows by day
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.started_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.started_at), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('page.overview')}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="lavender"
        title={t('trackers.screen_title')}
        subtitle={t('trackers.screen_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="screen_time_logs" timeColumn="started_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('trackers.screen_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/screen-time/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.screen_cta')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Device"
          options={DEVICES.map(t => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          activeKeys={activeTypes}
          baseHref={`/babies/${params.babyId}/screen-time`}
          extraParams={{ range: range.key }} />
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
                  const title = r.content_type ? r.content_type.replace(/_/g, ' ') : 'Screen-time';
                  const subline = r.device || r.notes || '';
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/screen-time?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.started_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-lavender-600">
                          <Tv className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate capitalize">{title}</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{r.duration_min} min</span>
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
              <h3 className="text-sm font-bold text-ink-strong">Session details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/screen-time/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="screen_time_logs" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                Pick an item from the list to see details.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-lavender-600">
                    <Tv className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong capitalize">
                      {selected.content_type ? selected.content_type.replace(/_/g, ' ') : 'Screen-time'}
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.started_at)}
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-lavender-50 text-lavender-700">
                    {selected.duration_min} min
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Device</div>
                    <div className="text-xl font-bold text-ink-strong leading-tight capitalize">{selected.device ?? '—'}</div>
                  </div>
                  <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Duration</div>
                    <div className="text-xl font-bold text-ink-strong leading-tight">{selected.duration_min}<span className="text-xs text-ink-muted ml-1 font-normal">min</span></div>
                  </div>
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
        pageScope="screen_time_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

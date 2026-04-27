import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { Comments } from '@/components/Comments';
import { KickCounter } from '@/components/forms/KickCounter';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { Activity, ArrowRight, Clock } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kick counter' };

type KickRow = {
  id: string;
  counted_at: string;
  duration_min: number;
  movements: number;
  notes: string | null;
  created_at: string;
};

function groupHeading(iso: string, t: TFunc): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `${t('prenatal.today_prefix')}${fmtDate(iso)}`;
  if (k === y)     return `${t('prenatal.yesterday_prefix')}${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function KicksPage({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const perms = await assertRole(params.babyId, {});
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: rowsData } = await supabase.from('fetal_movements')
    .select('id,counted_at,duration_min,movements,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('counted_at', range.start).lte('counted_at', range.end)
    .order('counted_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as KickRow[];

  // Group rows by day
  const buckets = new Map<string, KickRow[]>();
  for (const r of rows) {
    const k = localDayKey(r.counted_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.counted_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('prenatal.back_label')}
        eyebrow={t('prenatal.eyebrow')} eyebrowTint="coral"
        title={t('prenatal.kicks_title')}
        subtitle={t('prenatal.kicks_subtitle')} />

      {perms.isParent && <KickCounter babyId={params.babyId} />}

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        {/* LIST */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">
              {t('prenatal.kicks_none')}
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(s => {
                  const active = selected?.id === s.id;
                  const subline = s.notes || t('prenatal.kicks_min_session', { n: s.duration_min });
                  return (
                    <li key={s.id}>
                      <Link href={`/babies/${params.babyId}/prenatal/kicks?range=${range.key}&id=${s.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-coral-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(s.counted_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-coral-100 text-coral-600">
                          <Activity className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{t('prenatal.kicks_count_short', { n: s.movements })}</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{s.duration_min} {t('prenatal.kicks_min_unit')}</span>
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
              <span className="text-xs text-brand-700 font-semibold">{t('page.showing_recent_500')}</span>
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-ink-strong">{t('prenatal.kicks_session_details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <LogRowDelete table="fetal_movements" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                {t('prenatal.kicks_pick')}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-coral-100 text-coral-600">
                    <Activity className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong">{t('prenatal.kicks_session_label')}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.counted_at)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">{t('prenatal.kicks_movements')}</div>
                    <div className="text-xl font-bold text-ink-strong leading-tight">{selected.movements}<span className="text-xs text-ink-muted ml-1 font-normal">{t('prenatal.kicks_kicks_unit')}</span></div>
                  </div>
                  <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">{t('prenatal.kicks_duration')}</div>
                    <div className="text-xl font-bold text-ink-strong leading-tight">{selected.duration_min}<span className="text-xs text-ink-muted ml-1 font-normal">{t('prenatal.kicks_min_unit')}</span></div>
                  </div>
                </div>

                {selected.notes && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('prenatal.visits_notes')}</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('prenatal.common_logged_on')}</div>
                  <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_kicks_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

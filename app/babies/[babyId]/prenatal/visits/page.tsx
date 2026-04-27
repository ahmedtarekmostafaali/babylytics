import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { Stethoscope, Plus, Edit3, ArrowRight, Clock } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prenatal visits' };

type VisitRow = {
  id: string;
  visited_at: string;
  gestational_week: number | null;
  gestational_day: number | null;
  maternal_weight_kg: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  fetal_heart_rate_bpm: number | null;
  fundal_height_cm: number | null;
  doctor_id: string | null;
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

export default async function VisitsList({
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

  const [{ data: rowsData }, { data: doctors }] = await Promise.all([
    supabase.from('prenatal_visits')
      .select('id,visited_at,gestational_week,gestational_day,maternal_weight_kg,bp_systolic,bp_diastolic,fetal_heart_rate_bpm,fundal_height_cm,doctor_id,notes,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('visited_at', range.start).lte('visited_at', range.end)
      .order('visited_at', { ascending: false }).limit(500),
    supabase.from('doctors').select('id,name')
      .eq('baby_id', params.babyId).is('deleted_at', null),
  ]);
  const rows = (rowsData ?? []) as VisitRow[];
  const docMap: Record<string, string> = Object.fromEntries(((doctors ?? []) as { id: string; name: string }[]).map(d => [d.id, d.name]));
  const auditMap = await loadAuditSignatures(supabase, 'prenatal_visits', rows.map(r => r.id));

  // Group rows by day
  const buckets = new Map<string, VisitRow[]>();
  for (const r of rows) {
    const k = localDayKey(r.visited_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.visited_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('prenatal.back_label')}
        eyebrow={t('prenatal.eyebrow')} eyebrowTint="lavender"
        title={t('prenatal.visits_title')}
        subtitle={t('prenatal.visits_subtitle')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="prenatal_visits" timeColumn="visited_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('prenatal.visits_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/prenatal/visits/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('prenatal.visits_add')}
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
              {t('prenatal.visits_none')}
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(v => {
                  const active = selected?.id === v.id;
                  const ga = v.gestational_week != null ? `${v.gestational_week}w${v.gestational_day != null ? ` ${v.gestational_day}d` : ''}` : null;
                  const docName = v.doctor_id ? docMap[v.doctor_id] : null;
                  const subline = [ga, docName].filter(Boolean).join(' · ');
                  return (
                    <li key={v.id}>
                      <Link href={`/babies/${params.babyId}/prenatal/visits?range=${range.key}&id=${v.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(v.visited_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-lavender-600">
                          <Stethoscope className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{t('prenatal.visits_label')}</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {ga && <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{ga}</span>}
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
              <h3 className="text-sm font-bold text-ink-strong">{t('prenatal.visits_details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/prenatal/visits/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> {t('prenatal.common_edit')}
                  </Link>
                  <LogRowDelete table="prenatal_visits" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                {t('prenatal.common_pick')}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {(() => {
                  const ga = selected.gestational_week != null ? `${selected.gestational_week}w${selected.gestational_day != null ? ` ${selected.gestational_day}d` : ''}` : null;
                  const bp = selected.bp_systolic && selected.bp_diastolic ? `${selected.bp_systolic}/${selected.bp_diastolic}` : null;
                  const docName = selected.doctor_id ? docMap[selected.doctor_id] : null;
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-lavender-600">
                          <Stethoscope className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink-strong">{t('prenatal.visits_full_label')}</div>
                          <div className="text-xs text-ink-muted flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtDateTime(selected.visited_at)}
                          </div>
                        </div>
                        {ga && (
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-lavender-50 text-lavender-700">
                            {ga}
                          </span>
                        )}
                      </div>

                      {docName && (
                        <div className="text-sm text-ink">{t('prenatal.visits_seen_by')} <span className="font-semibold">{docName}</span></div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {selected.maternal_weight_kg != null && (
                          <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">{t('prenatal.visits_weight')}</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{selected.maternal_weight_kg.toFixed(1)}<span className="text-xs text-ink-muted ml-1 font-normal">{t('prenatal.visits_kg')}</span></div>
                          </div>
                        )}
                        {bp && (
                          <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">{t('prenatal.visits_bp')}</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{bp}</div>
                          </div>
                        )}
                        {selected.fetal_heart_rate_bpm != null && (
                          <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">{t('prenatal.visits_fhr')}</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{selected.fetal_heart_rate_bpm}<span className="text-xs text-ink-muted ml-1 font-normal">{t('prenatal.visits_bpm')}</span></div>
                          </div>
                        )}
                        {selected.fundal_height_cm != null && (
                          <div className="rounded-xl bg-mint-50 border border-mint-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-mint-700 font-semibold">{t('prenatal.visits_fundal')}</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{selected.fundal_height_cm}<span className="text-xs text-ink-muted ml-1 font-normal">{t('prenatal.visits_cm')}</span></div>
                          </div>
                        )}
                      </div>

                      {selected.notes && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('prenatal.visits_notes')}</div>
                          <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                        </div>
                      )}

                      <AuditFooter audit={auditMap.get(selected.id) ?? null}
                        fallbackCreatedAt={selected.created_at} lang={userPrefs.language} />
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_visits_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

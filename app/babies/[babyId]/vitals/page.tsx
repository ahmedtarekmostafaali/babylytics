import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import { AuditFooter } from '@/components/AuditFooter';
import { loadAuditSignatures } from '@/lib/audit';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { Activity, Plus, Edit3, ArrowRight, Heart, Wind, Clock } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vital signs' };

type Row = {
  id: string;
  measured_at: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate_bpm: number | null;
  oxygen_pct: number | string | null;
  position: 'sitting'|'lying'|'standing'|'unknown' | null;
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

export default async function VitalsList({
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

  const { data: rowsData } = await supabase.from('vital_signs_logs')
    .select('id,measured_at,bp_systolic,bp_diastolic,heart_rate_bpm,oxygen_pct,position,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('measured_at', range.start).lte('measured_at', range.end)
    .order('measured_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];
  const auditMap = await loadAuditSignatures(supabase, 'vital_signs_logs', rows.map(r => r.id));

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.measured_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.measured_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('vitals.back_label')}
        eyebrow={t('vitals.eyebrow')} eyebrowTint="coral"
        title={t('vitals.title')}
        subtitle={t('vitals.subtitle')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="vital_signs_logs" timeColumn="measured_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('vitals.title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/vitals/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-peach-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('vitals.add')}
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
            <div className="p-10 text-center text-sm text-ink-muted">
              {t('vitals.none')}
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
                  const bp = r.bp_systolic != null && r.bp_diastolic != null
                    ? `${r.bp_systolic}/${r.bp_diastolic}` : null;
                  const summary = [
                    bp ? `${bp} mmHg` : null,
                    r.heart_rate_bpm ? `${r.heart_rate_bpm} bpm` : null,
                    r.oxygen_pct != null ? `SpO₂ ${r.oxygen_pct}%` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/vitals?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[60px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-coral-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.measured_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-coral-100 text-coral-600">
                          <Activity className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{summary || t('vitals.no_values')}</div>
                          <div className="text-xs text-ink-muted truncate">{t(`forms.vital_position_${r.position ?? 'unknown'}`)}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-ink-muted" />
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
              <h3 className="text-sm font-bold text-ink-strong">{t('vitals.details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/vitals/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> {t('prenatal.common_edit')}
                  </Link>
                  <LogRowDelete table="vital_signs_logs" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                {t('prenatal.common_pick')}
              </div>
            ) : (
              <div className="p-5 space-y-3">
                <div className="text-xs text-ink-muted flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {fmtDateTime(selected.measured_at)} · {t(`forms.vital_position_${selected.position ?? 'unknown'}`)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.bp_systolic != null && selected.bp_diastolic != null && (
                    <div className="rounded-xl bg-coral-50 border border-coral-100 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">{t('vitals.bp')}</div>
                      <div className="text-xl font-bold text-ink-strong">{selected.bp_systolic}/{selected.bp_diastolic}<span className="text-xs text-ink-muted ml-1 font-normal">mmHg</span></div>
                    </div>
                  )}
                  {selected.heart_rate_bpm != null && (
                    <div className="rounded-xl bg-peach-50 border border-peach-100 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold flex items-center gap-1"><Heart className="h-3 w-3" /> {t('vitals.hr')}</div>
                      <div className="text-xl font-bold text-ink-strong">{selected.heart_rate_bpm}<span className="text-xs text-ink-muted ml-1 font-normal">bpm</span></div>
                    </div>
                  )}
                  {selected.oxygen_pct != null && (
                    <div className="rounded-xl bg-brand-50 border border-brand-100 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold flex items-center gap-1"><Wind className="h-3 w-3" /> {t('vitals.spo2')}</div>
                      <div className="text-xl font-bold text-ink-strong">{selected.oxygen_pct}<span className="text-xs text-ink-muted ml-1 font-normal">%</span></div>
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
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="vital_signs_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

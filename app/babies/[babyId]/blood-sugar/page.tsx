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
import { Droplet, Plus, Edit3, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';
import { DiabetesTypePicker, type DiabetesType } from '@/components/DiabetesTypePicker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Blood sugar' };

type Row = {
  id: string;
  measured_at: string;
  value_mgdl: number | string;
  meal_context: 'fasting'|'before_meal'|'after_meal'|'bedtime'|'random'|'during_low';
  method: 'finger_stick'|'cgm'|'vein_draw'|null;
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

function valueTone(mgdl: number): 'coral'|'peach'|'mint' {
  if (mgdl < 70 || mgdl > 250) return 'coral';
  if (mgdl < 80 || mgdl > 180) return 'peach';
  return 'mint';
}

export default async function BloodSugarList({
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

  const [{ data: rowsData }, { data: babyRow }] = await Promise.all([
    supabase.from('blood_sugar_logs')
      .select('id,measured_at,value_mgdl,meal_context,method,notes,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('measured_at', range.start).lte('measured_at', range.end)
      .order('measured_at', { ascending: false }).limit(500),
    supabase.from('babies').select('diabetes_type').eq('id', params.babyId).maybeSingle(),
  ]);
  const rows = (rowsData ?? []) as Row[];
  const auditMap = await loadAuditSignatures(supabase, 'blood_sugar_logs', rows.map(r => r.id));
  const diabetesType = (babyRow?.diabetes_type as string | null) ?? 'none';

  // Range stats
  const values = rows.map(r => Number(r.value_mgdl));
  const avg  = values.length ? values.reduce((a,b) => a+b, 0) / values.length : null;
  const lowsCount  = values.filter(v => v < 70).length;
  const highsCount = values.filter(v => v > 180).length;

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
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('bs.back_label')}
        eyebrow={t('bs.eyebrow')} eyebrowTint="coral"
        title={t('bs.title')}
        subtitle={t('bs.subtitle')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="blood_sugar_logs" timeColumn="measured_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('bs.title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/blood-sugar/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-coral-600 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('bs.add')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      {/* Diabetes type picker — shown OPEN by default when the type is
          'none' so the parent immediately sees they should pick one. */}
      <DiabetesTypePicker babyId={params.babyId}
        initialType={diabetesType as DiabetesType}
        canEdit={perms.canWriteLogs} />

      <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 text-xs text-brand-900 flex gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-700" />
        <p>{t('bs.cgm_roadmap')}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
      </div>

      {/* Range stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">{t('bs.avg')}</div>
            <div className="text-xl font-bold text-ink-strong">{avg ? avg.toFixed(0) : '—'}<span className="text-xs font-normal text-ink-muted ml-1">mg/dL</span></div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-wider text-coral-700">{t('bs.lows')}</div>
            <div className="text-xl font-bold text-ink-strong">{lowsCount}</div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-3">
            <div className="text-[10px] uppercase tracking-wider text-peach-700">{t('bs.highs')}</div>
            <div className="text-xl font-bold text-ink-strong">{highsCount}</div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">
              {t('bs.none')}
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
                  const v = Number(r.value_mgdl);
                  const tone = valueTone(v);
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/blood-sugar?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[60px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-coral-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.measured_at)}</div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-coral-100 text-coral-600">
                          <Droplet className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{v} mg/dL</div>
                          <div className="text-xs text-ink-muted truncate">{t(`forms.bs_meal_${r.meal_context}`)}{r.method ? ` · ${t(`forms.bs_method_${r.method}`)}` : ''}</div>
                        </div>
                        <span className={`text-xs font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${
                          tone === 'coral' ? 'bg-coral-100 text-coral-700'
                          : tone === 'peach' ? 'bg-peach-100 text-peach-700'
                          : 'bg-mint-100 text-mint-700'}`}>
                          {tone === 'coral' ? (v < 70 ? t('forms.bs_low') : t('forms.bs_high'))
                          : tone === 'peach' ? (v < 100 ? t('forms.bs_borderline_low') : t('forms.bs_borderline_high'))
                          : t('forms.bs_in_range')}
                        </span>
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
              <h3 className="text-sm font-bold text-ink-strong">{t('bs.details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/blood-sugar/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> {t('prenatal.common_edit')}
                  </Link>
                  <LogRowDelete table="blood_sugar_logs" id={selected.id} />
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
                  <Clock className="h-3 w-3" /> {fmtDateTime(selected.measured_at)}
                </div>
                <div className="rounded-xl bg-coral-50 border border-coral-100 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">{t('bs.value')}</div>
                  <div className="text-2xl font-bold text-ink-strong">{Number(selected.value_mgdl)}<span className="text-xs text-ink-muted ml-1 font-normal">mg/dL</span></div>
                  <div className="text-[11px] text-ink-muted">≈ {(Number(selected.value_mgdl) / 18.0182).toFixed(1)} mmol/L</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('bs.meal_label')}</div>
                    <div className="text-sm font-semibold text-ink-strong">{t(`forms.bs_meal_${selected.meal_context}`)}</div>
                  </div>
                  {selected.method && (
                    <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('bs.method_label')}</div>
                      <div className="text-sm font-semibold text-ink-strong">{t(`forms.bs_method_${selected.method}`)}</div>
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
        pageScope="blood_sugar_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

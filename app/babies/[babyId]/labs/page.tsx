import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
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
import { FlaskConical, Plus, Edit3, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Labs & Scans' };

type PanelKind = 'blood' | 'urine' | 'stool' | 'culture' | 'imaging' | 'genetic' | 'other'
  | 'xray' | 'mri' | 'ct' | 'ultrasound' | 'ekg';
const PANEL_KINDS: PanelKind[] = [
  'blood', 'urine', 'stool', 'culture', 'genetic',
  'xray', 'ultrasound', 'mri', 'ct', 'ekg', 'imaging',
  'other',
];

const PANEL_LABEL: Record<PanelKind, string> = {
  blood: 'Blood', urine: 'Urine', stool: 'Stool', culture: 'Culture', genetic: 'Genetic',
  xray: 'X-ray', mri: 'MRI', ct: 'CT scan', ultrasound: 'Ultrasound', ekg: 'EKG',
  imaging: 'Imaging', other: 'Other',
};

type Panel = {
  id: string;
  panel_kind: string;
  panel_name: string;
  result_at: string;
  sample_at: string | null;
  lab_name: string | null;
  summary: string | null;
  abnormal: boolean;
  is_prenatal: boolean | null;
  created_at: string;
};

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function LabsList({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const t = tFor((await loadUserPrefs(supabase)).language);
  const range = parseRangeParam(searchParams);

  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean) as PanelKind[];
  const activeTypes: PanelKind[] = rawTypes.filter((t): t is PanelKind => PANEL_KINDS.includes(t));
  const typeFilterActive = activeTypes.length > 0 && activeTypes.length < PANEL_KINDS.length;

  const perms = await assertRole(params.babyId, { requireLogs: true });

  let query = supabase.from('lab_panels')
    .select('id,panel_kind,panel_name,result_at,sample_at,lab_name,summary,abnormal,is_prenatal,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('result_at', range.start).lte('result_at', range.end);
  if (typeFilterActive) query = query.in('panel_kind', activeTypes);

  const { data: rowsData } = await query.order('result_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Panel[];

  const abnormalCount = rows.filter(r => r.abnormal).length;

  // Group rows by day
  const buckets = new Map<string, Panel[]>();
  for (const r of rows) {
    const k = localDayKey(r.result_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.result_at), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('page.overview')}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="peach"
        title={t('trackers.labs_title')}
        subtitle={t('trackers.labs_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="lab_panels" timeColumn="result_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('trackers.labs_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/medical-profile/labs/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-peach-500 to-coral-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.labs_cta')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Type"
          options={PANEL_KINDS.map(t => ({ key: t, label: PANEL_LABEL[t] }))}
          activeKeys={activeTypes}
          baseHref={`/babies/${params.babyId}/labs`}
          extraParams={{ range: range.key }} />
        {abnormalCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold bg-coral-50 text-coral-700">
            <AlertTriangle className="h-3 w-3" /> {abnormalCount} abnormal
          </span>
        )}
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
                {g.list.map(p => {
                  const active = selected?.id === p.id;
                  const tint = p.abnormal ? 'bg-coral-100 text-coral-600' : 'bg-peach-100 text-peach-600';
                  const kindLabel = PANEL_LABEL[p.panel_kind as PanelKind] ?? p.panel_kind;
                  const subline = [kindLabel, p.lab_name].filter(Boolean).join(' · ');
                  return (
                    <li key={p.id}>
                      <Link href={`/babies/${params.babyId}/labs?range=${range.key}&id=${p.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-peach-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(p.result_at)}
                          </div>
                        </div>
                        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${tint}`}>
                          <FlaskConical className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{p.panel_name}</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {p.abnormal && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-100 px-1.5 py-0.5 rounded">Abnormal</span>
                          )}
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
              <h3 className="text-sm font-bold text-ink-strong">Lab details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/medical-profile/labs/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="lab_panels" id={selected.id} />
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
                  <span className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${selected.abnormal ? 'bg-coral-100 text-coral-600' : 'bg-peach-100 text-peach-600'}`}>
                    <FlaskConical className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong">{selected.panel_name}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.result_at)}
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-peach-50 text-peach-700">
                    {PANEL_LABEL[selected.panel_kind as PanelKind] ?? selected.panel_kind}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selected.abnormal && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-100 px-2 py-0.5 rounded">Abnormal</span>
                  )}
                  {selected.is_prenatal && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-lavender-700 bg-lavender-100 px-2 py-0.5 rounded">Prenatal</span>
                  )}
                </div>

                {(selected.lab_name || selected.sample_at) && (
                  <div className="grid grid-cols-2 gap-2">
                    {selected.lab_name && (
                      <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">Lab</div>
                        <div className="text-sm font-bold text-ink-strong leading-tight">{selected.lab_name}</div>
                      </div>
                    )}
                    {selected.sample_at && (
                      <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Sampled</div>
                        <div className="text-sm font-bold text-ink-strong leading-tight">{fmtDate(selected.sample_at)}</div>
                      </div>
                    )}
                  </div>
                )}

                {selected.summary && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Summary</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.summary}</p>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Logged on</div>
                  <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="labs_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

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
import { Heart, Plus, Edit3, ArrowRight, Clock } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';
import { loadAuditSignatures } from '@/lib/audit';
import { AuditFooter } from '@/components/AuditFooter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Maternal symptoms' };

type SymptomRow = {
  id: string;
  logged_at: string;
  kind: string;
  severity: number;
  notes: string | null;
  created_at: string;
};

type Kind =
  | 'nausea' | 'vomiting' | 'dizziness' | 'headache' | 'swelling'
  | 'contractions' | 'fatigue' | 'heartburn' | 'back_pain'
  | 'mood_swings' | 'cramping' | 'breathlessness' | 'other';

const KIND_EMOJI: Record<string, string> = {
  nausea: '🤢', vomiting: '🤮', dizziness: '😵‍💫', headache: '🤕',
  swelling: '🦶', contractions: '💥', fatigue: '😴', heartburn: '🔥',
  back_pain: '🩹', mood_swings: '🎭', cramping: '⚡', breathlessness: '🫁',
  other: '✏️',
};

function kindLabel(k: string, t: TFunc): string {
  return t(`forms.symp_${k}`) || k.replace(/_/g, ' ');
}

function severityLabel(s: number, t: TFunc): string {
  return t(`forms.sev_${Math.max(1, Math.min(5, s))}`);
}

function severityTint(s: number): string {
  if (s >= 4) return 'bg-coral-100 text-coral-700';
  if (s === 3) return 'bg-peach-100 text-peach-700';
  return 'bg-mint-100 text-mint-700';
}

function groupHeading(iso: string, t: TFunc): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `${t('prenatal.today_prefix')}${fmtDate(iso)}`;
  if (k === y)     return `${t('prenatal.yesterday_prefix')}${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function SymptomsList({
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

  const { data: rowsData } = await supabase.from('maternal_symptoms')
    .select('id,logged_at,kind,severity,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('logged_at', range.start).lte('logged_at', range.end)
    .order('logged_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as SymptomRow[];

  // Audit signatures for the visible rows (created_by name + last edit info).
  const auditMap = await loadAuditSignatures(supabase, 'maternal_symptoms', rows.map(r => r.id));

  // Group rows by day
  const buckets = new Map<string, SymptomRow[]>();
  for (const r of rows) {
    const k = localDayKey(r.logged_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.logged_at, t), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={t('prenatal.back_label')}
        eyebrow={t('prenatal.eyebrow')} eyebrowTint="lavender"
        title={t('symptoms.title')}
        subtitle={t('symptoms.subtitle')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="maternal_symptoms" timeColumn="logged_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('symptoms.title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/prenatal/symptoms/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-coral-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('symptoms.add')}
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
              {t('symptoms.none')}
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
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/prenatal/symptoms?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[60px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.logged_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-lavender-600 text-xl">
                          {KIND_EMOJI[r.kind] ?? '✏️'}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate capitalize">{kindLabel(r.kind, t)}</div>
                          <div className="text-xs text-ink-muted truncate">{severityLabel(r.severity, t)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${severityTint(r.severity)}`}>
                            {r.severity}/5
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
              <h3 className="text-sm font-bold text-ink-strong">{t('symptoms.details')}</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/prenatal/symptoms/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> {t('prenatal.common_edit')}
                  </Link>
                  <LogRowDelete table="maternal_symptoms" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                {t('prenatal.common_pick')}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 rounded-xl grid place-items-center shrink-0 bg-lavender-100 text-2xl">
                    {KIND_EMOJI[selected.kind] ?? '✏️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong capitalize">{kindLabel(selected.kind, t)}</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.logged_at)}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${severityTint(selected.severity)}`}>
                    {selected.severity}/5
                  </span>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('symptoms.severity_label')}</div>
                  <div className="mt-0.5 text-sm font-semibold text-ink-strong">{severityLabel(selected.severity, t)}</div>
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
        pageScope="maternal_symptoms_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

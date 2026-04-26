import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogTypeFilter } from '@/components/LogTypeFilter';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import { assertRole } from '@/lib/role-guard';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';
import { Sparkline } from '@/components/Sparkline';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime, todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { fmtKg, fmtCm } from '@/lib/units';
import {
  Scale, Ruler, CircleDot, Plus, Edit3, Sparkles,
  ArrowRight, Clock, TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Measurements' };

type Row = {
  id: string;
  measured_at: string;
  weight_kg: number | string | null;
  height_cm: number | string | null;
  head_circ_cm: number | string | null;
  notes: string | null;
  source: string;
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

const MEAS_KINDS = ['weight','height','head'] as const;
type MeasKind = typeof MEAS_KINDS[number];

export default async function MeasurementsLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const t = tFor((await loadUserPrefs(supabase)).language);
  const range = parseRangeParam(searchParams);
  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const activeKinds = rawTypes.filter((t): t is MeasKind => (MEAS_KINDS as readonly string[]).includes(t));
  const typeFilter = activeKinds.length > 0 && activeKinds.length < MEAS_KINDS.length;
  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies').select('id,name,birth_weight_kg,birth_height_cm').eq('id', params.babyId).single();
  if (!baby) notFound();

  const [{ data: rowsData }, { data: allRows }] = await Promise.all([
    supabase.from('measurements')
      .select('id,measured_at,weight_kg,height_cm,head_circ_cm,notes,source,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('measured_at', range.start).lte('measured_at', range.end)
      .order('measured_at', { ascending: false }).limit(200),
    supabase.from('measurements')
      .select('measured_at,weight_kg,height_cm,head_circ_cm')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('measured_at', { ascending: true }).limit(500),
  ]);

  const rowsAll = (rowsData ?? []) as Row[];
  const rows = typeFilter
    ? rowsAll.filter(r => activeKinds.some(k =>
        (k === 'weight' && r.weight_kg != null) ||
        (k === 'height' && r.height_cm != null) ||
        (k === 'head'   && r.head_circ_cm != null)
      ))
    : rowsAll;
  const all  = (allRows ?? []) as Row[];

  const weightSpark = all.map(r => r.weight_kg != null ? Number(r.weight_kg) : NaN).filter(n => Number.isFinite(n));
  const heightSpark = all.map(r => r.height_cm != null ? Number(r.height_cm) : NaN).filter(n => Number.isFinite(n));
  const headSpark   = all.map(r => r.head_circ_cm != null ? Number(r.head_circ_cm) : NaN).filter(n => Number.isFinite(n));

  const latest = all[all.length - 1] ?? null;
  const latestWeight = latest?.weight_kg != null ? Number(latest.weight_kg) : null;
  const latestHeight = latest?.height_cm != null ? Number(latest.height_cm) : null;
  const latestHead   = latest?.head_circ_cm != null ? Number(latest.head_circ_cm) : null;

  const birthW = baby.birth_weight_kg ? Number(baby.birth_weight_kg) : null;
  const birthH = baby.birth_height_cm ? Number(baby.birth_height_cm) : null;
  const dWeight = latestWeight != null && birthW != null ? latestWeight - birthW : null;
  const dHeight = latestHeight != null && birthH != null ? latestHeight - birthH : null;

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.measured_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.measured_at), list }));
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('trackers.track_eyebrow')} eyebrowTint="brand"
        title={t('trackers.meas_title')}
        subtitle={t('trackers.meas_sub')}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="measurements" timeColumn="measured_at"
                visibleIds={rows.map(r => r.id)} kindLabel={t('trackers.meas_title').toLowerCase()} />
              <Link href={`/babies/${params.babyId}/measurements/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> {t('trackers.meas_cta')}
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">{t('page.read_only')}</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Includes"
          options={[
            { key: 'weight', label: 'Weight' },
            { key: 'height', label: 'Height' },
            { key: 'head',   label: 'Head' },
          ]}
          activeKeys={activeKinds}
          baseHref={`/babies/${params.babyId}/measurements`}
          extraParams={{ range: range.key }} />
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
                  const bits = [
                    r.weight_kg != null ? fmtKg(r.weight_kg) : null,
                    r.height_cm != null ? fmtCm(r.height_cm) : null,
                    r.head_circ_cm != null ? `head ${fmtCm(r.head_circ_cm)}` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/measurements?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-brand-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.measured_at)}</div>
                        </div>
                        <span className="h-10 w-10 rounded-xl bg-brand-100 text-brand-600 grid place-items-center shrink-0">
                          <Scale className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{bits || 'measurement'}</div>
                          {r.notes && <div className="text-xs text-ink-muted truncate">{r.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
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
              <h3 className="text-sm font-bold text-ink-strong">Measurement details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/measurements/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="measurements" id={selected.id} />
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick a measurement from the list.</div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-brand-100 text-brand-600 grid place-items-center shrink-0">
                    <Scale className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong">Measurement</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.measured_at)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.weight_kg != null && (
                    <MStat icon={Scale}      tint="brand"    label="Weight" value={fmtKg(selected.weight_kg)} />
                  )}
                  {selected.height_cm != null && (
                    <MStat icon={Ruler}      tint="mint"     label="Height" value={fmtCm(selected.height_cm)} />
                  )}
                  {selected.head_circ_cm != null && (
                    <MStat icon={CircleDot}  tint="lavender" label="Head circ" value={fmtCm(selected.head_circ_cm)} />
                  )}
                </div>
                {selected.notes && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Notes</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('trackers.logged_on')}</div>
                  <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-mint-50 border border-mint-200 p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-xl bg-mint-500 text-white grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-mint-900">Growth so far</div>
              <div className="text-xs text-mint-900/90">
                {dWeight == null && dHeight == null
                  ? 'Log a measurement and set birth stats to see growth deltas.'
                  : `${dWeight != null ? `+${dWeight.toFixed(2)} kg` : '—'}${dWeight != null && dHeight != null ? ' · ' : ''}${dHeight != null ? `+${dHeight.toFixed(1)} cm` : ''} since birth`}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-strong">Growth trend</h3>
              <TrendingUp className="h-4 w-4 text-ink-muted" />
            </div>
            <TrendRow label="Weight" latest={latestWeight != null ? fmtKg(latestWeight) : '—'} spark={weightSpark} color="#B9A7D8" />
            <div className="h-3" />
            <TrendRow label="Height" latest={latestHeight != null ? fmtCm(latestHeight) : '—'} spark={heightSpark} color="#7FC8A9" />
            <div className="h-3" />
            <TrendRow label="Head circ" latest={latestHead != null ? fmtCm(latestHead) : '—'} spark={headSpark} color="#F4A6A6" />
          </section>
        </div>
      </div>
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="measurements_list" title={t('page.page_comments')} />
    </PageShell>
  );
}

function MStat({ icon: Icon, tint, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'brand' | 'mint' | 'lavender' | 'coral' | 'peach';
  label: string;
  value: React.ReactNode;
}) {
  const map = {
    brand:    'bg-brand-50 border-brand-100',
    mint:     'bg-mint-50 border-mint-100',
    lavender: 'bg-lavender-50 border-lavender-100',
    coral:    'bg-coral-50 border-coral-100',
    peach:    'bg-peach-50 border-peach-100',
  }[tint];
  const iconClr = {
    brand:    'text-brand-600',
    mint:     'text-mint-600',
    lavender: 'text-lavender-600',
    coral:    'text-coral-600',
    peach:    'text-peach-600',
  }[tint];
  return (
    <div className={`rounded-xl border px-3 py-2 ${map}`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconClr}`} />
        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</span>
      </div>
      <div className="text-base font-bold text-ink-strong leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function TrendRow({ label, latest, spark, color }: { label: string; latest: string; spark: number[]; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-sm font-bold text-ink-strong">{latest}</div>
      </div>
      <div className="mt-1">
        <Sparkline data={spark.length ? spark : [0]} color={color} width={280} height={36} strokeWidth={2} />
      </div>
    </div>
  );
}

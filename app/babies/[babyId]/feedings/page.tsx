import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogTypeFilter } from '@/components/LogTypeFilter';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import {
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime,
  lastNDaysWindow, todayLocalDate,
} from '@/lib/dates';
import { fmtMl } from '@/lib/units';
import {
  Milk, Baby as BabyIcon, Cookie, Plus, Edit3, Sparkles,
  ArrowRight, Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedings' };

type Row = {
  id: string;
  feeding_time: string;
  milk_type: 'breast' | 'formula' | 'mixed' | 'solid' | 'other';
  quantity_ml: number | null;
  duration_min: number | null;
  kcal: number | null;
  source: string;
  notes: string | null;
  created_at: string;
};

const ICON_FOR: Record<Row['milk_type'], { icon: React.ComponentType<{ className?: string }>; tint: string; label: string; dotBg: string; chipTint: string }> = {
  breast:  { icon: BabyIcon, tint: 'bg-coral-100 text-coral-600',    label: 'Breastfeeding', dotBg: 'bg-coral-500',    chipTint: 'bg-coral-50 text-coral-700' },
  formula: { icon: Milk,     tint: 'bg-brand-100 text-brand-600',    label: 'Bottle · Formula', dotBg: 'bg-brand-500', chipTint: 'bg-brand-50 text-brand-700' },
  mixed:   { icon: Milk,     tint: 'bg-peach-100 text-peach-600',    label: 'Mixed',          dotBg: 'bg-peach-500',  chipTint: 'bg-peach-50 text-peach-700' },
  solid:   { icon: Cookie,   tint: 'bg-mint-100 text-mint-600',      label: 'Solid',          dotBg: 'bg-mint-500',   chipTint: 'bg-mint-50 text-mint-700' },
  other:   { icon: Milk,     tint: 'bg-lavender-100 text-lavender-600', label: 'Other',       dotBg: 'bg-lavender-500', chipTint: 'bg-lavender-50 text-lavender-700' },
};

function groupKey(iso: string): string {
  // YYYY-MM-DD in local day for bucket headers
  return new Date(iso).toISOString().slice(0, 10);
}

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const k = groupKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

function breastBits(notes: string | null, durationMin: number | null): string {
  // The FeedingForm stores breast minutes as "Left X min · Right Y min" in notes
  if (notes && /left|right/i.test(notes)) return notes.split('\n')[0]!;
  if (durationMin) return `${durationMin} min session`;
  return 'breastfeeding';
}

/** Parse "Left 12 min · Right 8 min" → { left: 12, right: 8 }. */
function parseBreast(notes: string | null): { left: number | null; right: number | null } {
  if (!notes) return { left: null, right: null };
  const l = /left\s*(\d+)\s*min/i.exec(notes);
  const r = /right\s*(\d+)\s*min/i.exec(notes);
  return { left: l ? Number(l[1]) : null, right: r ? Number(r[1]) : null };
}

type MilkType = 'breast' | 'formula' | 'mixed' | 'solid' | 'other';
const MILK_TYPES: MilkType[] = ['breast', 'formula', 'mixed', 'solid', 'other'];

export default async function FeedingsLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string; type?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  // Kind filter — accepts a single `type=` or comma-separated list. Empty = all.
  const rawTypes = (searchParams.type ?? '').split(',').map(s => s.trim()).filter(Boolean) as MilkType[];
  const activeTypes: MilkType[] = rawTypes.filter((t): t is MilkType => MILK_TYPES.includes(t));
  const typeFilterActive = activeTypes.length > 0 && activeTypes.length < MILK_TYPES.length;

  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  let feedQuery = supabase.from('feedings')
    .select('id,feeding_time,milk_type,quantity_ml,duration_min,kcal,source,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('feeding_time', range.start).lte('feeding_time', range.end);
  if (typeFilterActive) feedQuery = feedQuery.in('milk_type', activeTypes);

  const [{ data: rowsData }, { data: todayData }] = await Promise.all([
    feedQuery.order('feeding_time', { ascending: false }).limit(500),
    (async () => {
      const w = dayWindow(todayLocalDate());
      return supabase.from('feedings')
        .select('id,milk_type,quantity_ml,duration_min')
        .eq('baby_id', params.babyId).is('deleted_at', null)
        .gte('feeding_time', w.start).lt('feeding_time', w.end);
    })(),
  ]);

  const rows = (rowsData ?? []) as Row[];
  const todays = (todayData ?? []) as { milk_type: string; quantity_ml: number | null; duration_min: number | null }[];

  // Today summary
  const todayBreasts = todays.filter(r => r.milk_type === 'breast');
  const todayTotalVolume = todays.reduce((a, r) => a + Number(r.quantity_ml || 0), 0);
  const todayBreastMin   = todayBreasts.reduce((a, r) => a + Number(r.duration_min || 0), 0);

  // Group rows by day
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r.feeding_time);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.feeding_time), list }));

  // Selection (detail panel)
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Feedings" eyebrowTint="peach"
        title="Feeding Log"
        subtitle={`All recorded feedings for ${baby.name}.`}
        right={
          <div className="flex items-center gap-2">
            <BulkDelete babyId={params.babyId} table="feedings" timeColumn="feeding_time"
              visibleIds={rows.map(r => r.id)} kindLabel="feedings" />
            <Link href={`/babies/${params.babyId}/feedings/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-peach-500 to-coral-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Log feed
            </Link>
          </div>
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
        <LogTypeFilter label="Type"
          options={MILK_TYPES.map(t => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          activeKeys={activeTypes}
          baseHref={`/babies/${params.babyId}/feedings`}
          extraParams={{ range: range.key }} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        {/* LIST */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">
              No feedings in this window.
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const style = ICON_FOR[r.milk_type];
                  const active = selected?.id === r.id;
                  const breast = r.milk_type === 'breast' ? parseBreast(r.notes) : null;
                  const title = r.milk_type === 'breast'
                    ? 'Breastfeeding'
                    : r.milk_type === 'formula' ? 'Bottle · Formula'
                    : r.milk_type === 'solid' ? 'Solid'
                    : r.milk_type === 'mixed' ? 'Mixed' : 'Other';
                  const line = r.milk_type === 'breast' && breast
                    ? [breast.left != null ? `Left ${breast.left} min` : null, breast.right != null ? `Right ${breast.right} min` : null].filter(Boolean).join('  ·  ') || breastBits(r.notes, r.duration_min)
                    : r.notes || (r.milk_type === 'formula' ? 'Similac Advance' : '');
                  const amount = r.duration_min
                    ? `${r.duration_min} min`
                    : r.quantity_ml
                      ? fmtMl(r.quantity_ml)
                      : '—';
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/feedings?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                        {/* Time col */}
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.feeding_time)}
                          </div>
                          <div className="text-[10px] text-ink-muted uppercase tracking-wider">
                            {new Date(r.feeding_time).getHours() >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                        {/* Icon */}
                        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${style.tint}`}>
                          <style.icon className="h-5 w-5" />
                        </span>
                        {/* Title + subline */}
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">{title}</div>
                          {line && <div className="text-xs text-ink-muted truncate">{line}</div>}
                        </div>
                        {/* Amount */}
                        <div className="text-right flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{amount}</span>
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

        {/* DETAIL + INSIGHT + SUMMARY */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* Detail card */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-ink-strong">Feeding Details</h3>
              {selected && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/feedings/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="feedings" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                Pick a feed from the list to see details.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {(() => {
                  const style = ICON_FOR[selected.milk_type];
                  const breast = selected.milk_type === 'breast' ? parseBreast(selected.notes) : null;
                  const title = selected.milk_type === 'breast' ? 'Breastfeeding'
                    : selected.milk_type === 'formula' ? 'Bottle · Formula'
                    : selected.milk_type === 'solid' ? 'Solid'
                    : selected.milk_type === 'mixed' ? 'Mixed' : 'Other';
                  const headChip = selected.duration_min
                    ? `${selected.duration_min} min`
                    : selected.quantity_ml ? fmtMl(selected.quantity_ml) : '';
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <span className={`h-11 w-11 rounded-xl grid place-items-center shrink-0 ${style.tint}`}>
                          <style.icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink-strong">{title}</div>
                          <div className="text-xs text-ink-muted flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtDateTime(selected.feeding_time)}
                          </div>
                        </div>
                        {headChip && (
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.chipTint}`}>
                            {headChip}
                          </span>
                        )}
                      </div>

                      {selected.milk_type === 'breast' && breast && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">Left breast</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{breast.left ?? '—'}<span className="text-xs text-ink-muted ml-1 font-normal">min</span></div>
                          </div>
                          <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">Right breast</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{breast.right ?? '—'}<span className="text-xs text-ink-muted ml-1 font-normal">min</span></div>
                          </div>
                        </div>
                      )}

                      {(selected.milk_type !== 'breast' && (selected.quantity_ml || selected.kcal)) && (
                        <div className="grid grid-cols-2 gap-2">
                          {selected.quantity_ml != null && (
                            <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Volume</div>
                              <div className="text-xl font-bold text-ink-strong leading-tight">{fmtMl(selected.quantity_ml)}</div>
                            </div>
                          )}
                          {selected.kcal != null && (
                            <div className="rounded-xl bg-peach-50 border border-peach-100 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-wider text-peach-700 font-semibold">Energy</div>
                              <div className="text-xl font-bold text-ink-strong leading-tight">{selected.kcal}<span className="text-xs text-ink-muted ml-1 font-normal">kcal</span></div>
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

                      <div className="border-t border-slate-100 pt-3">
                        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Logged on</div>
                        <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Insight banner */}
          <section className="rounded-2xl bg-peach-50 border border-peach-200 p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-xl bg-peach-500 text-white grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-peach-900">Insight</div>
              <div className="text-xs text-peach-900/90">
                {todayBreasts.length === 0
                  ? `No breastfeeding logged today yet.`
                  : `Great job! You've breastfed ${todayBreasts.length} time${todayBreasts.length === 1 ? '' : 's'} today.`}
              </div>
              <Link href={`/babies/${params.babyId}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-peach-800 font-semibold hover:underline">
                View insights <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>

          {/* Summary */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-strong">Summary (Today)</h3>
            </div>
            <ul className="space-y-2 text-sm">
              <SummaryRow icon={Milk}     tint="lavender" label="Total feedings" value={todays.length} />
              <SummaryRow icon={Milk}     tint="mint"     label="Total volume"   value={fmtMl(todayTotalVolume)} />
              <SummaryRow icon={BabyIcon} tint="coral"    label="Breastfeeding time" value={`${todayBreastMin} min`} />
            </ul>
          </section>

          <LastNDaysHint />
        </div>
      </div>
    </PageShell>
  );
}

function SummaryRow({ icon: Icon, tint, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'lavender' | 'mint' | 'coral' | 'peach' | 'brand';
  label: string;
  value: React.ReactNode;
}) {
  const map = {
    lavender: 'bg-lavender-100 text-lavender-700',
    mint:     'bg-mint-100 text-mint-700',
    coral:    'bg-coral-100 text-coral-700',
    peach:    'bg-peach-100 text-peach-700',
    brand:    'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <li className="flex items-center gap-3">
      <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${map}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="font-bold text-ink-strong">{value}</span>
    </li>
  );
}

function LastNDaysHint() {
  // Helpful tiny reminder explaining that Today summary is local TZ.
  const n = lastNDaysWindow(7);
  return (
    <p className="text-[10px] text-ink-muted px-2">
      Today bucket uses Africa/Cairo time. Last 7-day window: {new Date(n.start).toLocaleDateString()} — now.
    </p>
  );
}

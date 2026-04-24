import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import {
  parseRangeParam, dayWindow, fmtDate, fmtTime, fmtDateTime, todayLocalDate,
} from '@/lib/dates';
import { fmtMl } from '@/lib/units';
import {
  Droplet, Plus, Filter, Edit3, Trash2, Sparkles, ArrowRight, Clock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Stool' };

type Row = {
  id: string;
  stool_time: string;
  quantity_category: 'small' | 'medium' | 'large' | null;
  quantity_ml: number | null;
  color: string | null;
  consistency: string | null;
  has_diaper_rash: boolean | null;
  source: string;
  notes: string | null;
  created_at: string;
};

function groupKey(iso: string) { return new Date(iso).toISOString().slice(0, 10); }
function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const k = groupKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

const SIZE_CHIP: Record<string, string> = {
  small:  'bg-mint-50 text-mint-700',
  medium: 'bg-brand-50 text-brand-700',
  large:  'bg-lavender-50 text-lavender-700',
};

export default async function StoolLog({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const [{ data: rowsData }, { data: todayData }] = await Promise.all([
    supabase.from('stool_logs')
      .select('id,stool_time,quantity_category,quantity_ml,color,consistency,has_diaper_rash,source,notes,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('stool_time', range.start).lte('stool_time', range.end)
      .order('stool_time', { ascending: false }).limit(500),
    (async () => {
      const w = dayWindow(todayLocalDate());
      return supabase.from('stool_logs')
        .select('id,quantity_category,has_diaper_rash')
        .eq('baby_id', params.babyId).is('deleted_at', null)
        .gte('stool_time', w.start).lt('stool_time', w.end);
    })(),
  ]);

  const rows = (rowsData ?? []) as Row[];
  const todays = (todayData ?? []) as { quantity_category: string | null; has_diaper_rash: boolean | null }[];
  const todaySmall = todays.filter(r => r.quantity_category === 'small').length;
  const todayMedium = todays.filter(r => r.quantity_category === 'medium').length;
  const todayLarge  = todays.filter(r => r.quantity_category === 'large').length;
  const todayRash = todays.filter(r => r.has_diaper_rash).length;

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = groupKey(r.stool_time);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({ k, heading: groupHeading(list[0]!.stool_time), list }));
  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Stool & diaper" eyebrowTint="mint"
        title="Stool Log"
        subtitle={`All recorded diaper changes for ${baby.name}.`}
        right={
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
              <Filter className="h-4 w-4" /> Filter
            </button>
            <Link href={`/babies/${params.babyId}/stool/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mint-500 to-mint-600 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Log stool
            </Link>
          </div>
        } />

      <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">No stool logs in this window.</div>
          )}
          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const cat = (r.quantity_category ?? 'small');
                  const chip = SIZE_CHIP[cat] ?? SIZE_CHIP.small;
                  const line = [r.color, r.consistency, r.quantity_ml ? fmtMl(r.quantity_ml) : null].filter(Boolean).join(' · ');
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/stool?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-mint-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">{fmtTime(r.stool_time)}</div>
                          <div className="text-[10px] text-ink-muted uppercase tracking-wider">
                            {new Date(r.stool_time).getHours() >= 12 ? 'PM' : 'AM'}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-mint-100 text-mint-600">
                          <Droplet className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate capitalize">{cat} stool{r.has_diaper_rash ? ' · 🌡️ rash' : ''}</div>
                          {line && <div className="text-xs text-ink-muted truncate">{line}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize whitespace-nowrap ${chip}`}>{cat}</span>
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
              <h3 className="text-sm font-bold text-ink-strong">Stool Details</h3>
              {selected && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/stool/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 bg-white text-coral-600" aria-hidden>
                    <Trash2 className="h-3 w-3" />
                  </span>
                </div>
              )}
            </div>
            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">Pick an entry from the list.</div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-mint-100 text-mint-600 grid place-items-center shrink-0">
                    <Droplet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong capitalize">{selected.quantity_category ?? 'stool'} stool</div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.stool_time)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {selected.color && (
                    <Stat label="Color" value={selected.color} tint="mint" />
                  )}
                  {selected.consistency && (
                    <Stat label="Consistency" value={selected.consistency} tint="brand" />
                  )}
                  {selected.quantity_ml != null && (
                    <Stat label="Volume" value={fmtMl(selected.quantity_ml)} tint="lavender" />
                  )}
                  {selected.has_diaper_rash && (
                    <Stat label="Diaper rash" value="Yes" tint="coral" />
                  )}
                </div>
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
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-peach-50 border border-peach-200 p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-xl bg-peach-500 text-white grid place-items-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-peach-900">Insight</div>
              <div className="text-xs text-peach-900/90">
                {todays.length === 0
                  ? `No diaper changes logged today yet.`
                  : `You've logged ${todays.length} diaper${todays.length === 1 ? '' : 's'} today — keep the rhythm.`}
                {todayRash > 0 && ` ${todayRash} with rash noted.`}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">Summary (Today)</h3>
            <ul className="space-y-2 text-sm">
              <SumRow label="Total diapers" value={todays.length} tint="mint" />
              <SumRow label="Small" value={todaySmall} tint="mint" />
              <SumRow label="Medium" value={todayMedium} tint="brand" />
              <SumRow label="Large" value={todayLarge} tint="lavender" />
              {todayRash > 0 && <SumRow label="With rash" value={todayRash} tint="coral" />}
            </ul>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, value, tint }: { label: string; value: React.ReactNode; tint: 'mint'|'brand'|'lavender'|'coral'|'peach' }) {
  const map = {
    mint:     'bg-mint-50 border-mint-100',
    brand:    'bg-brand-50 border-brand-100',
    lavender: 'bg-lavender-50 border-lavender-100',
    coral:    'bg-coral-50 border-coral-100',
    peach:    'bg-peach-50 border-peach-100',
  }[tint];
  return (
    <div className={`rounded-xl border px-3 py-2 ${map}`}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{label}</div>
      <div className="text-base font-bold text-ink-strong leading-tight capitalize">{value}</div>
    </div>
  );
}

function SumRow({ label, value, tint }: { label: string; value: React.ReactNode; tint: 'mint'|'brand'|'lavender'|'coral'|'peach' }) {
  const map = {
    mint:     'bg-mint-100 text-mint-700',
    brand:    'bg-brand-100 text-brand-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    coral:    'bg-coral-100 text-coral-700',
    peach:    'bg-peach-100 text-peach-700',
  }[tint];
  return (
    <li className="flex items-center gap-3">
      <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 text-[11px] font-bold ${map}`}>
        {typeof value === 'number' ? value : '•'}
      </span>
      <span className="flex-1 text-ink">{label}</span>
      <span className="font-bold text-ink-strong">{value}</span>
    </li>
  );
}

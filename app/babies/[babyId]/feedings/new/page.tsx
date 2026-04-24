import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedingForm } from '@/components/forms/FeedingForm';
import { SummaryDonut } from '@/components/SummaryDonut';
import { dayWindow, fmtRelative, todayLocalDate, fmtDateTime } from '@/lib/dates';
import { fmtMl } from '@/lib/units';
import { ChevronLeft, Bell, BarChart3, Milk, Baby as BabyIcon, Utensils } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log a feeding' };

const COLORS = { breast: '#F4A6A6', bottle: '#7BAEDC', solid: '#F6C177' };

function labelFor(milk: string | null): string {
  if (milk === 'breast') return 'Breastfeeding';
  if (milk === 'formula') return 'Formula';
  if (milk === 'mixed')   return 'Mixed';
  if (milk === 'solid')   return 'Solid';
  return 'Bottle';
}

function iconFor(milk: string | null) {
  if (milk === 'breast') return BabyIcon;
  if (milk === 'solid')  return Utensils;
  return Milk;
}

function tintFor(milk: string | null): 'coral' | 'brand' | 'peach' {
  if (milk === 'breast') return 'coral';
  if (milk === 'solid')  return 'peach';
  return 'brand';
}

export default async function NewFeeding({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { start, end } = dayWindow(todayLocalDate());

  const [{ data: todayFeedings }, { data: recent }, { data: last }] = await Promise.all([
    supabase.from('feedings')
      .select('milk_type,quantity_ml')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .gte('feeding_time', start).lt('feeding_time', end),
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml,duration_min,notes')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('feeding_time', { ascending: false }).limit(4),
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml,duration_min')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('feeding_time', { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Build today's summary
  const buckets = { breast: 0, bottle: 0, solid: 0 };
  let totalMl = 0;
  ((todayFeedings ?? []) as { milk_type: string; quantity_ml: number | string | null }[]).forEach(r => {
    const ml = Number(r.quantity_ml) || 0;
    totalMl += ml;
    if (r.milk_type === 'breast')      buckets.breast += 1;
    else if (r.milk_type === 'solid')  buckets.solid  += 1;
    else                                buckets.bottle += 1;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      {/* Top row */}
      <div className="flex items-center justify-between mb-6">
        <Link href={`/babies/${params.babyId}`}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm text-ink hover:bg-slate-50 shadow-sm">
          <ChevronLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <button aria-label="Notifications"
          className="relative h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50">
          <Bell className="h-5 w-5 text-ink" />
        </button>
      </div>

      {/* Heading */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div className="relative">
          <h1 className="text-4xl font-bold tracking-tight text-ink-strong">
            Log a feeding <span role="img" aria-label="bottle">🍼</span>
          </h1>
          <p className="mt-2 text-ink">
            Breast, bottle or solid — the sooner logged, the more accurate your patterns.
          </p>
          {/* Floating cloud/sparkles */}
          <div className="absolute -top-2 right-0 translate-x-full hidden md:flex items-center gap-2 text-coral-400 pointer-events-none">
            <span className="text-2xl">✨</span>
            <span className="inline-block rounded-[18px] bg-white/80 px-4 py-1 text-xs text-ink-muted shadow-sm">☁️</span>
          </div>
        </div>
        <Link href={`/babies/${params.babyId}`}
          className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 shadow-sm">
          <BarChart3 className="h-4 w-4" /> View analytics
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Main form card */}
        <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          <FeedingForm babyId={params.babyId} />
        </div>

        {/* Right side panel */}
        <aside className="space-y-4">
          {/* Last feeding */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
            <div className="flex items-start gap-3">
              {(() => {
                const Icon = iconFor(last?.milk_type ?? null);
                const tint = tintFor(last?.milk_type ?? null);
                const bg = { coral: 'bg-coral-100 text-coral-600', brand: 'bg-brand-100 text-brand-600', peach: 'bg-peach-100 text-peach-600' }[tint];
                return (
                  <div className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${bg}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-ink-muted uppercase tracking-wider">Last feeding</div>
                {last ? (
                  <>
                    <div className="font-semibold text-ink-strong">{labelFor(last.milk_type)}</div>
                    <div className="text-xs text-ink-muted">{fmtDateTime(last.feeding_time)}</div>
                  </>
                ) : (
                  <div className="text-sm text-ink-muted">No feedings yet — this would be your first.</div>
                )}
              </div>
              {last && (
                <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-2.5 py-1 inline-flex items-center gap-1 shrink-0">
                  ⏱ {fmtRelative(last.feeding_time).replace('ago','').trim()} ago
                </span>
              )}
            </div>
          </div>

          {/* Today's summary */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink-strong">Today&apos;s summary</div>
              <span className="text-xs text-ink-muted">{(todayFeedings ?? []).length} feedings</span>
            </div>
            <div className="mt-3">
              <SummaryDonut
                centerLabel="Total"
                centerValue={fmtMl(totalMl)}
                segments={[
                  { label: 'Breastfeeding', value: buckets.breast, color: COLORS.breast },
                  { label: 'Bottle',        value: buckets.bottle, color: COLORS.bottle },
                  { label: 'Solid',         value: buckets.solid,  color: COLORS.solid  },
                ]}
              />
            </div>
          </div>

          {/* Recent feedings */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
            <div className="text-sm font-semibold text-ink-strong">Recent feedings</div>
            <ul className="mt-3 space-y-2">
              {(recent ?? []).length === 0 && (
                <li className="text-sm text-ink-muted">No feedings yet.</li>
              )}
              {recent?.map(r => {
                const Icon = iconFor(r.milk_type);
                const tint = tintFor(r.milk_type);
                const bg = { coral: 'bg-coral-100 text-coral-600', brand: 'bg-brand-100 text-brand-600', peach: 'bg-peach-100 text-peach-600' }[tint];
                return (
                  <li key={r.id} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${bg}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-medium text-ink-strong truncate">
                        {labelFor(r.milk_type)}
                      </div>
                      <div className="text-xs text-ink-muted truncate">
                        {r.duration_min ? `${r.duration_min} min` : r.quantity_ml ? `${fmtMl(r.quantity_ml)}` : '—'}
                      </div>
                    </div>
                    <span className="text-xs text-ink-muted">{fmtDateTime(r.feeding_time).split(' · ')[1] ?? ''}</span>
                  </li>
                );
              })}
            </ul>
            <Link href={`/babies/${params.babyId}/feedings`}
              className="mt-3 w-full inline-flex items-center justify-center gap-1 rounded-xl bg-brand-50 text-brand-700 font-medium py-2 text-sm hover:bg-brand-100">
              View full history →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

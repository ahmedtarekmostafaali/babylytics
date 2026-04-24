import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BabyHeader } from '@/components/BabyHeader';
import { KpiCard } from '@/components/KpiCard';
import { ActivityTile } from '@/components/ActivityTile';
import { FeedingChart } from '@/components/FeedingChart';
import { WeightChart } from '@/components/WeightChart';
import { StoolChart } from '@/components/StoolChart';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fmtDate, fmtDateTime, fmtRelative, parseRangeParam } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg } from '@/lib/units';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { Comments } from '@/components/Comments';
import {
  Milk, Target, TrendingDown, Percent, Droplet, Droplets, Pill, Scale, Moon, ArrowRight,
  Thermometer, Syringe,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('babies').select('name').eq('id', params.babyId).single();
  return { title: data?.name ? `${data.name} · Overview` : 'Baby overview' };
}

export default async function BabyPage({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();
  const babyId = params.babyId;
  const range = parseRangeParam(searchParams);

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,feeding_factor_ml_per_kg_per_day,avatar_path')
    .eq('id', babyId).is('deleted_at', null).single();
  if (!baby) notFound();
  const avatarUrl = await signAvatarUrl(supabase, baby.avatar_path);

  const seriesDays = Math.min(Math.max(range.days, 14), 90);

  const [
    feedingKpi, stoolKpi, medicationKpi,
    feedingSeries, stoolSeries, weightSeries,
    currentWeight,
    lastFeed, lastStool, lastMeasurement, lastDose,
    lowConf, activeMeds,
    tempWindow, lastTemp,
    upcomingVaccines, administeredVaccines,
  ] = await Promise.all([
    supabase.rpc('feeding_kpis',         { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('stool_kpis',           { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('medication_kpis',      { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('daily_feeding_series', { p_baby: babyId, p_days: seriesDays }),
    supabase.rpc('daily_stool_series',   { p_baby: babyId, p_days: seriesDays }),
    supabase.rpc('weight_trend',         { p_baby: babyId, p_days: 365 }),
    supabase.rpc('current_weight_kg',    { p_baby: babyId }),

    // "Most recent X" for activity tiles
    supabase.from('feedings').select('id,feeding_time,milk_type,quantity_ml').eq('baby_id', babyId).is('deleted_at', null).order('feeding_time', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('stool_logs').select('id,stool_time,quantity_category,quantity_ml,color').eq('baby_id', babyId).is('deleted_at', null).order('stool_time', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurements').select('id,measured_at,weight_kg,height_cm').eq('baby_id', babyId).is('deleted_at', null).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('medication_logs').select('id,medication_id,medication_time,status,actual_dosage').eq('baby_id', babyId).is('deleted_at', null).order('medication_time', { ascending: false }).limit(1).maybeSingle(),

    supabase.from('extracted_text')
      .select('id,file_id,confidence_score,created_at,status')
      .eq('baby_id', babyId).eq('status', 'extracted').eq('flag_low_confidence', true)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,starts_at,ends_at')
      .eq('baby_id', babyId).is('deleted_at', null)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('starts_at', { ascending: false }),

    // Temperature readings in the current range
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c,method')
      .eq('baby_id', babyId).is('deleted_at', null)
      .gte('measured_at', range.start).lt('measured_at', range.end)
      .order('measured_at', { ascending: false }),
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c,method')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('measured_at', { ascending: false }).limit(1).maybeSingle(),

    // Vaccinations
    supabase.from('vaccinations')
      .select('id,vaccine_name,scheduled_at,dose_number,total_doses,status')
      .eq('baby_id', babyId).is('deleted_at', null).eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true }).limit(3),
    supabase.from('vaccinations')
      .select('id,vaccine_name,administered_at,dose_number,total_doses,status')
      .eq('baby_id', babyId).is('deleted_at', null).eq('status', 'administered')
      .order('administered_at', { ascending: false }).limit(3),
  ]);

  const f = (feedingKpi.data    ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data      ?? {}) as { stool_count: number; total_ml: number; small_count: number; medium_count: number; large_count: number; last_stool_at: string | null };
  const m = (medicationKpi.data ?? {}) as { total_doses: number; taken: number; missed: number; adherence_pct: number };
  const w = currentWeight.data as number | null;

  const factor = Number(baby.feeding_factor_ml_per_kg_per_day ?? 150);
  const recommendedDaily = Number(f.recommended_feed_ml) || 0;
  const windowRecommended = Math.round(recommendedDaily * range.days);
  const totalMl = Number(f.total_feed_ml) || 0;
  const windowPct = windowRecommended > 0 ? Math.round((totalMl / windowRecommended) * 100) : 0;
  const windowRemaining = Math.max(0, windowRecommended - totalMl);

  // Sparkline data — last 14 days of feeding totals
  const feedingSparkData = ((feedingSeries.data ?? []) as { total_ml: number | string }[])
    .slice(-14).map(r => Number(r.total_ml));
  const stoolSparkData = ((stoolSeries.data ?? []) as { stool_count: number | string }[])
    .slice(-14).map(r => Number(r.stool_count));
  const weightSparkData = ((weightSeries.data ?? []) as { weight_kg: number | null }[])
    .filter(r => r.weight_kg != null).map(r => Number(r.weight_kg));

  // Last-feed/stool metadata for the activity tiles
  const lastFeedTitle = lastFeed.data
    ? `${fmtMl(lastFeed.data.quantity_ml)} · ${lastFeed.data.milk_type}`
    : 'Last feed';
  const lastFeedSub = lastFeed.data ? fmtDateTime(lastFeed.data.feeding_time) : 'log your first feeding';

  const lastStoolTitle = lastStool.data
    ? `${lastStool.data.quantity_category ?? 'stool'}${lastStool.data.quantity_ml ? ` · ${fmtMl(lastStool.data.quantity_ml)}` : ''}${lastStool.data.color ? ` · ${lastStool.data.color}` : ''}`
    : 'No stool yet';
  const lastStoolSub = lastStool.data ? fmtDateTime(lastStool.data.stool_time) : 'log your first entry';

  const lastDoseTitle = lastDose.data ? `Dose ${lastDose.data.status}` : 'No doses yet';
  const lastDoseSub = lastDose.data ? fmtDateTime(lastDose.data.medication_time) : 'add a prescription first';

  const lastMeasureTitle = lastMeasurement.data
    ? `${lastMeasurement.data.weight_kg ? fmtKg(lastMeasurement.data.weight_kg) : '—'}${lastMeasurement.data.height_cm ? ` · ${lastMeasurement.data.height_cm} cm` : ''}`
    : 'No measurements';
  const lastMeasureSub = lastMeasurement.data ? fmtDateTime(lastMeasurement.data.measured_at) : 'add one to unlock feeding targets';

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 space-y-7">
      <BabyHeader
        baby={baby as { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null }}
        currentWeightKg={w}
        avatarUrl={avatarUrl}
      />

      {lowConf.data && lowConf.data.length > 0 && (
        <div className="rounded-2xl border border-coral-300 bg-coral-50/80 p-4 text-sm shadow-card">
          <div className="font-semibold text-coral-700">
            {lowConf.data.length} OCR extraction{lowConf.data.length > 1 ? 's' : ''} need{lowConf.data.length === 1 ? 's' : ''} review
          </div>
          <p className="text-coral-700/90 mt-1">Low confidence — please confirm or edit the extracted values before they land in your logs.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {lowConf.data.map(x => (
              <Link key={x.id} href={`/babies/${babyId}/ocr/${x.id}`}
                className="rounded-full bg-coral-600 px-3 py-1 text-xs text-white hover:bg-coral-700">
                Review · {Math.round((Number(x.confidence_score) || 0) * 100)}%
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Today at a glance — Sophie-style colored activity tiles */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Today at a glance</h2>
          <span className="text-xs text-ink-muted hidden sm:inline">tap any card to add a new entry</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActivityTile
            href={`/babies/${babyId}/feedings/new`}
            icon={Milk}       tint="coral"
            title={lastFeedTitle} subtitle={lastFeedSub}
            time={lastFeed.data?.feeding_time ?? null}
            empty="Log a feed"
          />
          <ActivityTile
            href={`/babies/${babyId}/stool/new`}
            icon={Droplet}    tint="mint"
            title={lastStoolTitle} subtitle={lastStoolSub}
            time={lastStool.data?.stool_time ?? null}
            empty="Log a stool"
          />
          <ActivityTile
            href={`/babies/${babyId}/medications/log`}
            icon={Pill}       tint="lavender"
            title={lastDoseTitle} subtitle={lastDoseSub}
            time={lastDose.data?.medication_time ?? null}
            empty="Log a dose"
          />
          <ActivityTile
            href={`/babies/${babyId}/measurements/new`}
            icon={Scale}      tint="brand"
            title={lastMeasureTitle} subtitle={lastMeasureSub}
            time={lastMeasurement.data?.measured_at ?? null}
            empty="Log a measurement"
          />
        </div>
      </section>

      {/* KPI row with range filter */}
      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Analytics</h2>
            <div className="text-lg font-semibold text-ink-strong">{range.label}</div>
          </div>
          <DateRangeFilter currentKey={range.key} />
        </div>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KpiCard tint="peach" icon={Milk}   label="Total feed"
            value={fmtMl(f.total_feed_ml)} sub={`${f.feed_count ?? 0} feeds · avg ${fmtMl(f.avg_feed_ml)}`}
            spark={feedingSparkData} />
          <KpiCard tint="peach" icon={Target} label={`Recommended`}
            value={fmtMl(windowRecommended)} sub={w ? `${fmtKg(w)} × ${factor} ml/kg/day` : 'log a measurement'} />
          <KpiCard tint="peach" icon={TrendingDown} label="Remaining"
            value={fmtMl(windowRemaining)}
            tone={windowPct < 70 ? 'warning' : 'positive'} />
          <KpiCard tint="peach" icon={Percent} label="Feeding %"
            value={`${windowPct}%`}
            tone={windowPct >= 90 ? 'positive' : windowPct >= 70 ? 'neutral' : 'warning'}
            trend={windowPct >= 90 ? 'up' : windowPct < 70 ? 'down' : undefined}
            trendLabel={windowPct >= 90 ? 'on target' : windowPct < 70 ? 'below target' : undefined} />

          <KpiCard tint="mint" icon={Droplet} label="Stool count"
            value={s.stool_count ?? 0}
            sub={`Small ${s.small_count ?? 0} · Medium ${s.medium_count ?? 0} · Large ${s.large_count ?? 0}`}
            spark={stoolSparkData} />
          <KpiCard tint="mint" icon={Droplets} label="Stool quantity"
            value={fmtMl(s.total_ml)} sub={s.last_stool_at ? `last ${fmtRelative(s.last_stool_at)}` : 'nothing yet'} />
          <KpiCard tint="lavender" icon={Pill} label="Med adherence"
            value={fmtPct(m.adherence_pct)} sub={`${m.taken ?? 0}/${m.total_doses ?? 0} taken · ${m.missed ?? 0} missed`}
            tone={(Number(m.adherence_pct) || 0) < 80 ? 'warning' : 'positive'}
            trend={(Number(m.adherence_pct) || 0) >= 80 ? 'up' : 'down'} />
          <KpiCard tint="brand" icon={Scale} label="Current weight"
            value={fmtKg(w)} sub={baby.birth_weight_kg ? `birth ${fmtKg(Number(baby.birth_weight_kg))}` : 'log a measurement'}
            spark={weightSparkData} />
        </div>
      </section>

      {/* Active medications */}
      {(activeMeds.data ?? []).length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Active medications</h2>
            <Link href={`/babies/${babyId}/medications`} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1">
              manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeMeds.data?.map(med => (
              <div key={med.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-50 to-white border border-slate-200/70 p-4 shadow-card">
                <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-lavender-100 blur-2xl opacity-70" />
                <div className="relative flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-lavender-500 text-white grid place-items-center shrink-0 shadow-sm">
                    <Pill className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-strong truncate">
                      {med.name}{med.dosage ? <span className="text-ink font-normal"> · {med.dosage}</span> : null}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      every {med.frequency_hours ?? '—'}h · {med.route}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/babies/${babyId}/medications/log?m=${med.id}`}
                        className="rounded-full bg-lavender-500 px-3 py-1 text-xs text-white hover:bg-lavender-600">Log dose</Link>
                      <Link href={`/babies/${babyId}/medications/${med.id}`}
                        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50">Edit</Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Temperature + Vaccinations summary */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Temperature */}
        <div className="rounded-2xl bg-gradient-to-br from-coral-50 to-white border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-coral-500 text-white grid place-items-center">
                <Thermometer className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Temperature</div>
                <div className="text-sm font-semibold text-ink-strong">Last {range.label.toLowerCase()}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/babies/${babyId}/temperature/new`}
                className="rounded-full bg-coral-500 text-white text-xs px-3 py-1 hover:bg-coral-600">+ Log</Link>
              <Link href={`/babies/${babyId}/temperature`}
                className="rounded-full border border-slate-300 bg-white text-xs px-3 py-1 hover:bg-slate-50">All</Link>
            </div>
          </div>
          {(() => {
            const temps = (tempWindow.data ?? []) as { temperature_c: number; measured_at: string }[];
            const values = temps.map(r => Number(r.temperature_c)).filter(Number.isFinite);
            const last = lastTemp.data as { temperature_c: number; measured_at: string; method: string } | null;
            const hi = values.length > 0 ? Math.max(...values) : null;
            const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
            const lastVal = last ? Number(last.temperature_c) : null;
            const status = lastVal == null ? 'brand' : lastVal >= 38 ? 'coral' : lastVal >= 37.5 ? 'peach' : lastVal < 36 ? 'brand' : 'mint';
            const statusLabel = lastVal == null ? 'no reading' : lastVal >= 38 ? 'Fever' : lastVal >= 37.5 ? 'Elevated' : lastVal < 36 ? 'Low' : 'Normal';
            const statusClr = { coral:'text-coral-700 bg-coral-100', peach:'text-peach-700 bg-peach-100', mint:'text-mint-700 bg-mint-100', brand:'text-brand-700 bg-brand-100' }[status];
            return (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Latest" value={lastVal != null ? `${lastVal.toFixed(1)} °C` : '—'}
                  sub={last ? fmtRelative(last.measured_at) : 'never'} />
                <Stat label="Avg" value={avg != null ? `${avg.toFixed(1)} °C` : '—'}
                  sub={values.length > 0 ? `${values.length} readings` : 'no data'} />
                <Stat label="Peak" value={hi != null ? `${hi.toFixed(1)} °C` : '—'}
                  sub={<span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClr}`}>{statusLabel}</span>} />
              </div>
            );
          })()}
        </div>

        {/* Vaccinations */}
        <div className="rounded-2xl bg-gradient-to-br from-lavender-50 to-white border border-slate-200/70 shadow-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-lavender-500 text-white grid place-items-center">
                <Syringe className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Vaccinations</div>
                <div className="text-sm font-semibold text-ink-strong">
                  {(administeredVaccines.data ?? []).length} done · {(upcomingVaccines.data ?? []).length} upcoming
                </div>
              </div>
            </div>
            <Link href={`/babies/${babyId}/vaccinations`}
              className="rounded-full border border-slate-300 bg-white text-xs px-3 py-1 hover:bg-slate-50">Open</Link>
          </div>
          <div className="space-y-1.5 text-sm">
            {(upcomingVaccines.data ?? []).length === 0 && (administeredVaccines.data ?? []).length === 0 && (
              <div className="text-xs text-ink-muted">Nothing scheduled — <Link href={`/babies/${babyId}/vaccinations`} className="text-lavender-700 hover:underline">add or suggest a plan</Link>.</div>
            )}
            {upcomingVaccines.data?.slice(0, 3).map(v => (
              <div key={v.id} className="flex items-center justify-between rounded-xl bg-white border border-slate-100 px-3 py-1.5">
                <div className="truncate">
                  <span className="font-medium text-ink-strong">{v.vaccine_name}</span>
                  {v.dose_number && v.total_doses ? <span className="text-ink-muted"> · {v.dose_number}/{v.total_doses}</span> : null}
                </div>
                <span className="text-xs text-ink-muted whitespace-nowrap ml-2">
                  {v.scheduled_at ? fmtDate(v.scheduled_at) : 'TBD'}
                </span>
              </div>
            ))}
            {administeredVaccines.data?.slice(0, 2).map(v => (
              <div key={v.id} className="flex items-center justify-between rounded-xl bg-mint-50 px-3 py-1.5">
                <div className="truncate">
                  <span className="font-medium text-ink-strong">{v.vaccine_name}</span>
                  <span className="text-mint-700 text-xs font-semibold ml-1">✓ done</span>
                </div>
                <span className="text-xs text-ink-muted whitespace-nowrap">{v.administered_at ? fmtDate(v.administered_at) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Feeding vs recommended — {seriesDays} days</CardTitle></CardHeader>
          <CardContent><FeedingChart data={(feedingSeries.data ?? []) as { day: string; total_ml: number; recommended_ml: number }[]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Weight trend — 365 days</CardTitle></CardHeader>
          <CardContent><WeightChart data={(weightSeries.data ?? []) as { measured_at: string; weight_kg: number | null }[]} /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Stool trend — {seriesDays} days</CardTitle></CardHeader>
          <CardContent><StoolChart data={(stoolSeries.data ?? []) as { day: string; stool_count: number; total_ml: number }[]} /></CardContent>
        </Card>
      </section>

      {/* Quick nav footer */}
      <section>
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Jump to</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 text-sm">
          <QuickLink href={`/babies/${babyId}/feedings`}     icon={Milk}    tint="coral"    label="Feedings" />
          <QuickLink href={`/babies/${babyId}/stool`}        icon={Droplet} tint="mint"     label="Stool" />
          <QuickLink href={`/babies/${babyId}/medications`}  icon={Pill}    tint="lavender" label="Medications" />
          <QuickLink href={`/babies/${babyId}/measurements`} icon={Scale}   tint="brand"    label="Measurements" />
          <QuickLink href={`/babies/${babyId}/temperature`}  icon={Thermometer} tint="coral" label="Temperature" />
          <QuickLink href={`/babies/${babyId}/vaccinations`} icon={Syringe} tint="lavender" label="Vaccinations" />
          <QuickLink href={`/babies/${babyId}/reports`}      icon={Moon}    tint="peach"    label="Reports" />
          <QuickLink href={`/babies/${babyId}/upload`}       icon={Droplets} tint="coral"   label="Upload" />
        </div>
      </section>

      {/* General comments attached to the baby itself */}
      <Comments babyId={babyId} target="babies" targetId={babyId} title="Caregiver notes" />
    </div>
  );
}

/** Small stat tile used inside the temperature analytics card */
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="mt-0.5 text-base font-bold text-ink-strong leading-tight">{value}</div>
      <div className="text-[10px] text-ink-muted">{sub}</div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, tint, label }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'mint'|'lavender'|'brand'|'peach';
  label: string;
}) {
  const map = {
    coral:    'bg-coral-50 text-coral-700 hover:bg-coral-100',
    mint:     'bg-mint-50 text-mint-700 hover:bg-mint-100',
    lavender: 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100',
    brand:    'bg-brand-50 text-brand-700 hover:bg-brand-100',
    peach:    'bg-peach-50 text-peach-700 hover:bg-peach-100',
  }[tint];
  return (
    <Link href={href} className={`flex items-center gap-2 rounded-2xl px-4 py-3 font-medium transition ${map}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

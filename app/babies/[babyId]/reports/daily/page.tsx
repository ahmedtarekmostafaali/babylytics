import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { DayPicker } from '@/components/DayPicker';
import { ExportButton } from '@/components/ExportButton';
import { loadHiddenWidgets, showWidget } from '@/lib/dashboard-prefs';
import { SlidersHorizontal } from 'lucide-react';
import { Wordmark } from '@/components/Wordmark';
import { BabyAvatar } from '@/components/BabyAvatar';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { dayWindow, fmtDateTime, fmtDate, todayLocalDate } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg, fmtCm } from '@/lib/units';
import { Milk, Droplet, Pill, Scale, Ruler, Target, Percent, Thermometer, Syringe } from 'lucide-react';
import { Comments } from '@/components/Comments';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Daily report' };

export default async function DailyReport({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { d?: string };
}) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireExport: true });
  const babyId = params.babyId;
  const isoDate = searchParams.d ?? todayLocalDate();
  const { start, end } = dayWindow(isoDate);

  const { data: baby } = await supabase.from('babies')
    .select('id,name,dob,feeding_factor_ml_per_kg_per_day,birth_weight_kg,avatar_path')
    .eq('id', babyId).single();
  if (!baby) notFound();

  const [feedingKpi, stoolKpi, medKpi, currentWeight, feedings, stools, doseLogs, measurements, temps, vaccines, avatarUrl] = await Promise.all([
    supabase.rpc('feeding_kpis',    { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('stool_kpis',      { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('medication_kpis', { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('current_weight_kg', { p_baby: babyId }),
    supabase.from('feedings').select('id,feeding_time,milk_type,quantity_ml,kcal,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('feeding_time', start).lt('feeding_time', end).order('feeding_time', { ascending: true }),
    supabase.from('stool_logs').select('id,stool_time,quantity_category,quantity_ml,color,consistency,has_diaper_rash,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('stool_time', start).lt('stool_time', end).order('stool_time', { ascending: true }),
    supabase.from('medication_logs').select('id,medication_id,medication_time,status,actual_dosage,notes').eq('baby_id', babyId).is('deleted_at', null).gte('medication_time', start).lt('medication_time', end).order('medication_time', { ascending: true }),
    supabase.from('measurements').select('id,measured_at,weight_kg,height_cm,head_circ_cm,notes').eq('baby_id', babyId).is('deleted_at', null).gte('measured_at', start).lt('measured_at', end).order('measured_at', { ascending: true }),
    supabase.from('temperature_logs').select('id,measured_at,temperature_c,method,notes').eq('baby_id', babyId).is('deleted_at', null).gte('measured_at', start).lt('measured_at', end).order('measured_at', { ascending: true }),
    supabase.from('vaccinations').select('id,vaccine_name,administered_at,dose_number,total_doses,notes').eq('baby_id', babyId).is('deleted_at', null).eq('status','administered').gte('administered_at', start).lt('administered_at', end).order('administered_at', { ascending: true }),
    signAvatarUrl(supabase, baby.avatar_path),
  ]);

  const { data: allMeds } = await supabase.from('medications').select('id,name,dosage').eq('baby_id', babyId).is('deleted_at', null);
  const medNameById: Record<string, { name: string; dosage: string | null }> = Object.fromEntries(
    ((allMeds ?? []) as { id: string; name: string; dosage: string | null }[]).map(m => [m.id, { name: m.name, dosage: m.dosage }])
  );

  const f = (feedingKpi.data ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data   ?? {}) as { stool_count: number; total_ml: number };
  const m = (medKpi.data     ?? {}) as { total_doses: number; taken: number; missed: number; adherence_pct: number };
  const w = currentWeight.data as number | null;
  const todayMeasurement = (measurements.data ?? [])[0];

  const hidden = await loadHiddenWidgets(supabase, babyId, 'daily_report');
  const show = (id: string) => showWidget(hidden, id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Screen-only toolbar — marked no-export so the capture skips it. */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-export">
        <div>
          <Link href={`/babies/${babyId}/reports`} className="text-sm text-ink-muted hover:underline">← Reports</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">Daily report</h1>
          <p className="text-sm text-ink-muted">{baby.name} · {fmtDate(isoDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/babies/${babyId}/dashboard-settings`}
            className="h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
            title="Customize report" aria-label="Customize report">
            <SlidersHorizontal className="h-4 w-4 text-ink" />
          </Link>
          <DayPicker babyId={babyId} value={isoDate} />
          <ExportButton filenameHint={`${baby.name} — daily ${fmtDate(isoDate)}`} />
        </div>
      </div>

      {/* Everything inside #report-capture is what the ExportButton snapshots. */}
      <div id="report-capture" className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        {/* Branded header — now always visible, not print-only. */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b-2 border-brand-500">
            <Wordmark size="md" />
            <div className="text-right text-[10px] text-ink-muted">
              Daily report<br />
              Generated {fmtDateTime(new Date().toISOString())}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <BabyAvatar url={avatarUrl} size="md" />
            <div>
              <h1 className="text-xl font-bold text-ink-strong">{baby.name}</h1>
              <p className="text-xs text-ink-muted">{fmtDate(isoDate)} · daily care summary</p>
            </div>
          </div>
        </div>

      {/* KPI grid — compact so it fits one page alongside the new temp tile */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {show('kpi_feeds') && <MiniKpi tint="peach" icon={Milk}    label="Feeds"    value={fmtMl(f.total_feed_ml)} sub={`${f.feed_count ?? 0} feed${f.feed_count === 1 ? '' : 's'}${f.feed_count ? ` · avg ${fmtMl(f.avg_feed_ml)}` : ''}`} />}
        {show('kpi_target') && <MiniKpi tint="peach" icon={Target}  label="Target"   value={fmtMl(f.recommended_feed_ml)} sub={w ? `${fmtKg(w)} × ${baby.feeding_factor_ml_per_kg_per_day} ml/kg` : ''} />}
        {show('kpi_feeding_pct') && (() => {
          const remaining = Math.max(0, Math.round((f.recommended_feed_ml ?? 0) - (f.total_feed_ml ?? 0)));
          const pct = Number(f.feeding_percentage ?? 0);
          return (
            <MiniKpi tint="peach" icon={Percent} label="Feeding %"
              value={fmtPct(pct)}
              sub={pct >= 100 ? 'goal hit ✓' : `${fmtMl(remaining)} left to goal`} />
          );
        })()}
        {show('kpi_stools') && <MiniKpi tint="mint"  icon={Droplet} label="Stools"   value={s.stool_count ?? 0} sub={s.total_ml ? `${fmtMl(s.total_ml)} total` : ''} />}
        {show('kpi_doses') && <MiniKpi tint="lavender" icon={Pill} label="Doses"     value={`${m.taken ?? 0}/${m.total_doses ?? 0}`} sub={`${m.missed ?? 0} missed · ${fmtPct(m.adherence_pct)}`} />}

        {show('kpi_temperature') && (() => {
          const values = ((temps.data ?? []) as { temperature_c: number }[]).map(r => Number(r.temperature_c)).filter(Number.isFinite);
          const peak = values.length ? Math.max(...values) : null;
          const avg  = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : null;
          return (
            <MiniKpi tint="coral" icon={Thermometer} label="Temperature"
              value={peak != null ? `${peak.toFixed(1)} °C` : '—'}
              sub={avg != null ? `avg ${avg.toFixed(1)} · ${values.length} readings` : 'no readings'} />
          );
        })()}
        {show('kpi_measurements') && todayMeasurement && (
          <MiniKpi tint="brand" icon={Scale} label="Growth"
            value={<span className="text-base leading-tight">
              {todayMeasurement.weight_kg ? `${fmtKg(todayMeasurement.weight_kg)}` : ''}
              {todayMeasurement.height_cm ? ` · ${fmtCm(todayMeasurement.height_cm)}` : ''}
              {todayMeasurement.head_circ_cm ? ` · head ${fmtCm(todayMeasurement.head_circ_cm)}` : ''}
            </span>}
            sub={`measured at ${fmtDateTime(todayMeasurement.measured_at).split(' · ')[1] ?? ''}`}
          />
        )}
        {show('kpi_measurements') && !todayMeasurement && (
          <MiniKpi tint="brand" icon={Ruler} label="Growth" value="—" sub="no measurement today" />
        )}
      </section>

      {/* Timelines — use tight colored tiles */}
      <div className="grid md:grid-cols-2 gap-4">
        {show('feed_log') && <TimelineCard title="Feedings" tint="peach" items={(feedings.data ?? []).map(r => ({
          time: fmtDateTime(r.feeding_time).split(' · ')[1] ?? '',
          line: `${fmtMl(r.quantity_ml)} · ${r.milk_type}${r.kcal ? ` · ${r.kcal} kcal` : ''}`,
          sub: r.notes ?? (r.source !== 'manual' ? `via ${r.source}` : undefined),
        }))} />}

        {show('stool_log') && <TimelineCard title="Stool" tint="mint" items={(stools.data ?? []).map(r => ({
          time: fmtDateTime(r.stool_time).split(' · ')[1] ?? '',
          line: `${r.quantity_category ?? 'stool'}${r.quantity_ml ? ` · ${fmtMl(r.quantity_ml)}` : ''}${r.color ? ` · ${r.color}` : ''}${r.consistency ? ` · ${r.consistency}` : ''}${r.has_diaper_rash ? ' · rash' : ''}`,
          sub: r.notes ?? undefined,
        }))} />}

        {show('med_log') && <TimelineCard title="Medication doses" tint="lavender" items={(doseLogs.data ?? []).map(l => {
          const med = medNameById[l.medication_id];
          return {
            time: fmtDateTime(l.medication_time).split(' · ')[1] ?? '',
            line: `${med?.name ?? 'Medication'}${med?.dosage ? ` · ${med.dosage}` : ''} · ${l.status}`,
            sub: l.actual_dosage ? `actual: ${l.actual_dosage}` : (l.notes ?? undefined),
          };
        })} />}

        <TimelineCard title="Measurements" tint="brand" items={(measurements.data ?? []).map(r => ({
          time: fmtDateTime(r.measured_at).split(' · ')[1] ?? '',
          line: [
            r.weight_kg    ? fmtKg(r.weight_kg)          : null,
            r.height_cm    ? fmtCm(r.height_cm)          : null,
            r.head_circ_cm ? `head ${fmtCm(r.head_circ_cm)}` : null,
          ].filter(Boolean).join(' · ') || 'measurement',
          sub: r.notes ?? undefined,
        }))} />

        {show('temp_log') && <TimelineCard title="Temperature" tint="coral" items={(temps.data ?? []).map(r => ({
          time: fmtDateTime(r.measured_at).split(' · ')[1] ?? '',
          line: `${Number(r.temperature_c).toFixed(1)} °C · ${r.method}`,
          sub: r.notes ?? undefined,
        }))} />}

        {show('vax_log') && <TimelineCard title="Vaccinations" tint="lavender" items={(vaccines.data ?? []).map(v => ({
          time: v.administered_at ? (fmtDateTime(v.administered_at).split(' · ')[1] ?? '') : '',
          line: `${v.vaccine_name}${v.dose_number && v.total_doses ? ` · dose ${v.dose_number}/${v.total_doses}` : ''}`,
          sub: v.notes ?? undefined,
        }))} />}
        </div>

        <footer className="pt-3 text-center text-[10px] text-ink-muted border-t border-slate-200">
          Tracked today · nurtured tomorrow · <strong className="text-brand-600">Babylytics</strong>
        </footer>
      </div>
      {/* end #report-capture */}

      {/* Comments thread for this day — excluded from the export. */}
      {show('comments') && (
        <div className="no-export">
          <Comments babyId={babyId} target="babies" targetId={babyId}
            scopeDate={isoDate}
            title={`Notes for ${fmtDate(isoDate)}`} />
        </div>
      )}
    </div>
  );
}

/** Compact KPI tile that prints well */
function MiniKpi({ tint, icon: Icon, label, value, sub }: {
  tint: 'peach' | 'mint' | 'lavender' | 'brand' | 'coral';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  const tintCss = {
    peach:    { bg: 'bg-gradient-to-br from-peach-50 to-white border-peach-200',       iconBg: 'bg-peach-500',    val: 'text-ink-strong' },
    mint:     { bg: 'bg-gradient-to-br from-mint-50 to-white border-mint-200',         iconBg: 'bg-mint-500',     val: 'text-ink-strong' },
    lavender: { bg: 'bg-gradient-to-br from-lavender-50 to-white border-lavender-200', iconBg: 'bg-lavender-500', val: 'text-ink-strong' },
    brand:    { bg: 'bg-gradient-to-br from-brand-50 to-white border-brand-200',       iconBg: 'bg-brand-500',    val: 'text-ink-strong' },
    coral:    { bg: 'bg-gradient-to-br from-coral-50 to-white border-coral-200',       iconBg: 'bg-coral-500',    val: 'text-ink-strong' },
  }[tint];
  return (
    <div className={`rounded-2xl border ${tintCss.bg} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
        <div className={`h-7 w-7 rounded-lg ${tintCss.iconBg} text-white grid place-items-center shrink-0`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className={`mt-1 text-2xl font-bold ${tintCss.val} leading-tight`}>{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-muted truncate">{sub}</div>}
    </div>
  );
}

/** Compact timeline card with a colored header bar and tight rows */
function TimelineCard({ title, tint, items }: {
  title: string;
  tint: 'peach' | 'mint' | 'lavender' | 'brand' | 'coral';
  items: { time: string; line: string; sub?: string }[];
}) {
  const tintCss = {
    peach:    { head: 'bg-peach-100    text-peach-700',    border: 'border-peach-200',    dot: 'bg-peach-500' },
    mint:     { head: 'bg-mint-100     text-mint-700',     border: 'border-mint-200',     dot: 'bg-mint-500' },
    lavender: { head: 'bg-lavender-100 text-lavender-700', border: 'border-lavender-200', dot: 'bg-lavender-500' },
    brand:    { head: 'bg-brand-100    text-brand-700',    border: 'border-brand-200',    dot: 'bg-brand-500' },
    coral:    { head: 'bg-coral-100    text-coral-700',    border: 'border-coral-200',    dot: 'bg-coral-500' },
  }[tint];

  return (
    <div className={`rounded-2xl border ${tintCss.border} overflow-hidden bg-white`}>
      <div className={`px-4 py-2 ${tintCss.head} text-xs font-semibold uppercase tracking-wider`}>
        {title} · {items.length}
      </div>
      <div className="p-3">
        {items.length === 0 ? (
          <div className="text-xs text-ink-muted text-center py-2">No entries.</div>
        ) : (
          <ol className="space-y-1 text-xs">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${tintCss.dot}`} />
                <span className="font-mono text-ink-muted w-12 shrink-0">{it.time}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-ink-strong font-medium">{it.line}</span>
                  {it.sub && <span className="block text-ink-muted">{it.sub}</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

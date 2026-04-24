import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/KpiCard';
import { DayPicker } from '@/components/DayPicker';
import { PrintButton } from '@/components/PrintButton';
import { dayWindow, fmtDateTime, fmtDate, todayLocalDate } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg, fmtCm } from '@/lib/units';
import { Milk, Droplet, Pill, Scale, Ruler } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DailyReport({
  params,
  searchParams,
}: {
  params: { babyId: string };
  searchParams: { d?: string };
}) {
  const supabase = createClient();
  const babyId = params.babyId;
  const isoDate = searchParams.d ?? todayLocalDate();
  const { start, end } = dayWindow(isoDate);

  const { data: baby } = await supabase.from('babies').select('id,name,dob,feeding_factor_ml_per_kg_per_day,birth_weight_kg').eq('id', babyId).single();
  if (!baby) notFound();

  const [feedingKpi, stoolKpi, medKpi, currentWeight, feedings, stools, doseLogs, measurements] = await Promise.all([
    supabase.rpc('feeding_kpis',    { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('stool_kpis',      { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('medication_kpis', { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('current_weight_kg', { p_baby: babyId }),
    supabase.from('feedings').select('id,feeding_time,milk_type,quantity_ml,kcal,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('feeding_time', start).lt('feeding_time', end).order('feeding_time', { ascending: true }),
    supabase.from('stool_logs').select('id,stool_time,quantity_category,quantity_ml,color,consistency,has_diaper_rash,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('stool_time', start).lt('stool_time', end).order('stool_time', { ascending: true }),
    supabase.from('medication_logs').select('id,medication_id,medication_time,status,actual_dosage,notes').eq('baby_id', babyId).is('deleted_at', null).gte('medication_time', start).lt('medication_time', end).order('medication_time', { ascending: true }),
    supabase.from('measurements').select('id,measured_at,weight_kg,height_cm,head_circ_cm,notes').eq('baby_id', babyId).is('deleted_at', null).gte('measured_at', start).lt('measured_at', end).order('measured_at', { ascending: true }),
  ]);

  const { data: allMeds } = await supabase.from('medications').select('id,name,dosage').eq('baby_id', babyId).is('deleted_at', null);
  const medNameById: Record<string, { name: string; dosage: string | null }> = Object.fromEntries(
    ((allMeds ?? []) as { id: string; name: string; dosage: string | null }[]).map(m => [m.id, { name: m.name, dosage: m.dosage }])
  );

  const f = (feedingKpi.data ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data   ?? {}) as { stool_count: number; total_ml: number };
  const m = (medKpi.data     ?? {}) as { total_doses: number; taken: number; missed: number; adherence_pct: number };
  const w = currentWeight.data as number | null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 print:py-2">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <Link href={`/babies/${babyId}/reports`} className="text-sm text-ink-muted hover:underline">← Reports</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">Daily report</h1>
          <p className="text-sm text-ink-muted">{baby.name} · {fmtDate(isoDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <DayPicker babyId={babyId} value={isoDate} />
          <PrintButton />
        </div>
      </div>

      {/* Printable header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Babylytics — Daily report</h1>
        <p className="text-sm">{baby.name} · {fmtDate(isoDate)}</p>
        <hr className="my-2" />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard tint="peach"    icon={Milk}    label="Feeds"      value={f.feed_count ?? 0}  sub={`${fmtMl(f.total_feed_ml)} total · avg ${fmtMl(f.avg_feed_ml)}`} />
        <KpiCard tint="peach"                   label="Recommended" value={fmtMl(f.recommended_feed_ml)} sub={w ? `${fmtKg(w)} × ${baby.feeding_factor_ml_per_kg_per_day} ml/kg` : '—'} />
        <KpiCard tint="peach"                   label="Feeding %"  value={fmtPct(f.feeding_percentage)} tone={Number(f.feeding_percentage) < 70 ? 'warning' : 'positive'} />
        <KpiCard tint="mint"     icon={Droplet} label="Stools"     value={s.stool_count ?? 0} sub={`${fmtMl(s.total_ml)} total`} />
        <KpiCard tint="lavender" icon={Pill}    label="Doses"      value={`${m.taken ?? 0}/${m.total_doses ?? 0}`} sub={`${m.missed ?? 0} missed · ${fmtPct(m.adherence_pct)}`} />
        <KpiCard tint="brand"    icon={Scale}   label="Weight"     value={measurements.data && measurements.data.length > 0 ? fmtKg(measurements.data[0].weight_kg) : '—'} sub="from today's measurement" />
        <KpiCard tint="brand"    icon={Ruler}   label="Height"     value={measurements.data && measurements.data.length > 0 ? fmtCm(measurements.data[0].height_cm) : '—'} sub="from today's measurement" />
        <KpiCard tint="brand"                   label="Head circ." value={measurements.data && measurements.data.length > 0 ? fmtCm(measurements.data[0].head_circ_cm) : '—'} />
      </div>

      <Card>
        <CardHeader><CardTitle>Feedings timeline</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(feedings.data ?? []).length === 0 && <p className="text-ink-muted">No feedings this day.</p>}
          {feedings.data?.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-ink-strong">{fmtMl(r.quantity_ml)} · {r.milk_type}{r.kcal ? ` · ${r.kcal} kcal` : ''}</div>
                {r.notes && <div className="text-xs text-ink-muted">{r.notes}</div>}
              </div>
              <span className="text-xs text-ink-muted">{fmtDateTime(r.feeding_time).split(' · ')[1]}{r.source !== 'manual' ? ` · ${r.source}` : ''}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stool timeline</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(stools.data ?? []).length === 0 && <p className="text-ink-muted">No stool logs this day.</p>}
          {stools.data?.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-ink-strong">{r.quantity_category ?? 'stool'}{r.quantity_ml ? ` · ${fmtMl(r.quantity_ml)}` : ''}{r.color ? ` · ${r.color}` : ''}{r.consistency ? ` · ${r.consistency}` : ''}{r.has_diaper_rash ? ' · diaper rash' : ''}</div>
                {r.notes && <div className="text-xs text-ink-muted">{r.notes}</div>}
              </div>
              <span className="text-xs text-ink-muted">{fmtDateTime(r.stool_time).split(' · ')[1]}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Medication doses</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(doseLogs.data ?? []).length === 0 && <p className="text-ink-muted">No doses recorded this day.</p>}
          {doseLogs.data?.map(l => {
            const med = medNameById[l.medication_id];
            return (
              <div key={l.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-ink-strong">{med?.name ?? 'Medication'}{med?.dosage ? ` · ${med.dosage}` : ''} · {l.status}</div>
                  {l.actual_dosage && <div className="text-xs text-ink-muted">actual: {l.actual_dosage}</div>}
                  {l.notes && <div className="text-xs text-ink-muted">{l.notes}</div>}
                </div>
                <span className="text-xs text-ink-muted">{fmtDateTime(l.medication_time).split(' · ')[1]}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Measurements</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(measurements.data ?? []).length === 0 && <p className="text-ink-muted">No measurements taken this day.</p>}
          {measurements.data?.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-ink-strong">{fmtKg(r.weight_kg)} · {fmtCm(r.height_cm)} · head {fmtCm(r.head_circ_cm)}</div>
                {r.notes && <div className="text-xs text-ink-muted">{r.notes}</div>}
              </div>
              <span className="text-xs text-ink-muted">{fmtDateTime(r.measured_at).split(' · ')[1]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

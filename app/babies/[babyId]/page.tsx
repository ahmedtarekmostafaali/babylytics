import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { BabyHeader } from '@/components/BabyHeader';
import { KpiCard } from '@/components/KpiCard';
import { FeedingChart } from '@/components/FeedingChart';
import { WeightChart } from '@/components/WeightChart';
import { StoolChart } from '@/components/StoolChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fmtDateTime, fmtRelative, last24hWindow } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg } from '@/lib/units';

export const dynamic = 'force-dynamic';

export default async function BabyPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const babyId = params.babyId;
  // Rolling 24h avoids UTC-vs-local "today" drift on the Vercel server.
  const { start, end } = last24hWindow();

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,feeding_factor_ml_per_kg_per_day')
    .eq('id', babyId)
    .is('deleted_at', null)
    .single();
  if (!baby) notFound();

  // Parallel: KPIs + series + weight + recent logs + low-confidence OCR banner + active meds
  const [
    feedingKpi,
    stoolKpi,
    medicationKpi,
    feedingSeries,
    stoolSeries,
    weightSeries,
    currentWeight,
    recentFeedings,
    recentStools,
    lowConf,
    recentFiles,
    activeMeds,
  ] = await Promise.all([
    supabase.rpc('feeding_kpis',         { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('stool_kpis',           { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('medication_kpis',      { p_baby: babyId, p_start: start, p_end: end }).single(),
    supabase.rpc('daily_feeding_series', { p_baby: babyId, p_days: 14 }),
    supabase.rpc('daily_stool_series',   { p_baby: babyId, p_days: 14 }),
    supabase.rpc('weight_trend',         { p_baby: babyId, p_days: 180 }),
    supabase.rpc('current_weight_kg',    { p_baby: babyId }),
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml,source')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('feeding_time', { ascending: false }).limit(5),
    supabase.from('stool_logs')
      .select('id,stool_time,quantity_category,quantity_ml,color,source')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('stool_time', { ascending: false }).limit(5),
    supabase.from('extracted_text')
      .select('id,file_id,confidence_score,is_handwritten,created_at,status')
      .eq('baby_id', babyId)
      .eq('status', 'extracted')
      .eq('flag_low_confidence', true)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('medical_files')
      .select('id,kind,storage_path,ocr_status,uploaded_at')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('uploaded_at', { ascending: false }).limit(5),
    // Active medications: not ended, or ends in the future
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by')
      .eq('baby_id', babyId).is('deleted_at', null)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('starts_at', { ascending: false }),
  ]);

  const f = (feedingKpi.data    ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; remaining_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data      ?? {}) as { stool_count: number; total_ml: number; small_count: number; medium_count: number; large_count: number; last_stool_at: string | null };
  const m = (medicationKpi.data ?? {}) as { total_doses: number; taken: number; missed: number; remaining: number; adherence_pct: number };
  const w = currentWeight.data as number | null;
  const factor = Number(baby.feeding_factor_ml_per_kg_per_day ?? 150);

  return (
    <div>
      <Nav />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <BabyHeader baby={baby as { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null }} currentWeightKg={w} />

        {lowConf.data && lowConf.data.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <div className="font-semibold text-amber-900">
              {lowConf.data.length} OCR extraction{lowConf.data.length > 1 ? 's' : ''} need{lowConf.data.length === 1 ? 's' : ''} review
            </div>
            <p className="text-amber-800 mt-1">Low confidence — please confirm or edit the extracted values before they land in your logs.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lowConf.data.map(x => (
                <Link key={x.id} href={`/babies/${babyId}/ocr/${x.id}`}
                  className="rounded-md bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-700">
                  Review extraction · {Math.round((Number(x.confidence_score) ?? 0) * 100)}%
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* KPI row — rolling 24h */}
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Last 24 hours</h2>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <KpiCard label="Total feed"             value={fmtMl(f.total_feed_ml)}       sub={`${f.feed_count ?? 0} feeds · avg ${fmtMl(f.avg_feed_ml)}`} />
            <KpiCard label="Recommended (24h)"      value={fmtMl(f.recommended_feed_ml)} sub={w ? `${fmtKg(w)} × ${factor} ml/kg/day` : 'add a measurement first'} />
            <KpiCard label="Remaining to target"    value={fmtMl(f.remaining_feed_ml)}
                     tone={(Number(f.feeding_percentage) ?? 0) < 70 ? 'warning' : 'positive'} />
            <KpiCard label="Feeding %"              value={fmtPct(f.feeding_percentage)}
                     tone={(Number(f.feeding_percentage) ?? 0) >= 90 ? 'positive' : (Number(f.feeding_percentage) ?? 0) >= 70 ? 'neutral' : 'warning'} />

            <KpiCard label="Stool count"            value={s.stool_count ?? 0}
                     sub={`S:${s.small_count ?? 0} · M:${s.medium_count ?? 0} · L:${s.large_count ?? 0}`} />
            <KpiCard label="Stool quantity"         value={fmtMl(s.total_ml)}
                     sub={s.last_stool_at ? `last ${fmtRelative(s.last_stool_at)}` : 'no stool in 24h'} />
            <KpiCard label="Medication adherence"   value={fmtPct(m.adherence_pct)}
                     sub={`${m.taken ?? 0}/${m.total_doses ?? 0} taken · ${m.missed ?? 0} missed`}
                     tone={(Number(m.adherence_pct) ?? 100) < 80 ? 'warning' : 'positive'} />
            <KpiCard label="Current weight"         value={fmtKg(w)}
                     sub={baby.birth_weight_kg ? `birth ${fmtKg(Number(baby.birth_weight_kg))}` : 'log a measurement'} />
          </div>
        </section>

        {/* Active medications */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Active medications</h2>
            <Link href={`/babies/${babyId}/medications`} className="text-xs text-brand-600 hover:underline">manage →</Link>
          </div>
          <Card>
            <CardContent className="py-3 divide-y divide-slate-100 text-sm">
              {(activeMeds.data ?? []).length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-slate-500">No active medications.</p>
                  <Link href={`/babies/${babyId}/medications/new`} className="text-xs text-brand-600 hover:underline mt-1 inline-block">+ Add a prescription</Link>
                </div>
              )}
              {activeMeds.data?.map(med => {
                const freq = med.frequency_hours ? `every ${med.frequency_hours}h` : 'as needed';
                const ended = med.ends_at ? `until ${fmtDateTime(med.ends_at)}` : 'ongoing';
                return (
                  <div key={med.id} className="flex items-center justify-between py-2 gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {med.name}
                        {med.dosage ? <span className="text-slate-500"> · {med.dosage}</span> : null}
                        {med.route && med.route !== 'oral' ? <span className="text-slate-500"> · {med.route}</span> : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {freq} · {ended}{med.prescribed_by ? ` · ${med.prescribed_by}` : ''}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/babies/${babyId}/medications/log?m=${med.id}`}
                        className="rounded-md bg-brand-500 px-3 py-1 text-xs text-white hover:bg-brand-600">Log dose</Link>
                      <Link href={`/babies/${babyId}/medications/${med.id}`}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50">Edit</Link>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Charts */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Feeding vs recommended — 14 days</CardTitle></CardHeader>
            <CardContent><FeedingChart data={(feedingSeries.data ?? []) as { day: string; total_ml: number; recommended_ml: number }[]} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Weight trend — 180 days</CardTitle></CardHeader>
            <CardContent><WeightChart data={(weightSeries.data ?? []) as { measured_at: string; weight_kg: number | null }[]} /></CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Stool trend — 14 days</CardTitle></CardHeader>
            <CardContent><StoolChart data={(stoolSeries.data ?? []) as { day: string; stool_count: number; total_ml: number }[]} /></CardContent>
          </Card>
        </section>

        {/* Recent logs */}
        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent feedings</CardTitle>
              <Link href={`/babies/${babyId}/feedings`} className="text-xs text-brand-600 hover:underline">all →</Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 text-sm">
              {(recentFeedings.data ?? []).length === 0 && <p className="text-slate-500">No feedings yet.</p>}
              {recentFeedings.data?.map(x => (
                <Link key={x.id} href={`/babies/${babyId}/feedings/${x.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <div>
                    <div className="font-medium">{fmtMl(x.quantity_ml)} · {x.milk_type}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(x.feeding_time)}{x.source !== 'manual' ? ` · ${x.source}` : ''}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent stool logs</CardTitle>
              <Link href={`/babies/${babyId}/stool`} className="text-xs text-brand-600 hover:underline">all →</Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 text-sm">
              {(recentStools.data ?? []).length === 0 && <p className="text-slate-500">No stool logs yet.</p>}
              {recentStools.data?.map(x => (
                <Link key={x.id} href={`/babies/${babyId}/stool/${x.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <div>
                    <div className="font-medium">{x.quantity_category ?? 'stool'}{x.quantity_ml ? ` · ${fmtMl(x.quantity_ml)}` : ''}</div>
                    <div className="text-xs text-slate-500">{fmtDateTime(x.stool_time)}{x.color ? ` · ${x.color}` : ''}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent files</CardTitle>
              <Link href={`/babies/${babyId}/upload`} className="text-xs text-brand-600 hover:underline">upload →</Link>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 text-sm">
              {(recentFiles.data ?? []).length === 0 && <p className="text-slate-500">No uploads yet.</p>}
              {recentFiles.data?.map(x => (
                <Link key={x.id} href={`/babies/${babyId}/files/${x.id}`} className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
                  <div className="truncate">
                    <div className="font-medium">{x.kind.replace('_',' ')}</div>
                    <div className="text-xs text-slate-500">{fmtRelative(x.uploaded_at)} · {x.ocr_status}</div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

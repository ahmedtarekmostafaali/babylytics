import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/KpiCard';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { PrintButton } from '@/components/PrintButton';
import { Wordmark } from '@/components/Wordmark';
import { fmtDate, fmtDateTime, fmtRelative, parseRangeParam, ageInDays } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg, fmtCm } from '@/lib/units';
import { Milk, Droplet, Pill, Scale, Ruler, FileText, Activity, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FullReport({
  params,
  searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();
  const babyId = params.babyId;
  const range = parseRangeParam(searchParams);

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,birth_height_cm,feeding_factor_ml_per_kg_per_day,notes')
    .eq('id', babyId).is('deleted_at', null).single();
  if (!baby) notFound();

  const [
    feedingKpi, stoolKpi, medKpi, currentWeight,
    feedings, stools, doseLogs, measurements,
    allMeds, files, caregivers,
  ] = await Promise.all([
    supabase.rpc('feeding_kpis',    { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('stool_kpis',      { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('medication_kpis', { p_baby: babyId, p_start: range.start, p_end: range.end }).single(),
    supabase.rpc('current_weight_kg', { p_baby: babyId }),
    supabase.from('feedings').select('id,feeding_time,milk_type,quantity_ml,kcal,duration_min,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('feeding_time', range.start).lte('feeding_time', range.end).order('feeding_time', { ascending: true }),
    supabase.from('stool_logs').select('id,stool_time,quantity_category,quantity_ml,color,consistency,has_diaper_rash,notes,source').eq('baby_id', babyId).is('deleted_at', null).gte('stool_time', range.start).lte('stool_time', range.end).order('stool_time', { ascending: true }),
    supabase.from('medication_logs').select('id,medication_id,medication_time,status,actual_dosage,notes').eq('baby_id', babyId).is('deleted_at', null).gte('medication_time', range.start).lte('medication_time', range.end).order('medication_time', { ascending: true }),
    supabase.from('measurements').select('id,measured_at,weight_kg,height_cm,head_circ_cm,notes').eq('baby_id', babyId).is('deleted_at', null).gte('measured_at', range.start).lte('measured_at', range.end).order('measured_at', { ascending: true }),
    supabase.from('medications').select('id,name,dosage,route,frequency_hours,total_doses,starts_at,ends_at,prescribed_by,notes').eq('baby_id', babyId).is('deleted_at', null).order('starts_at', { ascending: false }),
    supabase.from('medical_files').select('id,kind,mime_type,size_bytes,is_handwritten,ocr_status,uploaded_at').eq('baby_id', babyId).is('deleted_at', null).gte('uploaded_at', range.start).lte('uploaded_at', range.end).order('uploaded_at', { ascending: false }),
    supabase.from('baby_users').select('user_id,role,created_at').eq('baby_id', babyId),
  ]);

  const f = (feedingKpi.data ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data   ?? {}) as { stool_count: number; total_ml: number; small_count: number; medium_count: number; large_count: number };
  const m = (medKpi.data     ?? {}) as { total_doses: number; taken: number; missed: number; remaining: number; adherence_pct: number };
  const w = currentWeight.data as number | null;

  const medNameById: Record<string, { name: string; dosage: string | null }> = Object.fromEntries(
    ((allMeds.data ?? []) as { id: string; name: string; dosage: string | null }[]).map(r => [r.id, { name: r.name, dosage: r.dosage }])
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5 print:py-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <div>
          <Link href={`/babies/${babyId}/reports`} className="text-sm text-ink-muted hover:underline">← Reports</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">Full detail report</h1>
          <p className="text-sm text-ink-muted">{baby.name} · {range.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter currentKey={range.key} />
          <PrintButton />
        </div>
      </div>

      {/* Printable header */}
      <div className="hidden print:block">
        <div className="flex items-center justify-between pb-2 border-b-2 border-brand-500">
          <Wordmark size="md" />
          <div className="text-right text-[10px] text-ink-muted">
            Full detail report<br />
            Generated {fmtDateTime(new Date().toISOString())}
          </div>
        </div>
        <div className="mt-3">
          <h1 className="text-2xl font-bold text-ink-strong">
            {baby.name} <span className="text-ink-muted font-normal text-base">({baby.gender}, {ageInDays(baby.dob)} days)</span>
          </h1>
          <p className="text-sm text-ink-muted">Born {fmtDate(baby.dob)} · Report range: {fmtDate(range.start)} → {fmtDate(range.end)}</p>
        </div>
      </div>

      {/* Baby profile card */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand-600" /> Profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Cell label="Name"          value={baby.name} />
          <Cell label="Gender"        value={baby.gender} />
          <Cell label="Date of birth" value={fmtDate(baby.dob)} />
          <Cell label="Age"           value={`${ageInDays(baby.dob)} days`} />
          <Cell label="Current weight" value={fmtKg(w)} />
          <Cell label="Birth weight"   value={fmtKg(Number(baby.birth_weight_kg))} />
          <Cell label="Birth height"   value={fmtCm(Number(baby.birth_height_cm))} />
          <Cell label="Feeding factor" value={`${baby.feeding_factor_ml_per_kg_per_day} ml/kg/day`} />
          {baby.notes && <div className="col-span-2 sm:col-span-4"><div className="text-xs text-ink-muted">Notes</div><div className="text-ink">{baby.notes}</div></div>}
        </CardContent>
      </Card>

      {/* KPI summary */}
      <section>
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Aggregated KPIs — {range.label}</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <KpiCard tint="peach"    icon={Milk}    label="Feeds"      value={f.feed_count ?? 0} sub={`${fmtMl(f.total_feed_ml)} total · avg ${fmtMl(f.avg_feed_ml)}`} />
          <KpiCard tint="peach"                   label="Recommended (daily)" value={fmtMl(f.recommended_feed_ml)} />
          <KpiCard tint="peach"                   label="Feeding %"  value={fmtPct(f.feeding_percentage)} tone={Number(f.feeding_percentage) < 70 ? 'warning' : 'positive'} />
          <KpiCard tint="mint"     icon={Droplet} label="Stools"     value={s.stool_count ?? 0} sub={`S:${s.small_count ?? 0} · M:${s.medium_count ?? 0} · L:${s.large_count ?? 0}`} />
          <KpiCard tint="lavender" icon={Pill}    label="Doses taken" value={m.taken ?? 0} sub={`of ${m.total_doses ?? 0} expected · ${m.missed ?? 0} missed`} />
          <KpiCard tint="lavender"                label="Adherence"  value={fmtPct(m.adherence_pct)} tone={Number(m.adherence_pct) < 80 ? 'warning' : 'positive'} />
          <KpiCard tint="brand"    icon={Scale}   label="Weighings"  value={(measurements.data ?? []).length} />
          <KpiCard tint="brand"    icon={FileText} label="Files uploaded" value={(files.data ?? []).length} />
        </div>
      </section>

      {/* Medications */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4 text-lavender-600" /> Medications ({(allMeds.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(allMeds.data ?? []).length === 0 && <p className="text-ink-muted">None prescribed.</p>}
          {allMeds.data?.map(med => {
            const active = !med.ends_at || new Date(med.ends_at).getTime() > Date.now();
            return (
              <div key={med.id} className="py-2">
                <div className="font-medium text-ink-strong">
                  {med.name}{med.dosage ? ` · ${med.dosage}` : ''}{med.route !== 'oral' ? ` · ${med.route}` : ''}
                  {active ? <span className="ml-2 rounded-full bg-mint-100 text-mint-700 px-2 py-0.5 text-[10px] uppercase tracking-wider">Active</span>
                          : <span className="ml-2 rounded-full bg-slate-100 text-ink-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">Ended</span>}
                </div>
                <div className="text-xs text-ink-muted">
                  {med.frequency_hours ? `every ${med.frequency_hours}h` : 'as needed'} · {fmtDate(med.starts_at)}{med.ends_at ? ` → ${fmtDate(med.ends_at)}` : ''}
                  {med.prescribed_by ? ` · ${med.prescribed_by}` : ''}
                  {med.total_doses ? ` · total ${med.total_doses} doses` : ''}
                </div>
                {med.notes && <div className="text-xs text-ink mt-1">{med.notes}</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Feedings */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Milk className="h-4 w-4 text-peach-600" /> Feedings ({(feedings.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(feedings.data ?? []).length === 0 ? <p className="text-ink-muted">No feedings in this range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Kcal</th>
                    <th className="py-2 pr-3">Duration</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {feedings.data?.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.feeding_time)}</td>
                      <td className="py-2 pr-3">{r.milk_type}</td>
                      <td className="py-2 pr-3">{fmtMl(r.quantity_ml)}</td>
                      <td className="py-2 pr-3">{r.kcal ?? '—'}</td>
                      <td className="py-2 pr-3">{r.duration_min ? `${r.duration_min} min` : '—'}</td>
                      <td className="py-2 pr-3 text-xs text-ink-muted">{r.source}</td>
                      <td className="py-2 text-xs text-ink-muted">{r.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stool */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Droplet className="h-4 w-4 text-mint-600" /> Stool logs ({(stools.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(stools.data ?? []).length === 0 ? <p className="text-ink-muted">No stool logs in this range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3">Quantity</th>
                    <th className="py-2 pr-3">Color</th>
                    <th className="py-2 pr-3">Consistency</th>
                    <th className="py-2 pr-3">Rash</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {stools.data?.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.stool_time)}</td>
                      <td className="py-2 pr-3">{r.quantity_category ?? '—'}</td>
                      <td className="py-2 pr-3">{r.quantity_ml ? fmtMl(r.quantity_ml) : '—'}</td>
                      <td className="py-2 pr-3">{r.color ?? '—'}</td>
                      <td className="py-2 pr-3">{r.consistency ?? '—'}</td>
                      <td className="py-2 pr-3">{r.has_diaper_rash ? 'yes' : '—'}</td>
                      <td className="py-2 text-xs text-ink-muted">{r.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doses */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4 text-lavender-600" /> Dose log ({(doseLogs.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(doseLogs.data ?? []).length === 0 ? <p className="text-ink-muted">No doses recorded in this range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Medication</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actual</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {doseLogs.data?.map(l => {
                    const med = medNameById[l.medication_id];
                    return (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(l.medication_time)}</td>
                        <td className="py-2 pr-3">{med?.name ?? '—'}{med?.dosage ? ` (${med.dosage})` : ''}</td>
                        <td className="py-2 pr-3">{l.status}</td>
                        <td className="py-2 pr-3">{l.actual_dosage ?? '—'}</td>
                        <td className="py-2 text-xs text-ink-muted">{l.notes ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Measurements */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="h-4 w-4 text-brand-600" /> Measurements ({(measurements.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(measurements.data ?? []).length === 0 ? <p className="text-ink-muted">No measurements in this range.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Weight</th>
                    <th className="py-2 pr-3">Height</th>
                    <th className="py-2 pr-3">Head</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.data?.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.measured_at)}</td>
                      <td className="py-2 pr-3">{fmtKg(r.weight_kg)}</td>
                      <td className="py-2 pr-3">{fmtCm(r.height_cm)}</td>
                      <td className="py-2 pr-3">{fmtCm(r.head_circ_cm)}</td>
                      <td className="py-2 text-xs text-ink-muted">{r.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-ink-muted" /> Medical records ({(files.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(files.data ?? []).length === 0 && <p className="text-ink-muted">No files uploaded in this range.</p>}
          {files.data?.map(x => (
            <div key={x.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-ink-strong capitalize">{x.kind.replace('_', ' ')}{x.is_handwritten ? ' · handwritten' : ''}</div>
                <div className="text-xs text-ink-muted">{x.mime_type} · {x.size_bytes ? `${Math.round(x.size_bytes / 1024)} KB` : '—'} · uploaded {fmtRelative(x.uploaded_at)}</div>
              </div>
              <span className="text-xs text-ink-muted">OCR: {x.ocr_status}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Caregivers */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-peach-600" /> Caregivers ({(caregivers.data ?? []).length})</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(caregivers.data ?? []).map(c => (
            <div key={c.user_id} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs text-ink-muted">{c.user_id}</span>
              <span className="rounded-full bg-brand-100 text-brand-700 px-2 py-0.5 text-xs capitalize">{c.role}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <footer className="pt-4 text-center text-xs text-ink-muted print:mt-8">
        Generated by Babylytics · {fmtDateTime(new Date().toISOString())}
      </footer>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-muted uppercase tracking-wider">{label}</div>
      <div className="text-ink-strong">{value}</div>
    </div>
  );
}

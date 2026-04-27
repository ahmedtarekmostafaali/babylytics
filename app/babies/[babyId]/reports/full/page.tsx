import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { KpiCard } from '@/components/KpiCard';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { ExportButton } from '@/components/ExportButton';
import { Wordmark } from '@/components/Wordmark';
import { fmtDate, fmtDateTime, fmtRelative, parseRangeParam, ageInDays } from '@/lib/dates';
import { fmtMl, fmtPct, fmtKg, fmtCm } from '@/lib/units';
import { Milk, Droplet, Pill, Scale, Ruler, FileText, Activity, AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { loadHiddenWidgets, showWidget } from '@/lib/dashboard-prefs';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function FullReport({
  params,
  searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string };
}) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireExport: true });
  const babyId = params.babyId;
  const range = parseRangeParam(searchParams);
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

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

  const hidden = await loadHiddenWidgets(supabase, babyId, 'full_report');
  const show = (id: string) => showWidget(hidden, id);

  const f = (feedingKpi.data ?? {}) as { total_feed_ml: number; avg_feed_ml: number; feed_count: number; recommended_feed_ml: number; feeding_percentage: number };
  const s = (stoolKpi.data   ?? {}) as { stool_count: number; total_ml: number; small_count: number; medium_count: number; large_count: number };
  const m = (medKpi.data     ?? {}) as { total_doses: number; taken: number; missed: number; remaining: number; adherence_pct: number };
  const w = currentWeight.data as number | null;

  const medNameById: Record<string, { name: string; dosage: string | null }> = Object.fromEntries(
    ((allMeds.data ?? []) as { id: string; name: string; dosage: string | null }[]).map(r => [r.id, { name: r.name, dosage: r.dosage }])
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Screen-only toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-export">
        <div>
          <Link href={`/babies/${babyId}/reports`} className="text-sm text-ink-muted hover:underline">{t('full_report.back')}</Link>
          <h1 className="text-xl font-semibold text-ink-strong mt-1">{t('full_report.title')}</h1>
          <p className="text-sm text-ink-muted">{baby.name} · {range.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/babies/${babyId}/dashboard-settings`}
            className="h-9 w-9 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
            title={t('full_report.customize')} aria-label={t('full_report.customize')}>
            <SlidersHorizontal className="h-4 w-4 text-ink" />
          </Link>
          <DateRangeFilter currentKey={range.key} />
          <ExportButton filenameHint={t('full_report.export_filename', { name: baby.name, label: range.label })} />
        </div>
      </div>

      <div id="report-capture" className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        {/* Branded header — always visible so it lands in the export. */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b-2 border-brand-500">
            <Wordmark size="md" />
            <div className="text-right text-[10px] text-ink-muted">
              {t('full_report.header_title')}<br />
              {t('full_report.generated', { when: fmtDateTime(new Date().toISOString()) })}
            </div>
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-bold text-ink-strong">
              {baby.name} <span className="text-ink-muted font-normal text-base">({baby.gender}, {t('full_report.f_age_days', { n: ageInDays(baby.dob) })})</span>
            </h1>
            <p className="text-sm text-ink-muted">{t('full_report.born_range', { dob: fmtDate(baby.dob), start: fmtDate(range.start), end: fmtDate(range.end) })}</p>
          </div>
        </div>

      {/* Baby profile card */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand-600" /> {t('full_report.profile_h')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Cell label={t('full_report.f_name')}          value={baby.name} />
          <Cell label={t('full_report.f_gender')}        value={baby.gender} />
          <Cell label={t('full_report.f_dob')}           value={fmtDate(baby.dob)} />
          <Cell label={t('full_report.f_age')}           value={t('full_report.f_age_days', { n: ageInDays(baby.dob) })} />
          <Cell label={t('full_report.f_curr_weight')}   value={fmtKg(w)} />
          <Cell label={t('full_report.f_birth_weight')}  value={fmtKg(Number(baby.birth_weight_kg))} />
          <Cell label={t('full_report.f_birth_height')}  value={fmtCm(Number(baby.birth_height_cm))} />
          <Cell label={t('full_report.f_factor')}        value={t('full_report.f_factor_unit', { n: baby.feeding_factor_ml_per_kg_per_day })} />
          {baby.notes && <div className="col-span-2 sm:col-span-4"><div className="text-xs text-ink-muted">{t('full_report.f_notes')}</div><div className="text-ink">{baby.notes}</div></div>}
        </CardContent>
      </Card>

      {/* KPI summary */}
      <section>
        <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{t('full_report.kpis_h', { label: range.label })}</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {show('kpi_feeds') && <KpiCard tint="peach"    icon={Milk}    label={t('full_report.kpi_feeds')}      value={fmtMl(f.total_feed_ml)} sub={f.feed_count === 1 ? t('full_report.kpi_feeds_sub_one', { ml: fmtMl(f.avg_feed_ml) }) : t('full_report.kpi_feeds_sub_n', { n: f.feed_count ?? 0, ml: fmtMl(f.avg_feed_ml) })} />}
          {show('kpi_target') && <KpiCard tint="peach"                   label={t('full_report.kpi_target')} value={fmtMl(f.recommended_feed_ml)} />}
          {show('kpi_feeding_pct') && (() => {
            const remaining = Math.max(0, Math.round((f.recommended_feed_ml ?? 0) - (f.total_feed_ml ?? 0)));
            const pct = Number(f.feeding_percentage ?? 0);
            return (
              <KpiCard tint="peach" label={t('full_report.kpi_feeding_pct')}
                value={fmtPct(pct)}
                sub={pct >= 100 ? t('full_report.kpi_goal_hit') : t('full_report.kpi_left_to_goal', { ml: fmtMl(remaining) })}
                tone={pct < 70 ? 'warning' : 'positive'} />
            );
          })()}
          {show('kpi_stools') && <KpiCard tint="mint"     icon={Droplet} label={t('full_report.kpi_stools')}     value={s.stool_count ?? 0} sub={t('full_report.kpi_stools_sub', { s: s.small_count ?? 0, m: s.medium_count ?? 0, l: s.large_count ?? 0 })} />}
          {show('kpi_doses') && <KpiCard tint="lavender" icon={Pill}    label={t('full_report.kpi_doses')} value={m.taken ?? 0} sub={t('full_report.kpi_doses_sub', { n: m.total_doses ?? 0, missed: m.missed ?? 0 })} />}
          {show('kpi_adherence') && <KpiCard tint="lavender"                label={t('full_report.kpi_adherence')}  value={fmtPct(m.adherence_pct)} tone={Number(m.adherence_pct) < 80 ? 'warning' : 'positive'} />}
          {show('kpi_weighings') && <KpiCard tint="brand"    icon={Scale}   label={t('full_report.kpi_weighings')}  value={(measurements.data ?? []).length} />}
          {show('kpi_files') && <KpiCard tint="brand"    icon={FileText} label={t('full_report.kpi_files')} value={(files.data ?? []).length} />}
        </div>
      </section>

      {/* Medications */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4 text-lavender-600" /> {t('full_report.sec_meds', { n: (allMeds.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(allMeds.data ?? []).length === 0 && <p className="text-ink-muted">{t('full_report.sec_meds_none')}</p>}
          {allMeds.data?.map(med => {
            const active = !med.ends_at || new Date(med.ends_at).getTime() > Date.now();
            return (
              <div key={med.id} className="py-2">
                <div className="font-medium text-ink-strong">
                  {med.name}{med.dosage ? ` · ${med.dosage}` : ''}{med.route !== 'oral' ? ` · ${med.route}` : ''}
                  {active ? <span className="ml-2 rounded-full bg-mint-100 text-mint-700 px-2 py-0.5 text-[10px] uppercase tracking-wider">{t('full_report.med_active')}</span>
                          : <span className="ml-2 rounded-full bg-slate-100 text-ink-muted px-2 py-0.5 text-[10px] uppercase tracking-wider">{t('full_report.med_ended')}</span>}
                </div>
                <div className="text-xs text-ink-muted">
                  {med.frequency_hours ? t('full_report.med_every', { n: med.frequency_hours }) : t('full_report.med_as_needed')} · {fmtDate(med.starts_at)}{med.ends_at ? ` → ${fmtDate(med.ends_at)}` : ''}
                  {med.prescribed_by ? ` · ${med.prescribed_by}` : ''}
                  {med.total_doses ? ` · ${t('full_report.med_total', { n: med.total_doses })}` : ''}
                </div>
                {med.notes && <div className="text-xs text-ink mt-1">{med.notes}</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Feedings */}
      {show('feed_log') && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Milk className="h-4 w-4 text-peach-600" /> {t('full_report.sec_feedings', { n: (feedings.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(feedings.data ?? []).length === 0 ? <p className="text-ink-muted">{t('full_report.sec_feedings_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">{t('full_report.th_time')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_type')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_amount')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_kcal')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_duration')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_source')}</th>
                    <th className="py-2">{t('full_report.th_notes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {feedings.data?.map(r => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDateTime(r.feeding_time)}</td>
                      <td className="py-2 pr-3">{r.milk_type}</td>
                      <td className="py-2 pr-3">{fmtMl(r.quantity_ml)}</td>
                      <td className="py-2 pr-3">{r.kcal ?? '—'}</td>
                      <td className="py-2 pr-3">{r.duration_min ? t('full_report.duration_min', { n: r.duration_min }) : '—'}</td>
                      <td className="py-2 pr-3 text-xs text-ink-muted">{r.source}</td>
                      <td className="py-2 text-xs text-ink-muted">{r.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Stool */}
      {show('stool_log') && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Droplet className="h-4 w-4 text-mint-600" /> {t('full_report.sec_stools', { n: (stools.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(stools.data ?? []).length === 0 ? <p className="text-ink-muted">{t('full_report.sec_stools_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">{t('full_report.th_time')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_size')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_quantity')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_color')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_consistency')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_rash')}</th>
                    <th className="py-2">{t('full_report.th_notes')}</th>
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
                      <td className="py-2 pr-3">{r.has_diaper_rash ? t('full_report.rash_yes') : '—'}</td>
                      <td className="py-2 text-xs text-ink-muted">{r.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* Doses */}
      {show('med_log') && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4 text-lavender-600" /> {t('full_report.sec_doses', { n: (doseLogs.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(doseLogs.data ?? []).length === 0 ? <p className="text-ink-muted">{t('full_report.sec_doses_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">{t('full_report.th_time')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_med')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_status')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_actual')}</th>
                    <th className="py-2">{t('full_report.th_notes')}</th>
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
      </Card>}

      {/* Measurements */}
      {show('measurement_log') && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Ruler className="h-4 w-4 text-brand-600" /> {t('full_report.sec_meas', { n: (measurements.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {(measurements.data ?? []).length === 0 ? <p className="text-ink-muted">{t('full_report.sec_meas_none')}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs text-ink-muted uppercase">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3">{t('full_report.th_time')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_weight')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_height')}</th>
                    <th className="py-2 pr-3">{t('full_report.th_head')}</th>
                    <th className="py-2">{t('full_report.th_notes')}</th>
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
      </Card>}

      {/* Files */}
      {show('files_section') && <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-ink-muted" /> {t('full_report.sec_files', { n: (files.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(files.data ?? []).length === 0 && <p className="text-ink-muted">{t('full_report.sec_files_none')}</p>}
          {files.data?.map(x => (
            <div key={x.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-ink-strong capitalize">{x.kind.replace('_', ' ')}{x.is_handwritten ? t('full_report.files_handwritten') : ''}</div>
                <div className="text-xs text-ink-muted">{x.mime_type} · {x.size_bytes ? `${Math.round(x.size_bytes / 1024)} KB` : '—'} · {fmtRelative(x.uploaded_at)}</div>
              </div>
              <span className="text-xs text-ink-muted">{t('full_report.files_ocr', { status: x.ocr_status ?? '—' })}</span>
            </div>
          ))}
        </CardContent>
      </Card>}

      {/* Caregivers */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-peach-600" /> {t('full_report.sec_caregivers', { n: (caregivers.data ?? []).length })}</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(caregivers.data ?? []).map(c => (
            <div key={c.user_id} className="flex items-center justify-between py-2">
              <span className="font-mono text-xs text-ink-muted">{c.user_id}</span>
              <span className="rounded-full bg-brand-100 text-brand-700 px-2 py-0.5 text-xs capitalize">{c.role}</span>
            </div>
          ))}
        </CardContent>
      </Card>

        <footer className="pt-4 text-center text-xs text-ink-muted">
          {t('full_report.footer_generated', { when: fmtDateTime(new Date().toISOString()) })}
        </footer>
      </div>
      {/* end #report-capture */}
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

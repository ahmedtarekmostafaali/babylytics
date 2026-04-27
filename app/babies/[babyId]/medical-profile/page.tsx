import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { Wordmark } from '@/components/Wordmark';
import { BabyAvatar } from '@/components/BabyAvatar';
import { ExportButton } from '@/components/ExportButton';
import { CarePlanInline } from '@/components/forms/CarePlanInline';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { fmtDate, fmtDateTime, fmtRelative, ageInDays } from '@/lib/dates';
import { fmtKg, fmtCm } from '@/lib/units';
import {
  HeartPulse, AlertTriangle, FlaskConical, Hospital, LogOut as DischargeIcon,
  Activity, Pill, Stethoscope, Syringe, Plus, ArrowRight,
  ClipboardList, Sparkles, ScanLine, Baby,
} from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Medical Profile' };

type Allergy = {
  id: string; allergen: string; category: string | null; reaction: string | null;
  severity: 'mild'|'moderate'|'severe'|'life_threatening';
  status: 'active'|'resolved'|'suspected'; diagnosed_at: string | null; notes: string | null;
};
type Condition = {
  id: string; name: string; icd_code: string | null; diagnosed_at: string | null;
  status: 'active'|'resolved'|'chronic'|'suspected'; treatment: string | null; notes: string | null;
};
type Admission = {
  id: string; admitted_at: string; hospital: string | null; department: string | null;
  reason: string | null; diagnosis: string | null; notes: string | null; file_id: string | null;
};
type Discharge = {
  id: string; discharged_at: string; admission_id: string | null; hospital: string | null;
  diagnosis: string | null; treatment: string | null; follow_up: string | null;
  notes: string | null; file_id: string | null;
};
type LabPanel = {
  id: string; panel_kind: string; panel_name: string; sample_at: string | null;
  result_at: string; lab_name: string | null; summary: string | null; abnormal: boolean;
  notes: string | null; file_id: string | null;
};
type LabItem = {
  id: string; panel_id: string; test_name: string; value: string | null; unit: string | null;
  reference: string | null; is_abnormal: boolean; flag: string | null;
};

export default async function MedicalProfile({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { isParent: canEdit } = await assertRole(params.babyId, {});
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const [
    { data: baby },
    { data: doctorsList },
    { data: latestMeasurement },
    { data: activeMeds },
    { data: admissionsRaw },
    { data: dischargesRaw },
    { data: labPanelsRaw },
    { data: allergiesRaw },
    { data: conditionsRaw },
    { data: carePlanRaw },
    { data: vaxList },
  ] = await Promise.all([
    supabase.from('babies').select('id,name,dob,gender,blood_type,birth_weight_kg,birth_height_cm,avatar_path,lifecycle_stage,edd,lmp,conception_method')
      .eq('id', params.babyId).is('deleted_at', null).single(),
    supabase.from('doctors').select('id,name,specialty,clinic,phone,is_primary')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false }).order('created_at', { ascending: true }),
    supabase.from('measurements').select('id,measured_at,weight_kg,height_cm,head_circ_cm')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('medications').select('id,name,dosage,route,starts_at,ends_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('starts_at', { ascending: false }),
    supabase.from('admissions').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('admitted_at', { ascending: false }),
    supabase.from('discharges').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('discharged_at', { ascending: false }),
    supabase.from('lab_panels').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('result_at', { ascending: false }),
    supabase.from('allergies').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('severity', { ascending: false }),
    supabase.from('medical_conditions').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('status', { ascending: true }).order('diagnosed_at', { ascending: false }),
    supabase.from('care_plan').select('medical_plan,feeding_plan,labs_needed,blood_type')
      .eq('baby_id', params.babyId).maybeSingle(),
    supabase.from('vaccinations').select('vaccine_name,status,scheduled_at,administered_at,dose_number,total_doses')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('administered_at', { ascending: false, nullsFirst: false }),
  ]);

  if (!baby) notFound();

  const admissions  = (admissionsRaw  ?? []) as Admission[];
  const discharges  = (dischargesRaw  ?? []) as Discharge[];
  const labPanels   = (labPanelsRaw   ?? []) as LabPanel[];
  const allergies   = (allergiesRaw   ?? []) as Allergy[];
  const conditions  = (conditionsRaw  ?? []) as Condition[];
  const doctors     = (doctorsList    ?? []) as { id: string; name: string; specialty: string | null; clinic: string | null; phone: string | null; is_primary: boolean }[];
  const vaxes       = (vaxList        ?? []) as { vaccine_name: string; status: string; scheduled_at: string | null; administered_at: string | null; dose_number: number | null; total_doses: number | null }[];

  // Pull lab items in one shot for displayed panels
  const panelIds = labPanels.map(p => p.id);
  const { data: labItemsRaw } = panelIds.length
    ? await supabase.from('lab_panel_items').select('*').in('panel_id', panelIds)
    : { data: [] as LabItem[] };
  const itemsByPanel: Record<string, LabItem[]> = {};
  for (const it of (labItemsRaw ?? []) as LabItem[]) {
    (itemsByPanel[it.panel_id] = itemsByPanel[it.panel_id] || []).push(it);
  }

  const carePlan = (carePlanRaw ?? {}) as { medical_plan: string | null; feeding_plan: string | null; labs_needed: string | null; blood_type: string | null };
  const avatarUrl = await signAvatarUrl(supabase, baby.avatar_path);

  // ---- Pregnancy history (only if a pregnancy_profile row exists) ----
  // The section renders read-only at any stage. While stage = pregnancy this
  // is a duplicate of what's already on the dashboard, but once the baby is
  // born it becomes the only place the prenatal record lives — and it's
  // included in the PDF export.
  const [{ data: pregProfileRaw }, { data: visitsRaw }, { data: ultrasoundsRaw }, { data: kicksRaw }] = await Promise.all([
    supabase.from('pregnancy_profile').select('*').eq('baby_id', params.babyId).maybeSingle(),
    supabase.from('prenatal_visits').select('id,visited_at,gestational_week,gestational_day,maternal_weight_kg,bp_systolic,bp_diastolic,fetal_heart_rate_bpm,fundal_height_cm,doctor_id,notes')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('visited_at', { ascending: false }),
    supabase.from('ultrasounds').select('id,scanned_at,gestational_week,gestational_day,bpd_mm,hc_mm,ac_mm,fl_mm,efw_g,fhr_bpm,placenta_position,amniotic_fluid,sex_predicted,anomalies,summary')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('scanned_at', { ascending: false }),
    supabase.from('fetal_movements').select('id,counted_at,duration_min,movements')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('counted_at', { ascending: false }),
  ]);
  const pregProfile = pregProfileRaw as null | {
    mother_dob: string | null; mother_blood_type: string | null;
    gravida: number | null; para: number | null;
    pre_pregnancy_weight_kg: number | null; pre_pregnancy_height_cm: number | null;
    risk_factors: string | null; notes: string | null;
  };
  const visits = (visitsRaw ?? []) as Array<{
    id: string; visited_at: string;
    gestational_week: number | null; gestational_day: number | null;
    maternal_weight_kg: number | null; bp_systolic: number | null; bp_diastolic: number | null;
    fetal_heart_rate_bpm: number | null; fundal_height_cm: number | null;
    doctor_id: string | null; notes: string | null;
  }>;
  const ultrasounds = (ultrasoundsRaw ?? []) as Array<{
    id: string; scanned_at: string;
    gestational_week: number | null; gestational_day: number | null;
    bpd_mm: number | null; hc_mm: number | null; ac_mm: number | null; fl_mm: number | null;
    efw_g: number | null; fhr_bpm: number | null;
    placenta_position: string | null; amniotic_fluid: string | null;
    sex_predicted: string | null; anomalies: string | null; summary: string | null;
  }>;
  const kicks = (kicksRaw ?? []) as Array<{ id: string; counted_at: string; duration_min: number; movements: number }>;
  const hasPregnancyData = !!pregProfile || visits.length > 0 || ultrasounds.length > 0 || kicks.length > 0;
  const totalKicks = kicks.reduce((sum, k) => sum + k.movements, 0);
  const totalKickMinutes = kicks.reduce((sum, k) => sum + k.duration_min, 0);

  // ---- Auto summary inputs ----
  const dob = baby.dob;
  const ageDays = ageInDays(dob);
  const ageStr = ageDays >= 365
    ? `${Math.floor(ageDays / 365)}y ${Math.floor((ageDays % 365) / 30)}m`
    : ageDays >= 30
      ? `${Math.floor(ageDays / 30)}m ${ageDays % 30}d`
      : `${ageDays}d`;

  const severeAllergies = allergies.filter(a => a.status === 'active' && (a.severity === 'severe' || a.severity === 'life_threatening'));
  const otherAllergies  = allergies.filter(a => a.status === 'active' && !(a.severity === 'severe' || a.severity === 'life_threatening'));
  const activeConditions = conditions.filter(c => c.status === 'active' || c.status === 'chronic');
  const ninetyDaysAgo = Date.now() - 90 * 86400000;
  const recentAbnormalLabs = labPanels.filter(p => p.abnormal && new Date(p.result_at).getTime() >= ninetyDaysAgo);
  const recentAbnormalRows = (labItemsRaw ?? []).filter(i =>
    i.is_abnormal && labPanels.some(p => p.id === i.panel_id && new Date(p.result_at).getTime() >= ninetyDaysAgo)
  );
  const givenVax = vaxes.filter(v => v.status === 'administered').length;
  const dueVax   = vaxes.filter(v => v.status === 'scheduled').length;

  const generatedAt = new Date();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Toolbar — excluded from export */}
      <div className="flex items-center justify-between flex-wrap gap-3 no-export">
        <div>
          <Link href={`/babies/${params.babyId}`} className="text-sm text-ink-muted hover:underline">{t('mp.back_overview')}</Link>
          <h1 className="text-2xl font-bold text-ink-strong mt-1 inline-flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-coral-500" /> {t('mp.title')}
          </h1>
          <p className="text-sm text-ink-muted">{t('mp.subtitle')}</p>
        </div>
        <ExportButton filenameHint={t('mp.export_filename', { name: baby.name })} label={t('mp.save_share')} />
      </div>

      {/* Quick-add bar */}
      {canEdit && (
        <div className="flex flex-wrap gap-2 no-export">
          <QuickAddLink href={`/babies/${params.babyId}/medical-profile/allergies/new`} icon={AlertTriangle} label={t('mp.qa_allergy')} tint="coral" />
          <QuickAddLink href={`/babies/${params.babyId}/medical-profile/conditions/new`} icon={Activity}      label={t('mp.qa_condition')} tint="brand" />
          <QuickAddLink href={`/babies/${params.babyId}/medical-profile/admissions/new`} icon={Hospital}     label={t('mp.qa_admission')} tint="lavender" />
          <QuickAddLink href={`/babies/${params.babyId}/medical-profile/discharges/new`} icon={DischargeIcon} label={t('mp.qa_discharge')} tint="mint" />
          <QuickAddLink href={`/babies/${params.babyId}/medical-profile/labs/new`}       icon={FlaskConical} label={t('mp.qa_lab')} tint="peach" />
        </div>
      )}

      {/* ============ Exportable area ============ */}
      <div id="report-capture" className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        {/* Header band */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-coral-500">
          <div className="flex items-center gap-3">
            <BabyAvatar url={avatarUrl} size="md" />
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-muted">{t('mp.eyebrow')}</div>
              <h2 className="text-xl font-bold text-ink-strong">{baby.name}</h2>
              <p className="text-xs text-ink-muted">
                {fmtDate(dob)} · {ageStr} · {baby.gender ?? t('mp.gender_unspecified')} · {t('mp.blood_type_label')} {carePlan.blood_type ?? baby.blood_type ?? '—'}
              </p>
            </div>
          </div>
          <Wordmark size="sm" />
        </div>

        {/* === AUTO SUMMARY === */}
        <section className="rounded-2xl bg-gradient-to-br from-brand-50 via-lavender-50 to-coral-50 border border-brand-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-brand-700 uppercase tracking-wide">{t('mp.summary_eyebrow')}</h3>
          </div>
          <ul className="text-sm text-ink-strong space-y-1.5 leading-relaxed">
            <li>
              {t('mp.summary_is_old', { name: '__N__', age: ageStr, gender: baby.gender ?? t('mp.gender_unspecified') }).split('__N__').map((part, i, arr) =>
                i < arr.length - 1
                  ? <span key={i}><strong>{baby.name}</strong>{part}</span>
                  : <span key={i}>{part}</span>
              )}
              <strong>{carePlan.blood_type ?? baby.blood_type ?? t('mp.blood_unknown')}</strong>
              {t('mp.summary_is_old_tail')}
              {latestMeasurement && (
                <>{t('mp.summary_latest_meas')}
                  {latestMeasurement.weight_kg ? `${fmtKg(latestMeasurement.weight_kg)}` : '—'}
                  {latestMeasurement.height_cm ? ` · ${fmtCm(latestMeasurement.height_cm)}` : ''}
                  {t('mp.summary_meas_paren', { rel: fmtRelative(latestMeasurement.measured_at) })}
                </>
              )}
            </li>
            {severeAllergies.length > 0 && (
              <li className="text-coral-700">
                <strong>{t('mp.summary_severe')}</strong>{' '}
                {severeAllergies.map(a => `${a.allergen} (${prettySeverity(a.severity, t)})`).join(', ')}.
              </li>
            )}
            {otherAllergies.length > 0 && (
              <li>
                <strong>{t('mp.summary_other_aller')}</strong>{' '}
                {otherAllergies.map(a => a.allergen).join(', ')}.
              </li>
            )}
            {activeConditions.length > 0 && (
              <li>
                <strong>{t('mp.summary_active_cond')}</strong>{' '}
                {activeConditions.map(c => c.name).join(', ')}.
              </li>
            )}
            {(activeMeds && activeMeds.length > 0) && (
              <li>
                <strong>{t('mp.summary_current_meds')}</strong>{' '}
                {activeMeds.map(m => `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`).join(', ')}.
              </li>
            )}
            {admissions.length > 0 && (
              <li>
                <strong>{t('mp.summary_hosp')}</strong> {admissions.length}
                {admissions[0] && <> — {t('mp.summary_hosp_recent', { date: fmtDate(admissions[0].admitted_at) })}{admissions[0].hospital ? t('mp.summary_at_hospital', { hospital: admissions[0].hospital }) : ''}{admissions[0].reason ? t('mp.summary_hosp_reason', { reason: admissions[0].reason }) : '.'}</>}
              </li>
            )}
            {recentAbnormalLabs.length > 0 && (
              <li className="text-peach-800">
                <strong>{t('mp.summary_recent_abn')}</strong>{' '}
                {recentAbnormalLabs.map(p => p.panel_name).join(', ')}.
                {recentAbnormalRows.length > 0 && <> {t('mp.summary_specifically')} {recentAbnormalRows.slice(0, 5).map(r => `${r.test_name}${r.flag ? ` (${r.flag})` : ''}`).join(', ')}.</>}
              </li>
            )}
            <li>
              <strong>{t('mp.summary_vax')}</strong> {t('mp.summary_vax_given', { n: givenVax })}{dueVax > 0 ? t('mp.summary_vax_scheduled', { n: dueVax }) : ''}.
            </li>
            {doctors.length > 0 && (
              <li>
                <strong>{t('mp.summary_care_team')}</strong>{' '}
                {doctors.map(d => `${d.name}${d.specialty ? ` (${d.specialty})` : ''}${d.is_primary ? ' ' + t('mp.summary_primary') : ''}`).join(' · ')}.
              </li>
            )}
          </ul>
          <p className="mt-3 text-[10px] text-ink-muted">
            {t('mp.summary_generated', { when: fmtDateTime(generatedAt.toISOString()) })}
          </p>
        </section>

        {/* === ALLERGIES === */}
        <ProfileSection icon={AlertTriangle} title={t('mp.sec_allergies')} tint="coral"
          empty={allergies.length === 0}
          emptyText={t('mp.empty_allergies')}
          addLabel={t('mp.add')}
          addHref={canEdit ? `/babies/${params.babyId}/medical-profile/allergies/new` : null}>
          <div className="grid gap-3 sm:grid-cols-2">
            {allergies.map(a => (
              <div key={a.id} className={`rounded-xl border p-3 ${
                a.severity === 'life_threatening' || a.severity === 'severe'
                  ? 'border-coral-300 bg-coral-50' : 'border-slate-200 bg-white'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-strong">{a.allergen}</div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-muted mt-0.5">
                      {a.category ?? t('mp.aller_unknown_cat')} · {prettySeverity(a.severity, t)} · {a.status}
                    </div>
                    {a.reaction && <div className="text-xs text-ink mt-1.5">{t('mp.aller_reaction')} {a.reaction}</div>}
                    {a.notes && <div className="text-xs text-ink-muted mt-1">{a.notes}</div>}
                    {a.diagnosed_at && <div className="text-[11px] text-ink-muted mt-1">{t('mp.aller_diagnosed', { date: fmtDate(a.diagnosed_at) })}</div>}
                  </div>
                  {canEdit && <EditLink href={`/babies/${params.babyId}/medical-profile/allergies/${a.id}`} t={t} />}
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>

        {/* === CONDITIONS === */}
        <ProfileSection icon={Activity} title={t('mp.sec_conditions')} tint="brand"
          empty={conditions.length === 0} emptyText={t('mp.empty_conditions')}
          addLabel={t('mp.add')}
          addHref={canEdit ? `/babies/${params.babyId}/medical-profile/conditions/new` : null}>
          <div className="grid gap-3 sm:grid-cols-2">
            {conditions.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-strong">{c.name}</div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-muted mt-0.5">
                      {c.status}{c.icd_code ? ` · ${c.icd_code}` : ''}{c.diagnosed_at ? ` · ${t('mp.cond_dx', { date: fmtDate(c.diagnosed_at) })}` : ''}
                    </div>
                    {c.treatment && <div className="text-xs text-ink mt-1.5"><strong>{t('mp.cond_plan')}</strong> {c.treatment}</div>}
                    {c.notes && <div className="text-xs text-ink-muted mt-1">{c.notes}</div>}
                  </div>
                  {canEdit && <EditLink href={`/babies/${params.babyId}/medical-profile/conditions/${c.id}`} t={t} />}
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>

        {/* === HOSPITALIZATIONS (admissions + discharges interleaved) === */}
        <ProfileSection icon={Hospital} title={t('mp.sec_hosp')} tint="lavender"
          empty={admissions.length === 0 && discharges.length === 0}
          emptyText={t('mp.empty_hosp')}
          addHref={canEdit ? `/babies/${params.babyId}/medical-profile/admissions/new` : null}
          addLabel={t('mp.add_admission')}>
          <div className="space-y-3">
            {[
              ...admissions.map(a => ({ kind: 'admission' as const, at: a.admitted_at, item: a })),
              ...discharges.map(d => ({ kind: 'discharge' as const, at: d.discharged_at, item: d })),
            ].sort((x, y) => +new Date(y.at) - +new Date(x.at)).map(entry => (
              entry.kind === 'admission' ? (
                <HospEvent key={`a-${entry.item.id}`} icon={Hospital} title={t('mp.hosp_admitted')} t={t}
                  whenIso={entry.item.admitted_at} where={entry.item.hospital} dept={entry.item.department}
                  reason={entry.item.reason} diagnosis={entry.item.diagnosis} notes={entry.item.notes}
                  editHref={canEdit ? `/babies/${params.babyId}/medical-profile/admissions/${entry.item.id}` : null} />
              ) : (
                <HospEvent key={`d-${entry.item.id}`} icon={DischargeIcon} title={t('mp.hosp_discharged')} t={t}
                  whenIso={entry.item.discharged_at} where={entry.item.hospital}
                  reason={entry.item.diagnosis} treatment={entry.item.treatment} followUp={entry.item.follow_up}
                  notes={entry.item.notes} discharge
                  editHref={canEdit ? `/babies/${params.babyId}/medical-profile/discharges/${entry.item.id}` : null} />
              )
            ))}
          </div>
        </ProfileSection>

        {/* === LAB RESULTS === */}
        <ProfileSection icon={FlaskConical} title={t('mp.sec_labs')} tint="peach"
          empty={labPanels.length === 0} emptyText={t('mp.empty_labs')}
          addLabel={t('mp.add')}
          addHref={canEdit ? `/babies/${params.babyId}/medical-profile/labs/new` : null}>
          <div className="space-y-3">
            {labPanels.map(p => {
              const items = itemsByPanel[p.id] ?? [];
              return (
                <div key={p.id} className={`rounded-xl border p-3 ${p.abnormal ? 'border-peach-300 bg-peach-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-strong">
                        {p.panel_name}
                        {p.abnormal && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-100 px-1.5 py-0.5 rounded">{t('mp.lab_abnormal')}</span>}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-ink-muted mt-0.5">
                        {p.panel_kind} · {fmtDate(p.result_at)}{p.lab_name ? ` · ${p.lab_name}` : ''}
                      </div>
                      {p.summary && <div className="text-xs text-ink mt-1.5">{p.summary}</div>}
                    </div>
                    {canEdit && <EditLink href={`/babies/${params.babyId}/medical-profile/labs/${p.id}`} t={t} />}
                  </div>
                  {items.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted">
                            <th className="py-1 pr-3">{t('mp.lab_th_test')}</th>
                            <th className="py-1 pr-3">{t('mp.lab_th_value')}</th>
                            <th className="py-1 pr-3">{t('mp.lab_th_unit')}</th>
                            <th className="py-1 pr-3">{t('mp.lab_th_ref')}</th>
                            <th className="py-1">{t('mp.lab_th_flag')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map(it => (
                            <tr key={it.id} className={it.is_abnormal ? 'text-coral-700 font-semibold' : ''}>
                              <td className="py-1 pr-3">{it.test_name}</td>
                              <td className="py-1 pr-3">{it.value ?? '—'}</td>
                              <td className="py-1 pr-3">{it.unit ?? ''}</td>
                              <td className="py-1 pr-3">{it.reference ?? ''}</td>
                              <td className="py-1 uppercase">{it.flag ?? (it.is_abnormal ? t('mp.lab_abn_short') : '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ProfileSection>

        {/* === ACTIVE MEDICATIONS (read from existing meds table) === */}
        <ProfileSection icon={Pill} title={t('mp.sec_active_meds')} tint="lavender"
          empty={!activeMeds || activeMeds.length === 0}
          emptyText={t('mp.empty_meds')}
          addHref={null}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(activeMeds ?? []).map((m: { id: string; name: string; dosage: string | null; route: string; starts_at: string; ends_at: string | null }) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="font-semibold text-ink-strong">{m.name}</div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted mt-0.5">
                  {m.dosage ?? '—'} · {m.route} · {fmtDate(m.starts_at)}{m.ends_at ? ` → ${fmtDate(m.ends_at)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>

        {/* === CARE PLAN === */}
        <ProfileSection icon={ClipboardList} title={t('mp.sec_care_plan')} tint="mint"
          empty={false} addHref={null}>
          <CarePlanInline babyId={params.babyId}
            initial={{
              medical_plan: carePlan.medical_plan,
              feeding_plan: carePlan.feeding_plan,
              labs_needed:  carePlan.labs_needed,
              blood_type:   carePlan.blood_type ?? baby.blood_type ?? '',
            }}
            canEdit={canEdit} />
        </ProfileSection>

        {/* === CARE TEAM === */}
        <ProfileSection icon={Stethoscope} title={t('mp.sec_care_team')} tint="brand"
          empty={doctors.length === 0} emptyText={t('mp.empty_doctors')}
          addHref={canEdit ? `/babies/${params.babyId}/doctors/new` : null}
          addLabel={t('mp.add_doctor')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {doctors.map(d => (
              <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-strong">
                      {d.name}{d.is_primary && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded">{t('mp.care_primary')}</span>}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-ink-muted mt-0.5">
                      {d.specialty ?? t('mp.care_general')}{d.clinic ? ` · ${d.clinic}` : ''}
                    </div>
                    {d.phone && <div className="text-xs text-ink mt-1">{d.phone}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>

        {/* === VACCINATIONS (compact) === */}
        <ProfileSection icon={Syringe} title={t('mp.sec_vaccinations')} tint="peach"
          empty={vaxes.length === 0} emptyText={t('mp.empty_vax')}
          addHref={null}>
          <p className="text-sm text-ink mb-2">{t('mp.vax_summary', { given: givenVax, due: dueVax })}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {vaxes.slice(0, 8).map((v, i) => (
              <div key={i} className="text-xs flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-slate-200">
                <span className={`h-2 w-2 rounded-full ${v.status === 'administered' ? 'bg-mint-500' : v.status === 'scheduled' ? 'bg-peach-500' : 'bg-slate-300'}`} />
                <span className="font-semibold text-ink-strong truncate">{v.vaccine_name}</span>
                {v.dose_number && <span className="text-ink-muted">d{v.dose_number}{v.total_doses ? `/${v.total_doses}` : ''}</span>}
                <span className="ml-auto text-[10px] text-ink-muted uppercase">
                  {v.status === 'administered' && v.administered_at ? fmtDate(v.administered_at) : v.scheduled_at ? t('mp.vax_due', { date: fmtDate(v.scheduled_at) }) : v.status}
                </span>
              </div>
            ))}
          </div>
        </ProfileSection>

        {/* === PREGNANCY HISTORY === only if there's prenatal data on file */}
        {hasPregnancyData && (
          <div id="pregnancy-history" />
        )}
        {hasPregnancyData && (
          <ProfileSection icon={Baby} title={t('mp.sec_preg_history')} tint="lavender"
            empty={false} addHref={null}>
            <div className="space-y-4">
              {pregProfile && (
                <div className="rounded-xl border border-lavender-200 bg-lavender-50/40 p-4 grid gap-3 sm:grid-cols-2">
                  <PregField label={t('mp.preg_edd')}  value={baby.edd ? fmtDate(baby.edd) : null} emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_lmp')}  value={baby.lmp ? fmtDate(baby.lmp) : null} emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_mother_dob')}    value={pregProfile.mother_dob ? fmtDate(pregProfile.mother_dob) : null} emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_mother_blood')}  value={pregProfile.mother_blood_type} emptyLabel={t('mp.preg_not_set')} mono />
                  <PregField label={t('mp.preg_grav_para')} value={
                    pregProfile.gravida != null || pregProfile.para != null
                      ? `${pregProfile.gravida ?? '—'} / ${pregProfile.para ?? '—'}` : null
                  } emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_pre_weight')} value={pregProfile.pre_pregnancy_weight_kg ? `${pregProfile.pre_pregnancy_weight_kg} kg` : null} emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_conception')} value={baby.conception_method} emptyLabel={t('mp.preg_not_set')} />
                  <PregField label={t('mp.preg_height')} value={pregProfile.pre_pregnancy_height_cm ? `${pregProfile.pre_pregnancy_height_cm} cm` : null} emptyLabel={t('mp.preg_not_set')} />
                  {pregProfile.risk_factors && (
                    <div className="sm:col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('mp.preg_risk')}</div>
                      <div className="mt-1 text-sm text-ink-strong whitespace-pre-wrap">{pregProfile.risk_factors}</div>
                    </div>
                  )}
                  {pregProfile.notes && (
                    <div className="sm:col-span-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{t('mp.preg_notes')}</div>
                      <div className="mt-1 text-sm text-ink-strong whitespace-pre-wrap">{pregProfile.notes}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Counts row */}
              <div className="grid gap-3 grid-cols-3 text-center">
                <PregCount label={t('mp.preg_count_visits')} value={visits.length} icon={Stethoscope} tint="lavender" />
                <PregCount label={t('mp.preg_count_us')}      value={ultrasounds.length} icon={ScanLine} tint="brand" />
                <PregCount label={t('mp.preg_count_kicks')}    value={totalKicks} sub={t('mp.preg_min_suffix', { n: totalKickMinutes })} icon={Activity} tint="coral" />
              </div>

              {ultrasounds.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider mb-2 mt-2">{t('mp.preg_us_timeline')}</h4>
                  <ul className="space-y-2">
                    {ultrasounds.map(u => {
                      const ga = u.gestational_week != null ? `${u.gestational_week}w${u.gestational_day != null ? ` ${u.gestational_day}d` : ''}` : null;
                      return (
                        <li key={u.id} className="rounded-xl border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <ScanLine className="h-3.5 w-3.5 text-brand-600" />
                            <span className="font-semibold text-ink-strong">{fmtDate(u.scanned_at)}</span>
                            {ga && <span className="text-[10px] uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{ga}</span>}
                            {u.sex_predicted && u.sex_predicted !== 'undetermined' && (
                              <span className="text-[10px] uppercase tracking-wider text-coral-700 bg-coral-50 px-2 py-0.5 rounded-full">{u.sex_predicted}</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink">
                            {u.efw_g != null && <span>EFW {u.efw_g} g</span>}
                            {u.fhr_bpm != null && <span>♥ {u.fhr_bpm} bpm</span>}
                            {u.bpd_mm != null && <span>BPD {u.bpd_mm} mm</span>}
                            {u.hc_mm  != null && <span>HC {u.hc_mm} mm</span>}
                            {u.ac_mm  != null && <span>AC {u.ac_mm} mm</span>}
                            {u.fl_mm  != null && <span>FL {u.fl_mm} mm</span>}
                          </div>
                          {u.summary && <p className="mt-1.5 text-xs text-ink-muted">{u.summary}</p>}
                          {u.anomalies && <p className="mt-1 text-xs text-coral-700">⚠ {u.anomalies}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {visits.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-ink-strong uppercase tracking-wider mb-2 mt-2">{t('mp.preg_visits_h')}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted">
                          <th className="py-1 pr-3">{t('mp.preg_th_date')}</th>
                          <th className="py-1 pr-3">{t('mp.preg_th_ga')}</th>
                          <th className="py-1 pr-3">{t('mp.preg_th_weight')}</th>
                          <th className="py-1 pr-3">{t('mp.preg_th_bp')}</th>
                          <th className="py-1 pr-3">{t('mp.preg_th_fhr')}</th>
                          <th className="py-1 pr-3">{t('mp.preg_th_fundal')}</th>
                          <th className="py-1">{t('mp.preg_th_notes')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {visits.map(v => (
                          <tr key={v.id}>
                            <td className="py-1.5 pr-3">{fmtDate(v.visited_at)}</td>
                            <td className="py-1.5 pr-3">{v.gestational_week != null ? `${v.gestational_week}w${v.gestational_day != null ? ` ${v.gestational_day}d` : ''}` : '—'}</td>
                            <td className="py-1.5 pr-3">{v.maternal_weight_kg != null ? `${v.maternal_weight_kg} kg` : '—'}</td>
                            <td className="py-1.5 pr-3">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '—'}</td>
                            <td className="py-1.5 pr-3">{v.fetal_heart_rate_bpm ?? '—'}</td>
                            <td className="py-1.5 pr-3">{v.fundal_height_cm != null ? `${v.fundal_height_cm} cm` : '—'}</td>
                            <td className="py-1.5 truncate max-w-[12rem]">{v.notes ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </ProfileSection>
        )}

        {/* Footer in export */}
        <div className="pt-3 border-t border-slate-200 text-[10px] text-ink-muted">
          {t('mp.footer_disclaimer')}
        </div>
      </div>
    </div>
  );
}

function PregField({ label, value, emptyLabel, mono }: { label: string; value: string | null | undefined; emptyLabel: string; mono?: boolean }) {
  const empty = !value;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`mt-1 ${mono ? 'font-mono' : ''} ${empty ? 'text-ink-muted italic' : 'text-ink-strong'}`}>
        {empty ? emptyLabel : value}
      </div>
    </div>
  );
}

function PregCount({ label, value, sub, icon: Icon, tint }: {
  label: string; value: number; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'lavender'|'brand'|'coral';
}) {
  const tintCss = {
    lavender: 'bg-lavender-100 text-lavender-700',
    brand:    'bg-brand-100 text-brand-700',
    coral:    'bg-coral-100 text-coral-700',
  }[tint];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <span className={`mx-auto h-7 w-7 rounded-lg grid place-items-center mb-1 ${tintCss}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="text-2xl font-bold text-ink-strong tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}{sub ? ` · ${sub}` : ''}</div>
    </div>
  );
}

// ============================================================================
// Helpers / sub-components
// ============================================================================

function prettySeverity(s: 'mild'|'moderate'|'severe'|'life_threatening', t: TFunc): string {
  switch (s) {
    case 'life_threatening': return t('mp.sev_life');
    case 'severe':           return t('mp.sev_severe');
    case 'moderate':         return t('mp.sev_moderate');
    case 'mild':             return t('mp.sev_mild');
  }
}

function QuickAddLink({ href, icon: Icon, label, tint }: {
  href: string; icon: React.ComponentType<{ className?: string }>;
  label: string; tint: 'coral'|'brand'|'lavender'|'mint'|'peach';
}) {
  const tintCss = {
    coral:    'bg-coral-100 text-coral-700 hover:bg-coral-200',
    brand:    'bg-brand-100 text-brand-700 hover:bg-brand-200',
    lavender: 'bg-lavender-100 text-lavender-700 hover:bg-lavender-200',
    mint:     'bg-mint-100 text-mint-700 hover:bg-mint-200',
    peach:    'bg-peach-100 text-peach-700 hover:bg-peach-200',
  }[tint];
  return (
    <Link href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tintCss}`}>
      <Plus className="h-3 w-3" /> <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

function ProfileSection({
  icon: Icon, title, tint, empty, emptyText, addHref, addLabel, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tint: 'coral'|'brand'|'lavender'|'mint'|'peach';
  empty: boolean;
  emptyText?: string;
  addHref: string | null;
  addLabel?: string;
  children: React.ReactNode;
}) {
  const tintCss = {
    coral:    'text-coral-600 bg-coral-100',
    brand:    'text-brand-600 bg-brand-100',
    lavender: 'text-lavender-600 bg-lavender-100',
    mint:     'text-mint-600 bg-mint-100',
    peach:    'text-peach-600 bg-peach-100',
  }[tint];
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-7 w-7 rounded-lg grid place-items-center ${tintCss}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider">{title}</h3>
        {addHref && (
          <Link href={addHref}
            className="ml-auto text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 no-export">
            <Plus className="h-3 w-3" /> {addLabel ?? 'Add'}
          </Link>
        )}
      </div>
      {empty ? (
        <div className="text-sm text-ink-muted italic px-3 py-4 rounded-xl bg-slate-50/60 border border-dashed border-slate-200">
          {emptyText}
        </div>
      ) : children}
    </section>
  );
}

function HospEvent({
  icon: Icon, title, whenIso, where, dept, reason, diagnosis, treatment, followUp, notes, discharge, editHref, t,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  whenIso: string;
  where: string | null;
  dept?: string | null;
  reason?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  followUp?: string | null;
  notes?: string | null;
  discharge?: boolean;
  editHref: string | null;
  t: TFunc;
}) {
  return (
    <div className={`rounded-xl border p-3 ${discharge ? 'bg-mint-50/40 border-mint-200' : 'bg-lavender-50/40 border-lavender-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${discharge ? 'bg-mint-100 text-mint-700' : 'bg-lavender-100 text-lavender-700'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-ink-strong">
              {title} · {fmtDate(whenIso)}
            </div>
            {editHref && <EditLink href={editHref} t={t} />}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-ink-muted">
            {[where, dept].filter(Boolean).join(' · ') || '—'}
          </div>
          {reason     && <div className="text-xs text-ink mt-1.5"><strong>{discharge ? t('mp.hosp_diagnosis') : t('mp.hosp_reason')}</strong> {reason}</div>}
          {diagnosis && !discharge && <div className="text-xs text-ink mt-1"><strong>{t('mp.hosp_diagnosis')}</strong> {diagnosis}</div>}
          {treatment && <div className="text-xs text-ink mt-1"><strong>{t('mp.hosp_treatment')}</strong> {treatment}</div>}
          {followUp  && <div className="text-xs text-ink mt-1"><strong>{t('mp.hosp_followup')}</strong> {followUp}</div>}
          {notes     && <div className="text-xs text-ink-muted mt-1">{notes}</div>}
        </div>
      </div>
    </div>
  );
}

function EditLink({ href, t }: { href: string; t: TFunc }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-600 hover:underline no-export">
      {t('mp.edit')} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

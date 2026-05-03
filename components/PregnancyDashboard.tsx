import Link from 'next/link';
import { BabyAvatar } from '@/components/BabyAvatar';
import { MarkAsBornDialog } from '@/components/MarkAsBornDialog';
import { NotificationsBell } from '@/components/NotificationsBell';
import { ChatBell } from '@/components/ChatBell';
import { VoiceCommander } from '@/components/VoiceCommander';
import {
  Stethoscope, ScanLine, Activity, HeartPulse, CalendarClock, Plus,
  Sparkles, ArrowRight, Pill, Heart, Apple, BookOpen, SlidersHorizontal,
  Baby as BabyIcon, CalendarDays, ChevronRight,
} from 'lucide-react';
import {
  fmtGestationalAge, eddDistanceDays, gestationalAge, trimester, bpCategory,
} from '@/lib/lifecycle';
import { weekInsight, gainStatus, dailySize, monthExpectations, trimesterOverview } from '@/lib/pregnancy_weeks';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { fmtKg } from '@/lib/units';
import { tFor, type Lang } from '@/lib/i18n';
import { SuggestionsCard } from '@/components/SuggestionsCard';

const SYMPTOM_EMOJI: Record<string, string> = {
  nausea: '🤢', vomiting: '🤮', dizziness: '😵‍💫', headache: '🤕',
  swelling: '🦶', contractions: '💥', fatigue: '😴', heartburn: '🔥',
  back_pain: '🩹', mood_swings: '🎭', cramping: '⚡', breathlessness: '🫁',
  other: '✏️',
};

type Summary = {
  edd: string | null;
  lmp: string | null;
  gestational_days: number | null;
  edd_distance_days: number | null;
  latest_bp_systolic: number | null;
  latest_bp_diastolic: number | null;
  latest_fhr: number | null;
  latest_weight_kg: number | null;
  weight_gain_kg: number | null;
  kicks_today: number | null;
  ultrasound_count: number | null;
  prenatal_visit_count: number | null;
};

export function PregnancyDashboard({
  babyId, babyName, avatarUrl, edd, lmp, summary, latestUltrasound, nextAppointment, canEdit,
  prePregnancyWeightKg, prePregnancyHeightCm, hiddenWidgets, lang = 'en',
  recentSymptoms = [],
}: {
  babyId: string;
  babyName: string;
  avatarUrl: string | null;
  edd: string | null;
  lmp: string | null;
  summary: Summary;
  latestUltrasound: { id: string; scanned_at: string; gestational_week: number | null; summary: string | null; efw_g: number | null } | null;
  nextAppointment: { scheduled_at: string; doctor_name: string | null; purpose: string | null } | null;
  canEdit: boolean;
  prePregnancyWeightKg: number | null;
  prePregnancyHeightCm: number | null;
  hiddenWidgets?: string[];
  lang?: Lang;
  recentSymptoms?: { id: string; logged_at: string; kind: string; severity: number }[];
}) {
  const t = tFor(lang);
  const hidden = new Set(hiddenWidgets ?? []);
  const show = (id: string) => !hidden.has(id);
  const ga = gestationalAge(edd, lmp);
  const distance = eddDistanceDays(edd);
  const tri = ga ? trimester(ga.total_days) : null;
  const bpCat = bpCategory(summary.latest_bp_systolic, summary.latest_bp_diastolic);
  const lateStage = ga ? ga.total_days >= 252 : false; // ≥ 36w → emphasize Mark as Born CTA
  const kicksLow = ga && ga.total_days >= 196 && (summary.kicks_today ?? 0) < 10; // ≥ 28w

  const insight = ga ? weekInsight(ga.weeks) : null;
  const gain = gainStatus(
    summary.weight_gain_kg ?? null,
    prePregnancyWeightKg,
    prePregnancyHeightCm,
    ga?.weeks ?? null,
  );
  const today = ga ? dailySize(ga.total_days) : null;
  const monthExp = ga ? monthExpectations(ga.weeks) : null;
  const triExp = tri ? trimesterOverview(tri) : null;
  const efw = latestUltrasound?.efw_g ?? null;
  // % of "expected" weight for today — gives a quick on-track read.
  const efwPct = today && efw && today.weight_g > 0
    ? Math.round((efw / today.weight_g) * 100)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[32px] border border-lavender-200/70 bg-gradient-to-br from-lavender-50 via-coral-50 to-peach-50 shadow-card p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <BabyAvatar url={avatarUrl} size="2xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-lavender-700">{t('pregd.eyebrow')}</div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-strong mt-1">{babyName}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {ga && <Chip tint="lavender">{ga.weeks}w {ga.days}d</Chip>}
              {tri && <Chip tint="brand">{t('pregd.chip_trimester', { n: tri })}</Chip>}
              {edd && <Chip tint="coral">{t('pregd.chip_edd', { date: fmtDate(edd) })}</Chip>}
              {distance != null && (
                <Chip tint={distance < 0 ? 'peach' : 'mint'}>
                  {distance < 0
                    ? t('pregd.chip_days_past', { n: Math.abs(distance) })
                    : t('pregd.chip_days_to', { n: distance })}
                </Chip>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href={`/babies/${babyId}/dashboard-settings`}
              className="h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
              title={t('pregd.customize')} aria-label={t('pregd.customize')}>
              <SlidersHorizontal className="h-4 w-4 text-ink" />
            </Link>
            <VoiceCommander babyId={babyId} lang={lang} />
            <ChatBell babyId={babyId} />
            <NotificationsBell babyId={babyId} />
            {canEdit && show('mark_as_born_cta') && <MarkAsBornDialog babyId={babyId} babyName={babyName} />}
          </div>
        </div>

        {lateStage && show('late_term_banner') && (
          <div className="mt-4 rounded-xl bg-white/70 border border-coral-200 px-4 py-2 text-sm text-coral-800 inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {t('pregd.late_term')}
          </div>
        )}
      </div>

      {/* Daily size card — interpolated length/weight + ultrasound EFW overlay */}
      {today && show('daily_size') && (
        <div className="relative overflow-hidden rounded-3xl border border-coral-200 bg-gradient-to-br from-coral-50 via-white to-mint-50 p-5 shadow-card">
          <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-coral-200/40 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-5 flex-wrap">
            <div className="text-7xl leading-none select-none">{today.emoji}</div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-coral-700">
                {t('pregd.daily_size_eyebrow')}
              </div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-ink-strong leading-tight">
                {t('pregd.daily_size_today_pre')}{today.size}{t('pregd.daily_size_today_post')}
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 font-semibold text-mint-700 border border-mint-200">
                  <BabyIcon className="h-3 w-3" /> {today.length_cm.toFixed(1)} cm
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 font-semibold text-coral-700 border border-coral-200">
                  ≈ {today.weight_g >= 1000
                    ? `${(today.weight_g / 1000).toFixed(2)} kg`
                    : `${today.weight_g} g`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-ink-muted border border-slate-200">
                  {ga ? `${ga.weeks}w ${ga.days}d` : ''}
                </span>
              </div>
              {efw != null && (
                <div className="mt-3 rounded-xl bg-white/80 border border-slate-200 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
                        {t('pregd.daily_size_us_label', { date: latestUltrasound?.scanned_at ? fmtDate(latestUltrasound.scanned_at) : '' })}
                      </div>
                      <div className="font-bold text-ink-strong text-sm">
                        {efw >= 1000 ? `${(efw / 1000).toFixed(2)} kg` : `${Math.round(efw)} g`}
                      </div>
                    </div>
                    {efwPct != null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        efwPct >= 90 && efwPct <= 110 ? 'bg-mint-100 text-mint-700'
                        : efwPct < 90                  ? 'bg-peach-100 text-peach-700'
                        :                                'bg-coral-100 text-coral-700'
                      }`}>
                        {t('pregd.daily_size_pct_of_avg', { n: efwPct })}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {show('kpi_ga') && <Kpi label={t('pregd.kpi_ga')} value={fmtGestationalAge(edd, lmp)}
          tint="lavender" icon={HeartPulse} sub={tri ? t('pregd.chip_trimester', { n: tri }) : undefined} />}
        {show('kpi_bp') && <Kpi label={t('pregd.kpi_bp')}
          value={summary.latest_bp_systolic ? `${summary.latest_bp_systolic}/${summary.latest_bp_diastolic}` : '—'}
          tint={bpCat === 'hypertensive' ? 'coral' : bpCat === 'elevated' ? 'peach' : 'mint'}
          icon={Activity}
          sub={bpCat ? prettyBp(bpCat, t) : t('pregd.kpi_bp_no_reading')} />}
        {show('kpi_weight') && <Kpi label={t('pregd.kpi_weight')}
          value={summary.latest_weight_kg ? fmtKg(summary.latest_weight_kg) : '—'}
          tint="brand" icon={Heart}
          sub={summary.weight_gain_kg != null ? t('pregd.kpi_weight_gained', { n: summary.weight_gain_kg.toFixed(1) }) : t('pregd.kpi_weight_track')} />}
        {show('kpi_fhr') && <Kpi label={t('pregd.kpi_fhr')}
          value={summary.latest_fhr ? `${summary.latest_fhr} bpm` : '—'}
          tint="coral" icon={HeartPulse}
          sub={t('pregd.kpi_fhr_sub')} />}
      </div>

      {/* Wave 5 — "Ideas for today" — three trimester-aware wellness tips
          (hydration, kegels, hospital prep, kick counts, etc.). Filtered
          by gestational week. */}
      {ga && (
        <SuggestionsCard
          babyId={babyId}
          stage="pregnancy"
          marker={ga.weeks}
          lang={lang}
        />
      )}

      {/* Insight cards: week-by-week + IOM weight gain band */}
      {((insight && show('week_insight')) || (gain.band && show('iom_band'))) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {insight && show('week_insight') && (
            <div className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-lavender-100 text-lavender-700">
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">
                  {t('pregd.week_label', { week: insight.week, tri: insight.trimester })}
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold text-ink-strong inline-flex items-center gap-1.5">
                <Apple className="h-4 w-4 text-coral-600" />
                {t('pregd.week_size_pre')}{insight.size}{t('pregd.week_size_post')}
              </div>
              <p className="mt-2 text-sm text-ink leading-relaxed">{insight.highlight}</p>
              {insight.parent_tip && (
                <p className="mt-2 text-xs text-mint-700 bg-mint-50/70 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> {insight.parent_tip}
                </p>
              )}
            </div>
          )}

          {gain.band && show('iom_band') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-mint-100 text-mint-700">
                  <Heart className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-mint-700">
                  {t('pregd.gain_eyebrow', { category: prettyCategory(gain.band.category, t) })}
                </div>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">
                  {t('pregd.gain_iom_total', { min: gain.band.min_kg, max: gain.band.max_kg })}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold tabular-nums text-ink-strong">
                  {summary.weight_gain_kg != null ? `+${summary.weight_gain_kg.toFixed(1)} kg` : '—'}
                </div>
                {gain.expected_min != null && gain.expected_max != null && (
                  <div className="mt-1 text-xs text-ink-muted">
                    {t('pregd.gain_expected_by', { wk: ga?.weeks ?? '—', min: gain.expected_min.toFixed(1), max: gain.expected_max.toFixed(1) })}
                  </div>
                )}
                <div className="mt-3">
                  <GainBar
                    current={summary.weight_gain_kg ?? 0}
                    min={gain.band.min_kg}
                    max={gain.band.max_kg}
                    expectedMin={gain.expected_min}
                    expectedMax={gain.expected_max}
                  />
                </div>
                <div className={`mt-2 text-xs font-semibold ${
                  gain.status === 'high' ? 'text-coral-700' :
                  gain.status === 'low'  ? 'text-peach-700' :
                  gain.status === 'on_track' ? 'text-mint-700' : 'text-ink-muted'
                }`}>
                  {gain.status === 'on_track' && t('pregd.gain_on_track')}
                  {gain.status === 'low'      && t('pregd.gain_low')}
                  {gain.status === 'high'     && t('pregd.gain_high')}
                  {gain.status === 'unknown'  && (summary.weight_gain_kg == null
                    ? t('pregd.gain_unknown_log')
                    : t('pregd.gain_unknown_need_pre'))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* What-to-expect: monthly + trimester rollups */}
      {((monthExp && show('month_expect')) || (triExp && show('tri_overview'))) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {monthExp && show('month_expect') && (
            <div className="rounded-2xl border border-peach-200 bg-gradient-to-br from-peach-50 via-white to-coral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-peach-100 text-peach-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-peach-700">
                  {t('pregd.month_eyebrow', { n: monthExp.month, w1: monthExp.weeks[0], w2: monthExp.weeks[1] })}
                </div>
              </div>
              <ExpectGroups t={t}
                mom={monthExp.mom} baby={monthExp.baby} todos={monthExp.todos} />
            </div>
          )}

          {triExp && show('tri_overview') && (
            <div className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-brand-50 p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-lavender-100 text-lavender-700">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">
                  {t('pregd.tri_eyebrow', { n: triExp.trimester, w1: triExp.weeks[0], w2: triExp.weeks[1] })}
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-strong font-medium">{triExp.headline}</p>
              <ExpectGroups t={t}
                mom={triExp.mom} baby={triExp.baby} todos={triExp.todos} />
            </div>
          )}
        </div>
      )}

      {/* Recent maternal symptoms strip */}
      {show('recent_symptoms') && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-lg grid place-items-center bg-lavender-100 text-lavender-700">
                <HeartPulse className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-bold text-ink-strong">{t('pregd.recent_symptoms')}</h3>
              {recentSymptoms.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-lavender-700 bg-lavender-50 px-1.5 py-0.5 rounded-full">
                  {t('pregd.last_7d', { n: recentSymptoms.length })}
                </span>
              )}
            </div>
            <Link href={`/babies/${babyId}/prenatal/symptoms`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-lavender-700 hover:text-lavender-800">
              {t('pregd.view_all')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {recentSymptoms.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-ink-muted">{t('pregd.no_symptoms')}</p>
              {canEdit && (
                <Link href={`/babies/${babyId}/prenatal/symptoms/new`}
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-xs font-semibold px-3 py-1.5">
                  <Plus className="h-3.5 w-3.5" /> {t('symptoms.add')}
                </Link>
              )}
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentSymptoms.slice(0, 6).map(s => (
                <li key={s.id}>
                  <Link href={`/babies/${babyId}/prenatal/symptoms?id=${s.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 px-3 py-2 transition">
                    <span className="text-2xl leading-none shrink-0">{SYMPTOM_EMOJI[s.kind] ?? '✏️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-strong truncate capitalize">
                        {t(`forms.symp_${s.kind}`) || s.kind.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-ink-muted">{fmtRelative(s.logged_at)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.severity >= 4 ? 'bg-coral-100 text-coral-700'
                      : s.severity === 3 ? 'bg-peach-100 text-peach-700'
                      : 'bg-mint-100 text-mint-700'
                    }`}>{s.severity}/5</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Kick + counts row */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {show('kicks_card') && <Link href={`/babies/${babyId}/prenatal/kicks`}
          className={`rounded-2xl border p-5 hover:shadow-card transition ${kicksLow ? 'bg-coral-50 border-coral-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Activity className="h-3.5 w-3.5" /> {t('pregd.kicks_today')}
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.kicks_today ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">
            {kicksLow ? t('pregd.kicks_low') : t('pregd.kicks_tap')}
          </div>
        </Link>}
        {show('visits_count') && <Link href={`/babies/${babyId}/prenatal/visits`}
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-card transition">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Stethoscope className="h-3.5 w-3.5" /> {t('pregd.visits')}
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.prenatal_visit_count ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">{t('pregd.visits_tap')}</div>
        </Link>}
        {show('ultrasounds_count') && <Link href={`/babies/${babyId}/prenatal/ultrasounds`}
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-card transition">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <ScanLine className="h-3.5 w-3.5" /> {t('pregd.ultrasounds')}
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.ultrasound_count ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">{t('pregd.ultrasounds_tap')}</div>
        </Link>}
      </div>

      {/* Latest ultrasound + next appointment */}
      {(show('latest_ultrasound') || show('next_appointment')) && <div className="grid gap-3 lg:grid-cols-2">
        {show('latest_ultrasound') && <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-ink-strong">{t('pregd.latest_us')}</h3>
          </div>
          {latestUltrasound ? (
            <div>
              <div className="text-xs text-ink-muted">{fmtDate(latestUltrasound.scanned_at)}{latestUltrasound.gestational_week != null ? ` · ${latestUltrasound.gestational_week}w` : ''}</div>
              <p className="text-sm text-ink-strong mt-1">{latestUltrasound.summary ?? t('pregd.latest_us_no_summary')}</p>
              <Link href={`/babies/${babyId}/prenatal/ultrasounds/${latestUltrasound.id}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                {t('pregd.open_scan')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <EmptyHint icon={ScanLine} text={t('pregd.no_us')}
              ctaHref={`/babies/${babyId}/prenatal/ultrasounds/new`} ctaLabel={t('pregd.add_us')} />
          )}
        </div>}

        {show('next_appointment') && <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-lavender-600" />
            <h3 className="text-sm font-bold text-ink-strong">{t('pregd.next_appt')}</h3>
          </div>
          {nextAppointment ? (
            <div>
              <div className="text-sm font-semibold text-ink-strong">{fmtDate(nextAppointment.scheduled_at)}</div>
              <div className="text-xs text-ink-muted">{nextAppointment.doctor_name ?? t('pregd.next_appt_provider')}{nextAppointment.purpose ? ` · ${nextAppointment.purpose}` : ''}</div>
            </div>
          ) : (
            <EmptyHint icon={CalendarClock} text={t('pregd.no_appt')}
              ctaHref={`/babies/${babyId}/doctors`} ctaLabel={t('pregd.book_appt')} />
          )}
        </div>}
      </div>}

      {/* Quick actions */}
      {show('quick_actions') && <div className="flex flex-wrap gap-2">
        <QuickLink href={`/babies/${babyId}/prenatal/visits/new`}     icon={Stethoscope} label={t('pregd.qa_visit')}   tint="lavender" />
        <QuickLink href={`/babies/${babyId}/prenatal/ultrasounds/new`} icon={ScanLine}   label={t('pregd.qa_us')}      tint="brand" />
        <QuickLink href={`/babies/${babyId}/prenatal/kicks`}           icon={Activity}   label={t('pregd.qa_kicks')}   tint="coral" />
        <QuickLink href={`/babies/${babyId}/prenatal/maternal-vitals`} icon={Heart}      label={t('pregd.qa_vitals')}  tint="peach" />
        <QuickLink href={`/babies/${babyId}/prenatal/symptoms/new`}    icon={HeartPulse} label={t('pregd.qa_symptoms')} tint="lavender" />
        <QuickLink href={`/babies/${babyId}/medications`}              icon={Pill}       label={t('pregd.qa_meds')}    tint="mint" />
        <QuickLink href={`/babies/${babyId}/medical-profile`}          icon={Sparkles}   label={t('pregd.qa_profile')} tint="lavender" />
      </div>}
    </div>
  );
}

function prettyBp(cat: 'normal'|'elevated'|'hypertensive', t: ReturnType<typeof tFor>): string {
  switch (cat) {
    case 'normal':       return t('pregd.kpi_bp_normal');
    case 'elevated':     return t('pregd.kpi_bp_elevated');
    case 'hypertensive': return t('pregd.kpi_bp_hyper');
  }
}

function prettyCategory(c: 'underweight'|'normal'|'overweight'|'obese', t: ReturnType<typeof tFor>): string {
  switch (c) {
    case 'underweight': return t('pregd.bmi_under');
    case 'normal':      return t('pregd.bmi_normal');
    case 'overweight':  return t('pregd.bmi_over');
    case 'obese':       return t('pregd.bmi_obese');
  }
}

/** Horizontal weight-gain bar with IOM band overlay. */
function GainBar({ current, min, max, expectedMin, expectedMax }: {
  current: number; min: number; max: number;
  expectedMin: number | null; expectedMax: number | null;
}) {
  const scaleMax = Math.max(max + 5, current + 2, 2);
  const pct = (v: number) => Math.max(0, Math.min(100, (v / scaleMax) * 100));
  return (
    <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
      {/* IOM total band */}
      <div className="absolute inset-y-0 bg-mint-200/80"
        style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }} />
      {/* Expected for current week — narrower band on top */}
      {expectedMin != null && expectedMax != null && (
        <div className="absolute inset-y-0 bg-mint-400"
          style={{ left: `${pct(expectedMin)}%`, width: `${Math.max(1, pct(expectedMax) - pct(expectedMin))}%` }} />
      )}
      {/* Current gain marker */}
      <div className="absolute -top-0.5 h-4 w-1 rounded-full bg-coral-600 shadow-sm"
        style={{ left: `calc(${pct(Math.max(0, current))}% - 2px)` }} />
    </div>
  );
}

function Chip({ tint, children }: { tint: 'coral'|'mint'|'brand'|'peach'|'lavender'; children: React.ReactNode }) {
  const map = {
    coral:    'bg-white/80 text-coral-700',
    mint:     'bg-white/80 text-mint-700',
    brand:    'bg-white/80 text-brand-700',
    peach:    'bg-white/80 text-peach-700',
    lavender: 'bg-white/80 text-lavender-700',
  }[tint];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium shadow-sm ${map}`}>{children}</span>;
}

function Kpi({ label, value, sub, icon: Icon, tint }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'mint'|'brand'|'peach'|'lavender';
}) {
  const tintCss = {
    coral: 'bg-coral-100 text-coral-600', mint: 'bg-mint-100 text-mint-600',
    brand: 'bg-brand-100 text-brand-600', peach: 'bg-peach-100 text-peach-600',
    lavender: 'bg-lavender-100 text-lavender-600',
  }[tint];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
        <span className={`h-6 w-6 rounded-lg grid place-items-center ${tintCss}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-ink-strong">{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function EmptyHint({ icon: Icon, text, ctaHref, ctaLabel }: {
  icon: React.ComponentType<{ className?: string }>;
  text: string; ctaHref: string; ctaLabel: string;
}) {
  return (
    <div className="text-center py-3">
      <Icon className="h-7 w-7 mx-auto text-ink-muted/60" />
      <p className="text-sm text-ink-muted mt-2">{text}</p>
      <Link href={ctaHref}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold px-3 py-1.5">
        <Plus className="h-3.5 w-3.5" /> {ctaLabel}
      </Link>
    </div>
  );
}

function ExpectGroups({
  t, mom, baby, todos,
}: {
  t: ReturnType<typeof tFor>;
  mom: string[]; baby: string[]; todos: string[];
}) {
  return (
    <div className="mt-3 space-y-3 text-sm">
      {mom.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-coral-700">{t('pregd.expect_mom')}</div>
          <ul className="mt-1 space-y-1">
            {mom.map((m, i) => (
              <li key={i} className="flex gap-2 text-ink"><span className="text-coral-500 select-none">•</span>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {baby.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-700">{t('pregd.expect_baby')}</div>
          <ul className="mt-1 space-y-1">
            {baby.map((m, i) => (
              <li key={i} className="flex gap-2 text-ink"><span className="text-brand-500 select-none">•</span>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {todos.length > 0 && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-mint-700">{t('pregd.expect_todos')}</div>
          <ul className="mt-1 space-y-1">
            {todos.map((m, i) => (
              <li key={i} className="flex gap-2 text-ink"><span className="text-mint-500 select-none">•</span>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuickLink({ href, icon: Icon, label, tint }: {
  href: string; icon: React.ComponentType<{ className?: string }>; label: string;
  tint: 'coral'|'brand'|'lavender'|'mint'|'peach';
}) {
  const tintCss = {
    coral:    'bg-coral-100 text-coral-700 hover:bg-coral-200',
    brand:    'bg-brand-100 text-brand-700 hover:bg-brand-200',
    lavender: 'bg-lavender-100 text-lavender-700 hover:bg-lavender-200',
    mint:     'bg-mint-100 text-mint-700 hover:bg-mint-200',
    peach:    'bg-peach-100 text-peach-700 hover:bg-peach-200',
  }[tint];
  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${tintCss}`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

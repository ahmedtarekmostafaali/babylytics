import Link from 'next/link';
import { BabyAvatar } from '@/components/BabyAvatar';
import { MarkAsBornDialog } from '@/components/MarkAsBornDialog';
import {
  Stethoscope, ScanLine, Activity, HeartPulse, CalendarClock, Plus,
  Sparkles, ArrowRight, Pill, Heart, Apple, BookOpen,
} from 'lucide-react';
import {
  fmtGestationalAge, eddDistanceDays, gestationalAge, trimester, bpCategory,
} from '@/lib/lifecycle';
import { weekInsight, gainStatus } from '@/lib/pregnancy_weeks';
import { fmtDate } from '@/lib/dates';
import { fmtKg } from '@/lib/units';

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
  prePregnancyWeightKg, prePregnancyHeightCm,
}: {
  babyId: string;
  babyName: string;
  avatarUrl: string | null;
  edd: string | null;
  lmp: string | null;
  summary: Summary;
  latestUltrasound: { id: string; scanned_at: string; gestational_week: number | null; summary: string | null } | null;
  nextAppointment: { scheduled_at: string; doctor_name: string | null; purpose: string | null } | null;
  canEdit: boolean;
  prePregnancyWeightKg: number | null;
  prePregnancyHeightCm: number | null;
}) {
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[32px] border border-lavender-200/70 bg-gradient-to-br from-lavender-50 via-coral-50 to-peach-50 shadow-card p-6">
        <div className="flex items-center gap-5 flex-wrap">
          <BabyAvatar url={avatarUrl} size="2xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-lavender-700">Expecting</div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-strong mt-1">{babyName}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {ga && <Chip tint="lavender">{ga.weeks}w {ga.days}d</Chip>}
              {tri && <Chip tint="brand">Trimester {tri}</Chip>}
              {edd && <Chip tint="coral">EDD {fmtDate(edd)}</Chip>}
              {distance != null && (
                <Chip tint={distance < 0 ? 'peach' : 'mint'}>
                  {distance < 0 ? `${Math.abs(distance)} days past EDD` : `${distance} days to EDD`}
                </Chip>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="ml-auto">
              <MarkAsBornDialog babyId={babyId} babyName={babyName} />
            </div>
          )}
        </div>

        {lateStage && (
          <div className="mt-4 rounded-xl bg-white/70 border border-coral-200 px-4 py-2 text-sm text-coral-800 inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> You&apos;re close to term. Tap <strong>Mark as born</strong> the moment baby arrives — every prenatal record stays attached.
          </div>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gestational age" value={fmtGestationalAge(edd, lmp)}
          tint="lavender" icon={HeartPulse} sub={tri ? `Trimester ${tri}` : undefined} />
        <Kpi label="Latest BP"
          value={summary.latest_bp_systolic ? `${summary.latest_bp_systolic}/${summary.latest_bp_diastolic}` : '—'}
          tint={bpCat === 'hypertensive' ? 'coral' : bpCat === 'elevated' ? 'peach' : 'mint'}
          icon={Activity}
          sub={bpCat ? prettyBp(bpCat) : 'No reading yet'} />
        <Kpi label="Maternal weight"
          value={summary.latest_weight_kg ? fmtKg(summary.latest_weight_kg) : '—'}
          tint="brand" icon={Heart}
          sub={summary.weight_gain_kg != null ? `+${summary.weight_gain_kg.toFixed(1)} kg gained` : 'Track at next visit'} />
        <Kpi label="Fetal HR"
          value={summary.latest_fhr ? `${summary.latest_fhr} bpm` : '—'}
          tint="coral" icon={HeartPulse}
          sub="From last visit / scan" />
      </div>

      {/* Insight cards: week-by-week + IOM weight gain band */}
      {(insight || gain.band) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {insight && (
            <div className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-lavender-100 text-lavender-700">
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">
                  Week {insight.week} · Trimester {insight.trimester}
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold text-ink-strong inline-flex items-center gap-1.5">
                <Apple className="h-4 w-4 text-coral-600" />
                Baby is the size of {insight.size}.
              </div>
              <p className="mt-2 text-sm text-ink leading-relaxed">{insight.highlight}</p>
              {insight.parent_tip && (
                <p className="mt-2 text-xs text-mint-700 bg-mint-50/70 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> {insight.parent_tip}
                </p>
              )}
            </div>
          )}

          {gain.band && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg grid place-items-center bg-mint-100 text-mint-700">
                  <Heart className="h-3.5 w-3.5" />
                </span>
                <div className="text-[11px] font-bold uppercase tracking-wider text-mint-700">
                  Weight gain · {prettyCategory(gain.band.category)}
                </div>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">
                  IOM {gain.band.min_kg}–{gain.band.max_kg} kg total
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold tabular-nums text-ink-strong">
                  {summary.weight_gain_kg != null ? `+${summary.weight_gain_kg.toFixed(1)} kg` : '—'}
                </div>
                {gain.expected_min != null && gain.expected_max != null && (
                  <div className="mt-1 text-xs text-ink-muted">
                    Expected by week {ga?.weeks ?? '—'}: {gain.expected_min.toFixed(1)}–{gain.expected_max.toFixed(1)} kg
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
                  {gain.status === 'on_track' && '✓ On track for your IOM band'}
                  {gain.status === 'low'      && '↓ A little below — chat with your provider if it persists'}
                  {gain.status === 'high'     && '↑ Above expected — your provider may want to discuss'}
                  {gain.status === 'unknown'  && (summary.weight_gain_kg == null
                    ? 'Log a prenatal visit with weight to see status'
                    : 'Need pre-pregnancy weight & height for guidance')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kick + counts row */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Link href={`/babies/${babyId}/prenatal/kicks`}
          className={`rounded-2xl border p-5 hover:shadow-card transition ${kicksLow ? 'bg-coral-50 border-coral-200' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Activity className="h-3.5 w-3.5" /> Kick count today
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.kicks_today ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">
            {kicksLow ? '⚠ Below 10 — keep counting' : 'Tap to start a session →'}
          </div>
        </Link>
        <Link href={`/babies/${babyId}/prenatal/visits`}
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-card transition">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Stethoscope className="h-3.5 w-3.5" /> Prenatal visits
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.prenatal_visit_count ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">Tap to log a new visit →</div>
        </Link>
        <Link href={`/babies/${babyId}/prenatal/ultrasounds`}
          className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-card transition">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <ScanLine className="h-3.5 w-3.5" /> Ultrasounds
          </div>
          <div className="mt-1 text-3xl font-bold text-ink-strong">{summary.ultrasound_count ?? 0}</div>
          <div className="text-xs text-ink-muted mt-1">Tap to add a scan →</div>
        </Link>
      </div>

      {/* Latest ultrasound + next appointment */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine className="h-4 w-4 text-brand-600" />
            <h3 className="text-sm font-bold text-ink-strong">Latest ultrasound</h3>
          </div>
          {latestUltrasound ? (
            <div>
              <div className="text-xs text-ink-muted">{fmtDate(latestUltrasound.scanned_at)}{latestUltrasound.gestational_week != null ? ` · ${latestUltrasound.gestational_week}w` : ''}</div>
              <p className="text-sm text-ink-strong mt-1">{latestUltrasound.summary ?? 'No radiologist summary recorded.'}</p>
              <Link href={`/babies/${babyId}/prenatal/ultrasounds/${latestUltrasound.id}`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
                Open scan <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <EmptyHint icon={ScanLine} text="No ultrasounds logged yet."
              ctaHref={`/babies/${babyId}/prenatal/ultrasounds/new`} ctaLabel="Add ultrasound" />
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="h-4 w-4 text-lavender-600" />
            <h3 className="text-sm font-bold text-ink-strong">Next appointment</h3>
          </div>
          {nextAppointment ? (
            <div>
              <div className="text-sm font-semibold text-ink-strong">{fmtDate(nextAppointment.scheduled_at)}</div>
              <div className="text-xs text-ink-muted">{nextAppointment.doctor_name ?? 'Provider'}{nextAppointment.purpose ? ` · ${nextAppointment.purpose}` : ''}</div>
            </div>
          ) : (
            <EmptyHint icon={CalendarClock} text="No upcoming appointment booked."
              ctaHref={`/babies/${babyId}/doctors`} ctaLabel="Book one" />
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <QuickLink href={`/babies/${babyId}/prenatal/visits/new`}     icon={Stethoscope} label="Log prenatal visit" tint="lavender" />
        <QuickLink href={`/babies/${babyId}/prenatal/ultrasounds/new`} icon={ScanLine}   label="Log ultrasound"     tint="brand" />
        <QuickLink href={`/babies/${babyId}/prenatal/kicks`}           icon={Activity}   label="Kick counter"        tint="coral" />
        <QuickLink href={`/babies/${babyId}/prenatal/maternal-vitals`} icon={Heart}      label="Maternal vitals"      tint="peach" />
        <QuickLink href={`/babies/${babyId}/medications`}              icon={Pill}       label="Pregnancy meds"       tint="mint" />
        <QuickLink href={`/babies/${babyId}/medical-profile`}          icon={Sparkles}   label="Medical profile"      tint="lavender" />
      </div>
    </div>
  );
}

function prettyBp(cat: 'normal'|'elevated'|'hypertensive'): string {
  switch (cat) {
    case 'normal':       return 'Normal';
    case 'elevated':     return 'Elevated';
    case 'hypertensive': return '⚠ Hypertensive';
  }
}

function prettyCategory(c: 'underweight'|'normal'|'overweight'|'obese'): string {
  switch (c) {
    case 'underweight': return 'Pre-preg BMI: under';
    case 'normal':      return 'Pre-preg BMI: normal';
    case 'overweight':  return 'Pre-preg BMI: over';
    case 'obese':       return 'Pre-preg BMI: high';
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

// CycleDashboard — server-rendered overview for planning-stage profiles.
// Sits at /babies/[id] (the Overview entry in the sidebar) and holds the
// cycle mode picker, baseline, red flags, energy forecast, Ramadan card,
// daily ideas, and consultation upsell. The cycle CALENDAR lives on its
// own page at /babies/[id]/planner — kept separate so Overview ≠ Calendar.
//
// Loads its own data; called once per render from the baby overview page.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Plus, Download, Calendar, Heart, Sparkles } from 'lucide-react';
import { fmtDate } from '@/lib/dates';
import type { Lang } from '@/lib/i18n';
import { tFor } from '@/lib/i18n';
import { CycleModeCard, type CycleMode } from '@/components/CycleModeCard';
import { CycleRedFlagsCard, type CycleRedFlag } from '@/components/CycleRedFlagsCard';
import { CycleEnergyForecast } from '@/components/CycleEnergyForecast';
import { CycleBaselineCard, type CycleBaseline } from '@/components/CycleBaselineCard';
import { type DoctorQuestion } from '@/components/SendToDoctorButton';
import { RamadanCard } from '@/components/RamadanCard';
import { dayOfRamadan } from '@/lib/ramadan';
import { SuggestionsCard } from '@/components/SuggestionsCard';
import { cyclePhaseFor } from '@/lib/suggestions';
import { ConsultationComingSoon } from '@/components/ConsultationComingSoon';
import { MarkAsPregnantDialog } from '@/components/MarkAsPregnantDialog';

export async function CycleDashboard({
  babyId, babyName, lang,
}: {
  babyId: string;
  babyName: string;
  lang: Lang;
}) {
  const supabase = createClient();
  const t = tFor(lang);

  // Fetch the data the cycle overview needs. Calendar data lives on the
  // planner page; we only need the most-recent few cycles here for phase
  // detection + a "Last period" summary tile.
  const [
    { data: baby },
    { data: cycles },
    { data: redFlagsRaw },
    { data: baselineRaw },
    { data: questionsRaw },
  ] = await Promise.all([
    supabase.from('babies').select('cycle_mode').eq('id', babyId).single(),
    supabase.from('menstrual_cycles')
      .select('id,period_start,period_end,cycle_length,flow_intensity')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('period_start', { ascending: false })
      .limit(3),
    supabase.rpc('cycle_red_flags',         { p_baby: babyId }),
    supabase.rpc('cycle_personal_baseline', { p_baby: babyId }).maybeSingle(),
    supabase.rpc('cycle_doctor_questions',  { p_baby: babyId }),
  ]);
  const cycleMode      = (baby as { cycle_mode?: CycleMode | null } | null)?.cycle_mode ?? null;
  const redFlags       = (redFlagsRaw  ?? []) as CycleRedFlag[];
  const baseline       = (baselineRaw as CycleBaseline | null) ?? null;
  const doctorQuestions = (questionsRaw ?? []) as DoctorQuestion[];

  // Phase / day-in-cycle from the most recent period_start.
  const last = cycles?.[0];
  let cycleMarker: number | null = null;
  let cyclePhase: ReturnType<typeof cyclePhaseFor> | undefined;
  let nextPeriod:    string | null = null;
  let nextOvulation: string | null = null;
  if (last) {
    const len = last.cycle_length ?? 28;
    const start = new Date(last.period_start + 'T00:00:00Z');
    const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
    cycleMarker = days;
    cyclePhase = cyclePhaseFor(days, len);
    nextPeriod    = new Date(start.getTime() + len * 86400000).toISOString().slice(0, 10);
    nextOvulation = new Date(start.getTime() + (len - 14) * 86400000).toISOString().slice(0, 10);
  }
  const ramadanDay = dayOfRamadan();

  return (
    <PageShell max="5xl">
      <PageHeader
        backHref="/dashboard"
        backLabel={t('nav.my_babies')}
        eyebrow={t('nav.overview').toUpperCase()} eyebrowTint="coral"
        title={babyName}
        subtitle="My cycle — overview, predictions, and ideas for today."
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link href={`/babies/${babyId}/planner`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-sm font-semibold px-4 py-2 shadow-sm">
              <Calendar className="h-4 w-4" /> Open calendar
            </Link>
            <Link href={`/babies/${babyId}/planner/cycles/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-coral-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
              <Plus className="h-4 w-4" /> Log period
            </Link>
            <Link href={`/babies/${babyId}/import/apple-health`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-sm font-semibold px-4 py-2 shadow-sm">
              <Download className="h-4 w-4" /> Apple Health
            </Link>
            <MarkAsPregnantDialog babyId={babyId} />
          </div>
        }
      />

      {/* Top insight strip — same three-tile summary that used to live on
          the planner page. Moved here so the Overview answers "where am I
          in my cycle" at a glance. */}
      <section className="grid sm:grid-cols-3 gap-3">
        <Tile icon={Calendar} tint="coral"    label="Last period"
          value={last ? fmtDate(last.period_start) : '—'}
          sub={last?.cycle_length ? `${last.cycle_length}-day cycle` : 'log to start'} />
        <Tile icon={Heart} tint="mint"        label="Next ovulation"
          value={nextOvulation ? fmtDate(nextOvulation) : '—'}
          sub={nextOvulation ? 'Peak fertility window opens 5 days before' : 'needs 1 cycle log'} />
        <Tile icon={Sparkles} tint="lavender" label="Next period due"
          value={nextPeriod ? fmtDate(nextPeriod) : '—'}
          sub={nextPeriod ? 'projected from your cycle length' : ''} />
      </section>

      {ramadanDay != null && <RamadanCard dayOfRamadan={ramadanDay} lang={lang} />}

      <CycleModeCard babyId={babyId} initialMode={cycleMode} />
      <CycleBaselineCard baseline={baseline} babyId={babyId} />
      <CycleRedFlagsCard flags={redFlags} babyId={babyId} questions={doctorQuestions} />
      <CycleEnergyForecast phase={cyclePhase ?? null} daysSincePeriodStart={cycleMarker} />

      <SuggestionsCard
        babyId={babyId}
        stage="cycle"
        marker={cycleMarker}
        phase={cyclePhase}
        mode={cycleMode}
        context={ramadanDay != null ? 'ramadan' : undefined}
        lang={lang}
      />

      <ConsultationComingSoon stage="cycle" />
    </PageShell>
  );
}

function Tile({
  icon: Icon, tint, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'mint' | 'lavender';
  label: string; value: string; sub?: string;
}) {
  const cls = {
    coral:    'bg-coral-100 text-coral-600',
    mint:     'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600',
  }[tint];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
      <div className="flex items-center gap-2">
        <span className={`h-8 w-8 rounded-lg grid place-items-center ${cls}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{label}</div>
      </div>
      <div className="mt-2 text-lg font-bold text-ink-strong">{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}

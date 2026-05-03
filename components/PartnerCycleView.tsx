// PartnerCycleView — what a partner caregiver sees on the cycle profile
// overview. Curated, empathetic, never showing raw symptom logs or
// medical detail. Surfaces the phase + energy forecast + "what helps
// this week" + a soft countdown to next period.
//
// Server component. Loads its own data; called from the baby overview
// page when the current user has role='partner' on a planning profile.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Heart, MessageCircle, Sparkles, Calendar, ArrowRight } from 'lucide-react';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { cyclePhaseFor, pickToday, type CyclePhase, type CycleMode } from '@/lib/suggestions';
import { forecastFor, CycleEnergyForecast } from '@/components/CycleEnergyForecast';
import { tFor, type Lang } from '@/lib/i18n';

export async function PartnerCycleView({
  babyId, babyName, lang,
}: {
  babyId: string;
  babyName: string;
  lang: Lang;
}) {
  const supabase = createClient();
  const t = tFor(lang);

  // Pull JUST what the curated view needs — no symptoms, no flags. The
  // partner role's RLS still permits everything, but we choose not to
  // expose detail in the UI by default.
  const [{ data: baby }, { data: cycles }] = await Promise.all([
    supabase.from('babies').select('cycle_mode').eq('id', babyId).single(),
    supabase.from('menstrual_cycles')
      .select('period_start,cycle_length')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('period_start', { ascending: false })
      .limit(1),
  ]);
  const cycleMode = (baby as { cycle_mode?: CycleMode | null } | null)?.cycle_mode ?? null;
  const last = cycles?.[0];

  // Phase + forecast + next-period from the most recent log.
  let phase: CyclePhase | null = null;
  let daysSince: number | null = null;
  let nextPeriod: string | null = null;
  let daysUntilPeriod: number | null = null;
  if (last) {
    const start = new Date(last.period_start + 'T00:00:00Z');
    const len = last.cycle_length ?? 28;
    daysSince = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
    phase = cyclePhaseFor(daysSince, len);
    const next = new Date(start.getTime() + len * 86400000);
    nextPeriod = next.toISOString().slice(0, 10);
    daysUntilPeriod = Math.max(0, Math.round((next.getTime() - Date.now()) / 86400000));
  }
  const fcast = forecastFor(phase, daysSince);

  // Pick one phase-appropriate suggestion for the "what helps this week"
  // card. We deliberately pick from the cycle stage with the same mode
  // so the tip is congruent — but we only show ONE so this stays a
  // partner summary, not a full Daily Ideas card.
  const tips = pickToday({ babyId, stage: 'cycle', marker: daysSince, phase: phase ?? undefined, mode: cycleMode }, 1);
  const tip = tips[0] ?? null;
  const tipTitle = tip ? (lang === 'ar' ? tip.title_ar : tip.title_en) : null;
  const tipBody  = tip ? (lang === 'ar' ? tip.body_ar  : tip.body_en)  : null;

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref="/dashboard"
        backLabel={t('nav.my_babies')}
        eyebrow="PARTNER VIEW" eyebrowTint="lavender"
        title={babyName}
        subtitle="A friendly summary — no detailed logs, just the context that helps you support."
      />

      {/* Hero phase card */}
      <section className="rounded-3xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-coral-50 to-peach-50 p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="h-12 w-12 rounded-2xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
            <Heart className="h-6 w-6" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">Right now</div>
            <h2 className="mt-0.5 text-2xl font-bold text-ink-strong leading-tight">
              {phase
                ? phase === 'menstrual'  ? "She's on her period"
                : phase === 'follicular' ? 'High-energy week'
                : phase === 'ovulatory'  ? 'Peak-energy days'
                : 'Wind-down week (luteal)'
                : 'No cycles logged yet'}
            </h2>
            {daysUntilPeriod != null && (
              <p className="mt-1 text-sm text-ink">
                Next period likely in <strong>{daysUntilPeriod} day{daysUntilPeriod === 1 ? '' : 's'}</strong>
                {nextPeriod && ` (around ${fmtDate(nextPeriod)})`}.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Forecast — same component the owner sees, partner-friendly framing */}
      <CycleEnergyForecast phase={phase} daysSincePeriodStart={daysSince} />

      {/* What helps — single curated tip */}
      {tip && tipTitle && tipBody && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-8 w-8 rounded-lg grid place-items-center bg-mint-100 text-mint-600">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-ink-strong">What helps this week</h3>
          </div>
          <div className="rounded-xl bg-mint-50/40 border border-mint-100 p-3">
            <div className="font-semibold text-ink-strong text-sm">{tipTitle}</div>
            <p className="text-xs text-ink-muted mt-1 leading-relaxed">{tipBody}</p>
          </div>
        </section>
      )}

      {/* Forecast hint as a quick takeaway */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-sm text-ink leading-relaxed">
        <strong className="text-ink-strong">Today&apos;s read:</strong> {fcast.hint}
      </section>

      {/* Chat CTA — partners get the same private chat as everyone else */}
      <Link href={`/babies/${babyId}/chat`}
        className="block rounded-2xl bg-gradient-to-br from-mint-500 to-mint-600 text-white shadow-card hover:shadow-panel transition p-5">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider opacity-80">Stay in sync</div>
            <div className="font-bold">Open private chat</div>
            <p className="text-xs opacity-90 mt-0.5">A direct thread between just the two of you.</p>
          </div>
          <ArrowRight className="h-5 w-5" />
        </div>
      </Link>

      <p className="text-[11px] text-ink-muted text-center px-4">
        Partner view by design — detailed symptom logs and medical detail aren&apos;t shown here.
        She can always grant you wider access from her caregivers page.
      </p>
    </PageShell>
  );
}

// CycleEnergyForecast — predicts today's energy / focus / social baseline
// from current cycle phase + day-in-cycle. Pure presentational; the phase
// is computed server-side in the planner page from menstrual_cycles data.
//
// Not a medical claim. The values come from well-established population
// patterns in cycle physiology research; they're a starting hypothesis
// for the user, not personalised AI yet (that's Wave 14 territory).

import type { CyclePhase } from '@/lib/suggestions';
import { Activity, Brain, Users, Sparkles } from 'lucide-react';

export interface EnergyForecast {
  energy:  1 | 2 | 3 | 4 | 5;
  focus:   1 | 2 | 3 | 4 | 5;
  social:  1 | 2 | 3 | 4 | 5;
  /** One-sentence summary of why today feels like it does. */
  hint:    string;
}

/** Map phase + days-in-phase to a forecast. cycleLength lets us refine
 *  the boundaries (a 32-day cycle has a longer follicular phase). */
export function forecastFor(
  phase: CyclePhase | null,
  daysSincePeriodStart: number | null,
): EnergyForecast {
  if (phase == null || daysSincePeriodStart == null) {
    // No data yet — return a neutral baseline so the card still renders
    // with helpful context after a single period log.
    return {
      energy: 3, focus: 3, social: 3,
      hint: 'Log a period to start seeing your daily energy forecast.',
    };
  }

  // Days INTO the phase, used to fade values within a phase (start of
  // luteal feels different from end of luteal).
  switch (phase) {
    case 'menstrual': {
      // Days 1–2 lowest; days 3–5 climbing as flow lightens.
      const dim = daysSincePeriodStart <= 2;
      return {
        energy: dim ? 1 : 2, focus: 2, social: 2,
        hint: dim
          ? 'Estrogen at its lowest. Body is doing visible work — go gentle.'
          : 'Energy returning. Light movement helps as flow lightens.',
      };
    }
    case 'follicular': {
      // Climbs through the phase; peak right before ovulation.
      const late = daysSincePeriodStart >= 10;
      return {
        energy: late ? 5 : 4, focus: 5, social: 4,
        hint: late
          ? 'Estrogen near peak. Best window for hard workouts + creative work.'
          : 'Estrogen rising fast. Energy and focus build day by day this week.',
      };
    }
    case 'ovulatory': {
      return {
        energy: 5, focus: 5, social: 5,
        hint: 'Peak estrogen + LH surge. Confidence, charisma and clarity all crest now.',
      };
    }
    case 'luteal': {
      // Early luteal still feels good (high progesterone, calm). Late
      // luteal = PMS = lower across the board.
      const early = daysSincePeriodStart <= 22;
      return early
        ? { energy: 4, focus: 4, social: 3,
            hint: 'Progesterone settles in. Calm, focused — good for finishing what you started.' }
        : { energy: 2, focus: 3, social: 2,
            hint: 'PMS week. Cut sodium and caffeine, prioritise sleep, postpone big decisions.' };
    }
  }
}

const TINTS = {
  bar:  ['bg-coral-200', 'bg-coral-300', 'bg-mint-300', 'bg-mint-400', 'bg-mint-500'] as const,
  dot:  ['text-coral-500', 'text-coral-400', 'text-peach-500', 'text-mint-500', 'text-mint-600'] as const,
};

const LABEL: Record<1|2|3|4|5, string> = {
  1: 'low',
  2: 'low–mid',
  3: 'baseline',
  4: 'high',
  5: 'peak',
};

export function CycleEnergyForecast({
  phase, daysSincePeriodStart,
}: {
  phase: CyclePhase | null;
  daysSincePeriodStart: number | null;
}) {
  const f = forecastFor(phase, daysSincePeriodStart);

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-mint-50 to-coral-50 flex items-center gap-2">
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-mint-100 text-mint-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-strong leading-tight">Today&apos;s forecast</h3>
          <p className="text-[11px] text-ink-muted leading-tight">
            Population baseline for your phase — tweak based on how you actually feel.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 p-5">
        <Bar label="Energy"        icon={Activity} value={f.energy} />
        <Bar label="Focus"         icon={Brain}    value={f.focus} />
        <Bar label="Sociability"   icon={Users}    value={f.social} />
      </div>

      <div className="px-5 pb-4 pt-1 border-t border-slate-100 bg-slate-50/40">
        <p className="text-xs text-ink leading-relaxed">{f.hint}</p>
      </div>
    </section>
  );
}

function Bar({
  label, icon: Icon, value,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: 1 | 2 | 3 | 4 | 5;
}) {
  // 5-segment bar — fill segments up to value with the tint that matches
  // the score, leave the rest grey.
  const fillCls = TINTS.bar[value - 1];
  const iconCls = TINTS.dot[value - 1];
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider text-ink-muted">
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} /> {label}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i}
            className={`h-2 rounded-full ${i <= value ? fillCls : 'bg-slate-100'}`} />
        ))}
      </div>
      <div className="mt-1.5 text-xs font-semibold text-ink-strong">{LABEL[value]}</div>
    </div>
  );
}

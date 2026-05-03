'use client';

// "Ideas for today" card — surfaces 3 deterministic age/stage/phase-aware
// suggestions on a profile's overview. Picks rotate at midnight.
//
// Marked-done state lives in localStorage so it persists for today across
// page navigation, but resets the next day automatically (the key includes
// the date). v1 has no DB writes — we'll promote to a real table when /
// if cross-device tracking is needed.

import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Heart, Baby, Droplet, Milk, Apple, Moon, Activity, BookOpen,
  Music, Sun, Leaf, Smile, Flame, Pill, Utensils, Wind, Check, RefreshCw,
} from 'lucide-react';
import { pickToday, doneKey, type Suggestion, type CyclePhase, type SuggestionStage, type CycleMode } from '@/lib/suggestions';

const ICON: Record<Suggestion['icon'], React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles, heart: Heart, baby: Baby, droplet: Droplet, milk: Milk,
  apple: Apple, moon: Moon, activity: Activity, book: BookOpen, music: Music,
  sun: Sun, leaf: Leaf, smile: Smile, flame: Flame, pill: Pill,
  utensils: Utensils, wind: Wind, stretch: Activity,
};

const TINT: Record<Suggestion['tint'], { bg: string; iconBg: string; iconFg: string; border: string }> = {
  coral:    { bg: 'from-coral-50 to-white',    iconBg: 'bg-coral-100',    iconFg: 'text-coral-600',    border: 'border-coral-100' },
  mint:     { bg: 'from-mint-50 to-white',     iconBg: 'bg-mint-100',     iconFg: 'text-mint-600',     border: 'border-mint-100' },
  lavender: { bg: 'from-lavender-50 to-white', iconBg: 'bg-lavender-100', iconFg: 'text-lavender-600', border: 'border-lavender-100' },
  peach:    { bg: 'from-peach-50 to-white',    iconBg: 'bg-peach-100',    iconFg: 'text-peach-600',    border: 'border-peach-100' },
  brand:    { bg: 'from-brand-50 to-white',    iconBg: 'bg-brand-100',    iconFg: 'text-brand-600',    border: 'border-brand-100' },
};

export function SuggestionsCard({
  babyId, stage, marker, phase, mode, lang = 'en', heading,
}: {
  babyId: string;
  stage: SuggestionStage;
  /** Baby: age in days. Pregnancy: gestational week. Cycle: days since
   *  last period start (or null if not enough data). */
  marker: number | null;
  /** Cycle phase, computed from cycle data. Only used when stage='cycle'. */
  phase?: CyclePhase;
  /** Wave 12: cycle mode for tagged suggestion filtering. Passed only
   *  when stage='cycle'. */
  mode?: CycleMode | null;
  lang?: 'en' | 'ar';
  /** Override the section heading. Defaults to a stage-appropriate one. */
  heading?: string;
}) {
  // Pick once per render. Memoised on inputs so the trio is stable for a
  // given day + profile. (pickToday hashes today's date key internally so a
  // page reload after midnight rotates the picks.)
  const todays = useMemo(
    () => pickToday({ babyId, stage, marker, phase, mode }),
    [babyId, stage, marker, phase, mode],
  );

  // Per-id done state. Hydrated from localStorage on mount; updates persist
  // through the rest of the day. SSR-safe (default empty Set).
  const [done, setDone] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = new Set<string>();
    for (const s of todays) {
      try {
        if (window.localStorage.getItem(doneKey(babyId, s.id)) === '1') next.add(s.id);
      } catch { /* localStorage may be unavailable */ }
    }
    setDone(next);
  }, [babyId, todays]);

  function toggleDone(id: string) {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        try { window.localStorage.removeItem(doneKey(babyId, id)); } catch { /* */ }
      } else {
        next.add(id);
        try { window.localStorage.setItem(doneKey(babyId, id), '1'); } catch { /* */ }
      }
      return next;
    });
  }

  if (todays.length === 0) return null;

  const isAr = lang === 'ar';
  const headingText = heading
    ?? (isAr ? 'اقتراحات اليوم'
            : 'Ideas for today');
  const subtitle = isAr
    ? 'مقترحات صغيرة تتناسب مع هذه المرحلة. تتجدد كل يوم.'
    : 'Small ideas matched to where this profile is. Refreshes daily.';
  const doneLabel    = isAr ? 'تم' : 'Done';
  const markDoneLabel = isAr ? 'تم اليوم' : 'Mark done';
  const minLabel     = isAr ? 'د' : 'min';

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-mint-50 to-lavender-50">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg grid place-items-center bg-mint-100 text-mint-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink-strong leading-tight">{headingText}</h2>
            <p className="text-[11px] text-ink-muted leading-tight">{subtitle}</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          <RefreshCw className="h-3 w-3" />
          {isAr ? 'يومي' : 'daily'}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {todays.map(s => {
          const Icon = ICON[s.icon] ?? Sparkles;
          const tint = TINT[s.tint];
          const isDone = done.has(s.id);
          const title = isAr ? s.title_ar : s.title_en;
          const body  = isAr ? s.body_ar  : s.body_en;
          return (
            <article
              key={s.id}
              className={`relative rounded-2xl border ${tint.border} bg-gradient-to-br ${tint.bg} p-4 transition ${
                isDone ? 'opacity-60' : ''
              }`}>
              <div className="flex items-start gap-3">
                <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${tint.iconBg} ${tint.iconFg}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold text-ink-strong text-sm leading-tight ${isDone ? 'line-through' : ''}`}>
                      {title}
                    </h3>
                    <span className="rounded-full bg-white/90 text-[10px] font-semibold text-ink-muted border border-slate-200 px-1.5 py-0.5 shrink-0">
                      {s.duration_min} {minLabel}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted leading-snug mt-1">{body}</p>
                  <button
                    type="button" onClick={() => toggleDone(s.id)}
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5 transition ${
                      isDone
                        ? 'bg-mint-500 text-white hover:bg-mint-600'
                        : 'border border-slate-200 bg-white hover:bg-slate-50 text-ink'
                    }`}>
                    <Check className="h-3.5 w-3.5" />
                    {isDone ? doneLabel : markDoneLabel}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

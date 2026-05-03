// ConsultationComingSoon — placeholder card shown across every stage
// (cycle / pregnancy / baby) advertising the upcoming "Ask a doctor"
// consultation feature. Pure server component — no interactivity yet.

import { Stethoscope, Sparkles } from 'lucide-react';

export function ConsultationComingSoon({ stage }: { stage: 'cycle' | 'pregnancy' | 'baby' }) {
  const copy = {
    cycle:     'Get a fertility consultation from a verified specialist.',
    pregnancy: 'Get a prenatal consultation from a verified OB-GYN.',
    baby:      'Get a pediatric consultation from a verified specialist.',
  }[stage];

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-50 via-white to-coral-50 border border-lavender-200/70 p-5">
      <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-lavender-200/60 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-4">
        <span className="h-11 w-11 rounded-2xl bg-lavender-500 text-white grid place-items-center shrink-0 shadow-card">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-ink-strong">Doctor consultation</h3>
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-coral-500 text-white px-2 py-0.5">
              <Sparkles className="h-2.5 w-2.5" /> Coming soon
            </span>
          </div>
          <p className="text-xs text-ink-muted mt-1.5 max-w-xl">
            {copy} Verified doctors will be able to read your shared logs (with your permission) and reply with personalized guidance — without leaving Babylytics.
          </p>
          <button type="button" disabled
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 text-ink-muted text-xs font-semibold px-3 py-1.5 cursor-not-allowed opacity-80">
            Notify me when it's live
          </button>
        </div>
      </div>
    </section>
  );
}

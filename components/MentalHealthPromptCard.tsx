'use client';

// MentalHealthPromptCard — Wave 41. Surfaced on the pregnancy + baby
// overview when mental_health_prompt_due returns a row. Shows a soft
// invitation ("Quick check-in?"), expands to the screener inline on
// click. The prompt cools down for 21 days after any submission so it
// doesn't nag.
//
// Intentionally never auto-opens — the user decides. Mental health
// screening pushed at the user vs offered to the user is the
// difference between helpful and creepy.

import { useState } from 'react';
import { Heart, X, ArrowRight } from 'lucide-react';
import { MentalHealthScreener } from '@/components/MentalHealthScreener';

interface PromptDue {
  kind:            'epds' | 'phq2';
  reason:          string;
  reason_label_en: string;
  reason_label_ar: string;
}

export function MentalHealthPromptCard({
  babyId, prompt, lang = 'en',
}: {
  babyId: string;
  prompt: PromptDue;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const [open,      setOpen]      = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  if (open) {
    return (
      <MentalHealthScreener
        babyId={babyId}
        kind={prompt.kind}
        lang={lang}
        onClose={() => setOpen(false)}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-4 flex items-start gap-3">
      <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
        <Heart className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">
          {isAr ? 'فحص الصحة النفسية' : 'Mental health check-in'}
        </div>
        <div className="text-sm font-semibold text-ink-strong mt-0.5">
          {isAr ? prompt.reason_label_ar : prompt.reason_label_en}
        </div>
        <p className="text-xs text-ink-muted mt-1 leading-relaxed">
          {prompt.kind === 'epds'
            ? (isAr
                ? '١٠ أسئلة، حوالي ٥ دقائق. النتيجة خاصة بكِ — لا أحد يراها.'
                : '10 questions, about 5 minutes. Your result is private — no one else sees it.')
            : (isAr
                ? 'سؤالان، أقل من دقيقة. النتيجة خاصة بكِ — لا أحد يراها.'
                : '2 quick questions. Your result is private — no one else sees it.')}
        </p>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-xs font-semibold px-3 py-1.5">
            {isAr ? 'ابدئي' : 'Start'} <ArrowRight className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => setDismissed(true)}
            className="text-[11px] text-ink-muted hover:text-ink-strong px-2 py-1.5">
            {isAr ? 'ليس الآن' : 'Not now'}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => setDismissed(true)}
        className="h-7 w-7 grid place-items-center rounded-full hover:bg-white/60 text-ink-muted shrink-0"
        aria-label={isAr ? 'إغلاق' : 'Dismiss'}>
        <X className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

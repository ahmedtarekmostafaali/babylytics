// PregnancyRiskBanner — Wave 33A. Server component that calls
// pregnancy_risk_signals(p_baby) and renders any returned signals as
// soft-yet-noticeable banners on the pregnancy overview.
//
// Severity → visual band:
//   urgent → coral border + filled background, top of stack
//   warn   → peach border + tint
//   info   → lavender border + light tint
//
// Each banner ends with a clear "tell your doctor" CTA. We never give
// advice — we surface the pattern + the relevant guideline + a nudge
// to talk to a clinician. The DB function is the source of truth for
// thresholds.

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AlertTriangle, AlertCircle, Info, Stethoscope } from 'lucide-react';

interface RiskSignal {
  kind:       string;
  severity:   'info' | 'warn' | 'urgent';
  message_en: string;
  message_ar: string;
  evidence:   Record<string, unknown> | null;
}

const SEVERITY_ORDER: Record<RiskSignal['severity'], number> = {
  urgent: 0,
  warn:   1,
  info:   2,
};

export async function PregnancyRiskBanner({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const supabase = createClient();
  const { data } = await supabase.rpc('pregnancy_risk_signals', { p_baby: babyId });
  const signals = ((data ?? []) as RiskSignal[])
    .slice()
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (signals.length === 0) return null;

  return (
    <section className="space-y-3 max-w-6xl mx-auto px-4 lg:px-8 mt-6">
      <div className="flex items-center gap-2 px-1">
        <Stethoscope className="h-3.5 w-3.5 text-ink-muted" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          {isAr ? 'إشارات تستحق المراجعة مع طبيبك' : 'Signals worth raising with your doctor'}
        </h2>
      </div>
      {signals.map((s, i) => {
        const tint =
          s.severity === 'urgent' ? 'border-coral-300 bg-coral-50 text-coral-900' :
          s.severity === 'warn'   ? 'border-peach-300 bg-peach-50 text-ink' :
                                    'border-lavender-300 bg-lavender-50/60 text-ink';
        const iconCls =
          s.severity === 'urgent' ? 'bg-coral-100 text-coral-700' :
          s.severity === 'warn'   ? 'bg-peach-100 text-peach-700' :
                                    'bg-lavender-100 text-lavender-700';
        const Icon =
          s.severity === 'urgent' ? AlertTriangle :
          s.severity === 'warn'   ? AlertCircle :
                                    Info;
        const msg = isAr ? s.message_ar : s.message_en;
        return (
          <article key={`${s.kind}-${i}`}
            className={`rounded-2xl border p-4 flex items-start gap-3 ${tint}`}>
            <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${iconCls}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-relaxed">{msg}</p>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <Link href={`/babies/${babyId}/doctors`}
                  className="inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline">
                  <Stethoscope className="h-3 w-3" />
                  {isAr ? 'افتحي صفحة الطبيب' : 'Open doctor page'}
                </Link>
                {s.severity !== 'info' && (
                  <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">
                    {isAr
                      ? (s.severity === 'urgent' ? 'عاجل' : 'تحذير')
                      : (s.severity === 'urgent' ? 'Urgent' : 'Warn')}
                  </span>
                )}
              </div>
            </div>
          </article>
        );
      })}
      <p className="text-[11px] text-ink-muted px-1 leading-relaxed">
        {isAr
          ? 'هذه إشارات فحص (screening) وليست تشخيصاً. القرار يعود لطبيبك. حدود الإنذار مأخوذة من إرشادات ACOG و ADA.'
          : 'These are screening signals, not diagnoses. Your doctor makes the call. Thresholds drawn from ACOG and ADA guidelines.'}
      </p>
    </section>
  );
}

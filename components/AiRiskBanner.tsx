// AiRiskBanner — Wave 35. Server component that calls
// ai_risk_signals(p_baby) and renders any returned signals as
// soft-yet-noticeable banners. Stage-aware header copy + doctor noun
// route the user toward the right kind of clinician (OB-GYN for cycle
// and pregnancy, pediatrician for baby).
//
// Severity → visual band:
//   urgent → coral border + filled background, top of stack
//   warn   → peach border + tint
//   info   → lavender border + light tint
//
// Renders nothing when there's nothing to flag — no false-positive
// noise on a healthy profile. Signals come from the SQL function which
// is the source of truth for thresholds.

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

type Stage = 'planning' | 'pregnancy' | 'baby';

const HEADER: Record<Stage, { en: string; ar: string }> = {
  planning:  {
    en: 'Cycle signals worth raising with your OB-GYN',
    ar: 'إشارات في دورتك تستحق المراجعة مع طبيبتك',
  },
  pregnancy: {
    en: 'Pregnancy signals worth raising with your doctor',
    ar: 'إشارات تستحق المراجعة مع طبيبتك',
  },
  baby:      {
    en: 'Pediatric signals worth raising with the doctor',
    ar: 'إشارات تستحق المراجعة مع طبيب الأطفال',
  },
};

const DOCTOR_LINK_LABEL: Record<Stage, { en: string; ar: string }> = {
  planning:  { en: 'Open OB-GYN page',     ar: 'افتحي صفحة الطبيبة' },
  pregnancy: { en: 'Open doctor page',     ar: 'افتحي صفحة الطبيبة' },
  baby:      { en: 'Open pediatrician page', ar: 'افتحي صفحة طبيب الأطفال' },
};

const FOOTER: Record<Stage, { en: string; ar: string }> = {
  planning: {
    en: 'Screening hints, not diagnoses. Your OB-GYN makes the call. Drawn from standard gynecology screening criteria.',
    ar: 'إشارات فحص لا تشخيص. القرار يعود لطبيبتك. مأخوذة من معايير فحص طب النساء.',
  },
  pregnancy: {
    en: 'Screening signals, not diagnoses. Your doctor makes the call. Thresholds drawn from ACOG and ADA guidelines.',
    ar: 'إشارات فحص لا تشخيص. القرار يعود لطبيبتك. حدود الإنذار مأخوذة من إرشادات ACOG و ADA.',
  },
  baby: {
    en: 'Screening signals, not diagnoses. Your pediatrician makes the call. Thresholds drawn from AAP and NICE guidance.',
    ar: 'إشارات فحص لا تشخيص. القرار يعود لطبيب الأطفال. حدود الإنذار مأخوذة من إرشادات AAP و NICE.',
  },
};

export async function AiRiskBanner({
  babyId, stage, lang = 'en',
}: {
  babyId: string;
  stage: Stage;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const supabase = createClient();
  const { data } = await supabase.rpc('ai_risk_signals', { p_baby: babyId });
  const signals = ((data ?? []) as RiskSignal[])
    .slice()
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (signals.length === 0) return null;

  return (
    <section className="space-y-3 max-w-6xl mx-auto px-4 lg:px-8 mt-6">
      <div className="flex items-center gap-2 px-1">
        <Stethoscope className="h-3.5 w-3.5 text-ink-muted" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
          {isAr ? HEADER[stage].ar : HEADER[stage].en}
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
                  {isAr ? DOCTOR_LINK_LABEL[stage].ar : DOCTOR_LINK_LABEL[stage].en}
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
        {isAr ? FOOTER[stage].ar : FOOTER[stage].en}
      </p>
    </section>
  );
}

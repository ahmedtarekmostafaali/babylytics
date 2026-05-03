// CycleRedFlagsCard — surfaces results from the cycle_red_flags RPC
// (sql/055). Pure display component, takes the rows server-side. Hidden
// when there are no flags. The RPC uses only the user's own historical
// data — no model training, no external lookups.

import { AlertTriangle, MessageCircle } from 'lucide-react';
import Link from 'next/link';

export interface CycleRedFlag {
  flag: string;
  severity: 'info' | 'warn' | 'urgent';
  detail: string;
}

const SEVERITY_TINT: Record<CycleRedFlag['severity'], string> = {
  info:   'border-brand-200 bg-brand-50/40',
  warn:   'border-peach-200 bg-peach-50/40',
  urgent: 'border-coral-300 bg-coral-50/60',
};

const SEVERITY_BADGE: Record<CycleRedFlag['severity'], string> = {
  info:   'bg-brand-100 text-brand-700',
  warn:   'bg-peach-100 text-peach-700',
  urgent: 'bg-coral-100 text-coral-700',
};

const SEVERITY_LABEL: Record<CycleRedFlag['severity'], string> = {
  info:   'Worth noting',
  warn:   'Worth checking',
  urgent: 'Talk to a doctor',
};

export function CycleRedFlagsCard({
  flags, babyId,
}: {
  flags: CycleRedFlag[];
  babyId: string;
}) {
  if (flags.length === 0) return null;

  // Only the highest-severity flag drives the call-to-action style. List
  // shows everything detected so the user can scan the full picture.
  const ranked: Record<CycleRedFlag['severity'], number> = { info: 0, warn: 1, urgent: 2 };
  const peak = flags.reduce((a, b) => ranked[b.severity] > ranked[a.severity] ? b : a);

  return (
    <section className={`rounded-2xl border ${SEVERITY_TINT[peak.severity]} p-5 space-y-3`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h3 className="text-sm font-bold text-ink-strong">Pattern check</h3>
        <span className={`inline-flex items-center rounded-full text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${SEVERITY_BADGE[peak.severity]}`}>
          {SEVERITY_LABEL[peak.severity]}
        </span>
      </div>

      <ul className="space-y-2">
        {flags.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink leading-relaxed">
            <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
              f.severity === 'urgent' ? 'bg-coral-500'
              : f.severity === 'warn' ? 'bg-peach-500' : 'bg-brand-500'
            }`} />
            <span>{f.detail}</span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-ink-muted leading-relaxed">
        These prompts come from your own historical data — Babylytics doesn&apos;t diagnose
        anything. They&apos;re cues to bring up at your next appointment.
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        <Link href={`/babies/${babyId}/chat`}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-xs font-semibold px-3 py-1.5">
          <MessageCircle className="h-3.5 w-3.5" /> Message my doctor
        </Link>
        <Link href={`/babies/${babyId}/medical-profile`}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-xs font-semibold px-3 py-1.5">
          Open medical profile
        </Link>
      </div>
    </section>
  );
}

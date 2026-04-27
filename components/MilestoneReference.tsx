import Link from 'next/link';
import { GraduationCap, ArrowRight, Check, Clock, AlertTriangle } from 'lucide-react';
import { MILESTONE_AGES, classifyMilestone, type MilestoneAgeRange } from '@/lib/growth-standards';
import { tFor, type Lang } from '@/lib/i18n';

type LoggedMilestone = {
  milestone_id: string;
  observed_at: string;       // ISO
};

type Props = {
  babyId: string;
  ageDays: number;
  /** From `developmental_milestones` table — first occurrence per id. */
  logged: LoggedMilestone[];
  /** Optional: derive `first_tooth` from the earliest `eruption` teething log. */
  firstToothFallback?: string | null;
  /** Optional: derive `first_words` / `first_sentence` from speaking logs. */
  firstWordFallback?: string | null;
  firstSentenceFallback?: string | null;
  /** dob ISO so we can compute age-at-occurrence. */
  dobIso: string | null;
  lang?: Lang;
};

/**
 * Side card on the overview that shows the typical age window for the big
 * developmental milestones (teething, crawling, walking, first words, first
 * sentence) along with where this baby sits relative to that window.
 *
 * The component is read-only — logging happens in the dedicated trackers
 * (teething / speaking) or via the developmental_milestones table.
 */
export function MilestoneReferenceCard({
  babyId, ageDays, logged, firstToothFallback,
  firstWordFallback, firstSentenceFallback, dobIso, lang = 'en',
}: Props) {
  const t = tFor(lang);
  const dobMs = dobIso ? new Date(dobIso).getTime() : null;
  const currentMonths = ageDays / 30.4375;

  const byId = new Map<string, string>();
  for (const l of logged) {
    if (!byId.has(l.milestone_id)) byId.set(l.milestone_id, l.observed_at);
  }
  if (firstToothFallback && !byId.has('first_tooth'))     byId.set('first_tooth', firstToothFallback);
  if (firstWordFallback && !byId.has('first_words'))      byId.set('first_words', firstWordFallback);
  if (firstSentenceFallback && !byId.has('first_sentence')) byId.set('first_sentence', firstSentenceFallback);

  function ageAtMonths(iso: string | undefined): number | null {
    if (!iso || !dobMs) return null;
    const ms = new Date(iso).getTime() - dobMs;
    return ms / (1000 * 60 * 60 * 24 * 30.4375);
  }

  // Show the milestones most relevant to current age — drop "first sentence"
  // entirely under 12 months, drop "last_tooth" from default view (only show
  // if we already have data for it). Always include first_tooth, crawling,
  // first_words, walking, first_sentence.
  const visible: MilestoneAgeRange[] = MILESTONE_AGES
    .filter(m => m.id !== 'last_tooth' || byId.has(m.id))
    .filter(m => m.id !== 'first_sentence' || currentMonths >= 12 || byId.has(m.id));

  return (
    <div className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50/70 via-white to-brand-50/40 p-4 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-7 w-7 rounded-lg grid place-items-center bg-lavender-500 text-white">
          <GraduationCap className="h-3.5 w-3.5" />
        </span>
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('milestones_ref.title')}</div>
        <Link href={`/babies/${babyId}/teething`}
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-medium px-2.5 py-0.5 text-ink-strong">
          {t('milestones_ref.log')} <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      <p className="text-[11px] text-ink-muted mb-3 leading-snug">
        {t('milestones_ref.intro')}
      </p>

      <ul className="space-y-2">
        {visible.map(m => {
          const occurredIso = byId.get(m.id);
          const occurredMonths = ageAtMonths(occurredIso);
          const cls = classifyMilestone(m, occurredMonths, currentMonths);
          // Localised milestone label, falling back to the English label
          // shipped in growth-standards.ts.
          const localisedLabel = (() => {
            const k = `milestones_ref.label_${m.id}`;
            const v = t(k);
            return v === k ? m.label : v;
          })();
          const localisedHint = (() => {
            const k = `milestones_ref.hint_${m.id}`;
            const v = t(k);
            return v === k ? m.hint : v;
          })();

          return (
            <li key={m.id} className="rounded-xl bg-white/70 border border-lavender-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{m.emoji}</span>
                <div className="font-bold text-sm text-ink-strong flex-1">{localisedLabel}</div>
                <Badge state={cls.state} t={t} />
              </div>

              <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                <Tick label={`${m.min_months}m`} sub={t('growth.min')} />
                <Tick label={`${m.avg_months}m`} sub={t('milestones_ref.avg')} highlight />
                <Tick label={`${m.max_months}m`} sub={t('milestones_ref.max')} />
                {occurredMonths != null && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-lavender-100 text-lavender-800 text-[11px] font-bold px-2 py-0.5">
                    {t('milestones_ref.logged_at', { months: occurredMonths.toFixed(1) })}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">{localisedHint}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tick({ label, sub, highlight }: { label: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md px-1.5 py-0.5 ${highlight ? 'bg-lavender-100 text-lavender-800 font-bold' : 'bg-slate-100 text-ink-muted'}`}>
      <span className="font-semibold">{label}</span>
      <span className="ml-1 text-[10px] uppercase tracking-wider">{sub}</span>
    </div>
  );
}

function Badge({ state, t }: { state: 'early'|'on_time'|'late'|'pending'|'overdue'; t: ReturnType<typeof tFor> }) {
  if (state === 'on_time') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[10px] font-bold px-2 py-0.5">
        <Check className="h-2.5 w-2.5" /> {t('milestones_ref.state_on_time')}
      </span>
    );
  }
  if (state === 'early') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5">
        <Check className="h-2.5 w-2.5" /> {t('milestones_ref.state_early')}
      </span>
    );
  }
  if (state === 'late') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-peach-50 text-peach-700 text-[10px] font-bold px-2 py-0.5">
        {t('milestones_ref.state_late')}
      </span>
    );
  }
  if (state === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-coral-50 text-coral-700 text-[10px] font-bold px-2 py-0.5">
        <AlertTriangle className="h-2.5 w-2.5" /> {t('milestones_ref.state_overdue')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink-muted text-[10px] font-bold px-2 py-0.5">
      <Clock className="h-2.5 w-2.5" /> {t('milestones_ref.state_pending')}
    </span>
  );
}

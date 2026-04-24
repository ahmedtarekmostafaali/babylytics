import { ageInDays } from '@/lib/dates';
import { fmtKg } from '@/lib/units';
import { Baby as BabyIcon, Sparkles } from 'lucide-react';

/**
 * Dramatic baby-dashboard hero. Full-bleed gradient, illustrated blob shapes,
 * floating baby avatar on the right. Inspired by the Mariam "Your Parenting
 * Journey" card.
 */
export function BabyHeader({
  baby,
  currentWeightKg,
}: {
  baby: { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null };
  currentWeightKg: number | null;
}) {
  const age = ageInDays(baby.dob);
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-coral-50 via-peach-50 to-mint-50 shadow-card">
      {/* organic background blobs */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id="bh-grad-a" cx="20%" cy="30%" r="60%">
            <stop offset="0%"  stopColor="#F4A6A6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#F4A6A6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bh-grad-b" cx="85%" cy="80%" r="55%">
            <stop offset="0%"  stopColor="#7FC8A9" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7FC8A9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="300" fill="url(#bh-grad-a)" />
        <rect width="800" height="300" fill="url(#bh-grad-b)" />
        <circle cx="720" cy="40"  r="60" fill="#FFF" opacity="0.35" />
        <circle cx="40"  cy="260" r="40" fill="#FFF" opacity="0.35" />
      </svg>

      <div className="relative p-6 sm:p-8 flex items-center gap-6 flex-wrap">
        {/* big circular avatar */}
        <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0">
          <div className="absolute inset-0 rounded-full bg-white shadow-card" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-100 to-mint-100 grid place-items-center">
            <BabyIcon className="h-10 w-10 sm:h-12 sm:w-12 text-brand-600" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-peach-500" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-mint-700">
            Baby profile
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong leading-tight">
            Hello {baby.name} <span className="text-coral-500">🤍</span>
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Chip tint="coral">{baby.gender}</Chip>
            <Chip tint="mint">{age} days old</Chip>
            <Chip tint="brand">current weight {fmtKg(currentWeightKg)}</Chip>
            {baby.birth_weight_kg && <Chip tint="peach">birth {fmtKg(Number(baby.birth_weight_kg))}</Chip>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ tint, children }: { tint: 'coral'|'mint'|'brand'|'peach'|'lavender'; children: React.ReactNode }) {
  const map = {
    coral:    'bg-white/80 text-coral-700',
    mint:     'bg-white/80 text-mint-700',
    brand:    'bg-white/80 text-brand-700',
    peach:    'bg-white/80 text-peach-700',
    lavender: 'bg-white/80 text-lavender-700',
  }[tint];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium shadow-sm ${map}`}>
      {children}
    </span>
  );
}

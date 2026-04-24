import { ageInDays } from '@/lib/dates';
import { fmtKg } from '@/lib/units';
import { HeroCard } from '@/components/HeroCard';
import { Baby as BabyIcon } from 'lucide-react';

export function BabyHeader({
  baby,
  currentWeightKg,
}: {
  baby: { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null };
  currentWeightKg: number | null;
}) {
  const age = ageInDays(baby.dob);
  return (
    <HeroCard tint="brand">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="h-16 w-16 rounded-2xl bg-white shadow-card grid place-items-center shrink-0">
          <BabyIcon className="h-8 w-8 text-brand-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-mint-600">Baby dashboard</div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong truncate">{baby.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <Chip>{baby.gender}</Chip>
            <Chip>{age} days old</Chip>
            <Chip>{fmtKg(currentWeightKg)}</Chip>
            {baby.birth_weight_kg && <Chip>birth {fmtKg(Number(baby.birth_weight_kg))}</Chip>}
          </div>
        </div>
      </div>
    </HeroCard>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/75 border border-slate-200/80 px-3 py-0.5">
      {children}
    </span>
  );
}

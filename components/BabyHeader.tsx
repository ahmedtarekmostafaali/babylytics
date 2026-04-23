import { ageInDays } from '@/lib/dates';
import { fmtKg } from '@/lib/units';
import { Baby as BabyIcon } from 'lucide-react';

export function BabyHeader({
  baby,
  currentWeightKg,
}: {
  baby: { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null };
  currentWeightKg: number | null;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-brand-100 text-brand-700 grid place-items-center shrink-0">
        <BabyIcon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink-strong truncate">{baby.name}</h1>
        <p className="text-sm text-ink-muted">
          {baby.gender} · {ageInDays(baby.dob)} days old · current weight {fmtKg(currentWeightKg)}
        </p>
      </div>
    </div>
  );
}

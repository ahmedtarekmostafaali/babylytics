import Link from 'next/link';
import { ageInDays } from '@/lib/dates';
import { fmtKg } from '@/lib/units';

export function BabyHeader({
  baby,
  currentWeightKg,
}: {
  baby: { id: string; name: string; dob: string; gender: string; birth_weight_kg: number | null };
  currentWeightKg: number | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{baby.name}</h1>
          <p className="text-sm text-slate-500">
            {baby.gender} · {ageInDays(baby.dob)} days old · current weight {fmtKg(currentWeightKg)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href={`/babies/${baby.id}/edit`}        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Edit profile</Link>
          <Link href={`/babies/${baby.id}/medications`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Medications</Link>
          <Link href={`/babies/${baby.id}/caregivers`}  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Caregivers</Link>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`/babies/${baby.id}/feedings/new`}      className="rounded-md bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600">Log feed</Link>
        <Link href={`/babies/${baby.id}/stool/new`}         className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Log stool</Link>
        <Link href={`/babies/${baby.id}/medications/log`}   className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Log dose</Link>
        <Link href={`/babies/${baby.id}/measurements/new`}  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Log measurement</Link>
        <Link href={`/babies/${baby.id}/upload`}            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50">Upload file</Link>
      </div>
    </div>
  );
}

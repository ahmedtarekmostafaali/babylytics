'use client';

// AreaPicker — checkbox grid grouped by category. Shared between
// InviteForm (set on invite), CaregiverRowActions (edit later), and the
// /preferences feature picker.
//
// Pass `value = null` for "all areas" (the unrestricted default). Pass an
// array to mark only those checked. onChange returns null when every box is
// checked, an array otherwise.

import { useMemo } from 'react';
import { ALL_AREAS, AREA_LABELS, STAGE_AREAS, type Area } from '@/lib/areas';
import { Eye, EyeOff } from 'lucide-react';

type Props = {
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /** Limit the picker to a single stage's areas (useful in the registration
   *  feature picker). Omit to show every area. */
  stage?: 'planning' | 'pregnancy' | 'baby';
  className?: string;
};

const GROUPS: { label: string; areas: readonly Area[] }[] = [
  { label: 'Cycle',          areas: ['planner'] },
  { label: 'Vital signs',    areas: ['feedings','stool','sleep','temperature','measurements','vitals','blood_sugar','vomiting','maternal_vitals','symptoms'] },
  { label: 'Care',           areas: ['medications','medication_stock','vaccinations','labs','doctors','appointments'] },
  { label: 'Pregnancy',      areas: ['prenatal_visits','ultrasounds','kicks'] },
  { label: 'Development',    areas: ['activities','teething','speaking','screen_time'] },
  { label: 'Records',        areas: ['files','medical_profile','reports','shopping'] },
];

export function AreaPicker({ value, onChange, stage, className = '' }: Props) {
  // Filter the universe by stage (if any) so callers can show only the
  // areas that apply to a planning/pregnancy/baby user.
  const universe = useMemo<Set<string>>(() => {
    if (!stage) return new Set(ALL_AREAS);
    return new Set(STAGE_AREAS[stage]);
  }, [stage]);

  const selected: Set<string> = useMemo(
    () => new Set(value ?? ALL_AREAS),
    [value]
  );

  function toggle(area: string) {
    const next = new Set(selected);
    if (next.has(area)) next.delete(area); else next.add(area);
    // Normalise: if every area in scope is checked, persist as `null` so
    // future schema additions show up without forcing a re-edit.
    const everySelected = Array.from(universe).every(a => next.has(a));
    onChange(everySelected ? null : Array.from(next).filter(a => universe.has(a)));
  }

  function selectAll() { onChange(null); }
  function selectNone() { onChange([]); }

  const totalInScope = universe.size;
  const onCount = Array.from(selected).filter(a => universe.has(a)).length;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{onCount} of {totalInScope} areas allowed</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAll}
            className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1">
            <Eye className="h-3 w-3" /> All
          </button>
          <button type="button" onClick={selectNone}
            className="text-coral-600 hover:text-coral-700 font-semibold inline-flex items-center gap-1">
            <EyeOff className="h-3 w-3" /> None
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {GROUPS.map(g => {
          const inScope = g.areas.filter(a => universe.has(a));
          if (inScope.length === 0) return null;
          return (
            <div key={g.label} className="rounded-xl border border-slate-200 bg-white">
              <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                {g.label}
              </div>
              <div className="grid sm:grid-cols-2 gap-1.5 p-2">
                {inScope.map(area => {
                  const on = selected.has(area);
                  return (
                    <label key={area}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-sm transition ${
                        on ? 'bg-mint-50 text-ink-strong' : 'text-ink-muted hover:bg-slate-50'
                      }`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(area)}
                        className="h-4 w-4 rounded border-slate-300 text-mint-500 focus:ring-mint-500" />
                      {AREA_LABELS[area]}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

// CycleModeCard — picker for the cycle profile mode. Drives suggestion
// filtering (lib/suggestions.ts) and surfaces mode-specific tracking
// fields. Lives on the planner page top-bar so it's prominent and
// editable any time.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Sparkles, Activity, AlertCircle, Heart, Trophy, Baby, Loader2, Check,
} from 'lucide-react';

export type CycleMode = 'standard' | 'pcos' | 'endometriosis' | 'irregular' | 'athlete' | 'postpartum';

const MODES: {
  value: CycleMode;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: string;
}[] = [
  { value: 'standard',     label: 'Standard',          desc: '21–35 day cycle, no specific condition',
    icon: Sparkles, tint: 'bg-brand-100 text-brand-700' },
  { value: 'pcos',         label: 'PCOS',              desc: 'Polycystic ovary syndrome — irregular cycles, hormone tracking',
    icon: AlertCircle, tint: 'bg-coral-100 text-coral-700' },
  { value: 'endometriosis',label: 'Endometriosis',     desc: 'Heavy / painful periods — pain + symptom emphasis',
    icon: Heart, tint: 'bg-lavender-100 text-lavender-700' },
  { value: 'irregular',    label: 'Irregular',         desc: 'Cycle lengths vary widely — gentler predictions',
    icon: Activity, tint: 'bg-peach-100 text-peach-700' },
  { value: 'athlete',      label: 'Athlete',           desc: 'High training load — phase-aware workout tips',
    icon: Trophy, tint: 'bg-mint-100 text-mint-700' },
  { value: 'postpartum',   label: 'Postpartum',        desc: 'Returning cycles after birth — recovery tracking',
    icon: Baby, tint: 'bg-coral-100 text-coral-700' },
];

export function CycleModeCard({
  babyId, initialMode, canEdit = true,
}: {
  babyId: string;
  initialMode: CycleMode | null;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CycleMode>(initialMode ?? 'standard');
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function save(next: CycleMode) {
    if (next === mode) return;
    setMode(next);
    setErr(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.from('babies')
        .update({ cycle_mode: next })
        .eq('id', babyId);
      if (error) { setErr(error.message); return; }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-coral-50 to-lavender-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg grid place-items-center bg-coral-100 text-coral-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-ink-strong leading-tight">Cycle mode</h3>
            <p className="text-[11px] text-ink-muted leading-tight">
              Tunes daily ideas, predictions, and red-flag thresholds to your cycle type.
            </p>
          </div>
        </div>
        {savedAt && (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[10px] font-bold px-2 py-0.5">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 p-4">
        {MODES.map(o => {
          const active = mode === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => canEdit && save(o.value)}
              disabled={!canEdit || pending}
              className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                active
                  ? 'ring-2 ring-coral-500 border-transparent bg-coral-50/40'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${o.tint}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-ink-strong text-sm">{o.label}</span>
                <span className="block text-[11px] text-ink-muted leading-snug">{o.desc}</span>
              </span>
              {active && (pending
                ? <Loader2 className="h-4 w-4 text-coral-600 animate-spin shrink-0" />
                : <Check className="h-4 w-4 text-coral-600 shrink-0" />)}
            </button>
          );
        })}
      </div>

      {err && <p className="px-4 pb-3 text-xs text-coral-600">{err}</p>}
    </section>
  );
}

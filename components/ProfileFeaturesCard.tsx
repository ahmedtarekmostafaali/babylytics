'use client';

// ProfileFeaturesCard — per-profile feature picker, lives on each baby's
// /edit page right rail. Replaces the old per-user-per-stage feature picker
// that used to live on /preferences (kept on /preferences for backward
// compat removed in 051; this is the canonical home).
//
// The AreaPicker is automatically filtered by the profile's stage so a
// pregnancy profile only offers pregnancy-relevant areas, etc.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AreaPicker } from '@/components/AreaPicker';
import { Sliders, Save, Check, Loader2 } from 'lucide-react';
import { stageBucket } from '@/lib/areas';
import type { LifecycleStage } from '@/lib/lifecycle';

export function ProfileFeaturesCard({
  babyId, stage, initial, canEdit,
}: {
  babyId: string;
  /** Raw lifecycle_stage value from the babies table — bucketed via stageBucket. */
  stage: LifecycleStage | null;
  /** Current babies.enabled_features value. null = unrestricted. */
  initial: string[] | null;
  /** Only parents/owners can edit; others see a disabled summary. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const bucket = stageBucket(stage);
  const [features, setFeatures] = useState<string[] | null>(initial);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function save() {
    setErr(null);
    start(async () => {
      const supabase = createClient();
      // RPC enforces parent/owner; falls through with a friendly error
      // for everyone else.
      const { error } = await supabase.rpc('set_baby_features', {
        p_baby: babyId,
        p_features: features,
      });
      if (error) { setErr(error.message); return; }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="h-9 w-9 rounded-xl bg-mint-100 text-mint-600 grid place-items-center">
          <Sliders className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">Features in sidebar</h3>
          <p className="text-[11px] text-ink-muted">
            {bucket === 'planning' ? 'Cycle stage' : bucket === 'pregnancy' ? 'Pregnancy stage' : 'Baby stage'}
            {' · '}
            {features == null ? 'all areas' : `${features.length} selected`}
          </p>
        </div>
      </div>
      <p className="text-xs text-ink-muted mb-3">
        {canEdit
          ? 'Pick which sections appear in the sidebar for this profile. Tap "All" to show everything.'
          : 'Only parents/owners can change which features show for this profile.'}
      </p>

      {/* Disable interactivity for non-parents — RPC would reject anyway,
          but better UX than letting them click and fail. */}
      <div className={canEdit ? '' : 'opacity-60 pointer-events-none'}>
        <AreaPicker value={features} onChange={setFeatures} stage={bucket} />
      </div>

      {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {err && <span className="text-xs text-coral-600 mr-auto">{err}</span>}
          {savedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-mint-50 text-mint-700 text-[11px] font-bold px-2 py-0.5">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
          <button type="button" onClick={save} disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mint-500 to-mint-600 text-white text-sm font-semibold px-4 py-1.5 disabled:opacity-60">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save features
          </button>
        </div>
      )}
    </section>
  );
}

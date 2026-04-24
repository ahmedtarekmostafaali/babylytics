'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CarePlanSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Label, Select, Textarea } from '@/components/ui/Input';
import { Save, Pencil } from 'lucide-react';

export type CarePlanValue = {
  medical_plan?: string | null;
  feeding_plan?: string | null;
  labs_needed?: string | null;
  blood_type?: string | null;
};

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

/**
 * Inline editor for the per-baby care plan. Shows the current values as read
 * text by default, swaps to an editable form when the parent clicks Edit.
 * Doctors / caregivers see read-only.
 */
export function CarePlanInline({
  babyId, initial, canEdit,
}: {
  babyId: string;
  initial: CarePlanValue;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [medicalPlan, setMedicalPlan] = useState(initial.medical_plan ?? '');
  const [feedingPlan, setFeedingPlan] = useState(initial.feeding_plan ?? '');
  const [labsNeeded, setLabsNeeded]   = useState(initial.labs_needed ?? '');
  const [bloodType, setBloodType]     = useState(initial.blood_type ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    const parsed = CarePlanSchema.safeParse({
      medical_plan: medicalPlan || null,
      feeding_plan: feedingPlan || null,
      labs_needed: labsNeeded || null,
      blood_type: bloodType || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('care_plan').upsert({
      baby_id: babyId,
      ...parsed.data,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PlanField label="Blood type" value={initial.blood_type} mono />
          <PlanField label="Medical plan" value={initial.medical_plan} multiline />
          <PlanField label="Feeding plan & suggestions" value={initial.feeding_plan} multiline />
          <PlanField label="Labs / tests still needed" value={initial.labs_needed} multiline />
        </div>
        {canEdit && (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline no-export">
            <Pencil className="h-3.5 w-3.5" /> Edit care plan
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Blood type</Label>
          <Select value={bloodType} onChange={e => setBloodType(e.target.value)}>
            {BLOOD_TYPES.map(t => (
              <option key={t} value={t}>{t || '— Unknown —'}</option>
            ))}
          </Select>
        </div>
        <div className="hidden sm:block" />
        <div className="sm:col-span-2">
          <Label>Medical plan</Label>
          <Textarea rows={3} value={medicalPlan} onChange={e => setMedicalPlan(e.target.value)}
            placeholder="Ongoing therapies, monitoring schedule, special precautions…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Feeding plan & suggestions</Label>
          <Textarea rows={3} value={feedingPlan} onChange={e => setFeedingPlan(e.target.value)}
            placeholder="Recommended formula, breastfeeding cadence, solids progression, restrictions…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Labs / tests still needed</Label>
          <Textarea rows={3} value={labsNeeded} onChange={e => setLabsNeeded(e.target.value)}
            placeholder="Pending blood work, imaging, follow-up labs to schedule…" />
        </div>
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={save} disabled={saving}
          className="rounded-full bg-gradient-to-r from-brand-500 to-mint-500 px-5">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save care plan'}
        </Button>
        <button type="button" onClick={() => setEditing(false)}
          className="text-sm text-ink-muted hover:text-ink-strong">Cancel</button>
      </div>
    </div>
  );
}

function PlanField({ label, value, multiline, mono }: { label: string; value: string | null | undefined; multiline?: boolean; mono?: boolean }) {
  const empty = !value || !value.trim();
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className={`mt-1 ${mono ? 'font-mono' : ''} ${empty ? 'text-ink-muted italic' : 'text-ink-strong'} ${multiline ? 'whitespace-pre-wrap' : ''}`}>
        {empty ? 'Not set' : value}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MarkAsBornSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Baby, X, Heart } from 'lucide-react';
import { localInputToIso, nowLocalInput } from '@/lib/dates';

/**
 * Pregnancy → Newborn transition dialog. Calls the SQL `mark_baby_born` RPC
 * which atomically updates the baby row + seeds an initial `measurements`
 * entry from the birth stats.
 */
export function MarkAsBornDialog({ babyId, babyName, suggestedName }: {
  babyId: string;
  babyName: string;
  suggestedName?: string;
}) {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState(babyName === 'Baby' && suggestedName ? suggestedName : babyName);
  const [dob, setDob]     = useState(nowLocalInput());
  const [gender, setGender] = useState<'male'|'female'>('female');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [head, setHead]     = useState('');
  const [err, setErr]       = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setErr(null);
    const iso = localInputToIso(dob);
    if (!iso) { setErr('Pick a valid date and time of birth.'); return; }
    const parsed = MarkAsBornSchema.safeParse({
      dob: iso,
      birth_weight_kg: weight ? Number(weight) : null,
      birth_height_cm: height ? Number(height) : null,
      head_circ_cm:    head   ? Number(head)   : null,
      gender,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();

    // Update name in case the parent waited until birth to pick one
    if (name && name !== babyName) {
      await supabase.from('babies').update({ name }).eq('id', babyId);
    }

    const { error } = await supabase.rpc('mark_baby_born', {
      p_baby: babyId,
      p_dob: parsed.data.dob,
      p_birth_weight_kg: parsed.data.birth_weight_kg ?? null,
      p_birth_height_cm: parsed.data.birth_height_cm ?? null,
      p_head_circ_cm:    parsed.data.head_circ_cm ?? null,
      p_gender: parsed.data.gender ?? 'female',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setOpen(false);
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}
        className="rounded-full bg-gradient-to-r from-coral-500 to-peach-500 px-5 h-11">
        <Baby className="h-4 w-4" /> Mark as born
      </Button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-panel p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100"
              aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-600 grid place-items-center">
                <Heart className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-ink-strong">Welcome to the world!</h3>
                <p className="text-xs text-ink-muted">All your pregnancy data stays attached — this just unlocks the newborn tracker.</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <Label>Baby&apos;s name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Their name" />
              </div>
              <div>
                <Label>Date &amp; time of birth</Label>
                <Input type="datetime-local" value={dob} onChange={e => setDob(e.target.value)} required />
                <p className="text-xs text-ink-muted mt-1">Exact time matters for first-day feeding math.</p>
              </div>
              <div>
                <Label>Gender</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'female', label: 'Female' },
                    { v: 'male',   label: 'Male' },
                  ].map(o => (
                    <button type="button" key={o.v} onClick={() => setGender(o.v as typeof gender)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                        gender === o.v
                          ? 'border-coral-500 bg-coral-50 text-coral-700'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.001" min={0} max={10} value={weight} onChange={e => setWeight(e.target.value)} placeholder="3.4" />
                </div>
                <div>
                  <Label>Height (cm)</Label>
                  <Input type="number" step="0.1" min={0} max={80} value={height} onChange={e => setHeight(e.target.value)} placeholder="51" />
                </div>
                <div>
                  <Label>Head (cm)</Label>
                  <Input type="number" step="0.1" min={0} max={80} value={head} onChange={e => setHead(e.target.value)} placeholder="35" />
                </div>
              </div>
            </div>

            {err && <p className="mt-3 text-sm text-coral-600 font-medium">{err}</p>}

            <div className="mt-5 flex items-center gap-2">
              <Button type="button" onClick={submit} disabled={saving}
                className="flex-1 rounded-full bg-gradient-to-r from-coral-500 to-peach-500 h-12">
                <Baby className="h-4 w-4" /> {saving ? 'Recording…' : 'Confirm birth'}
              </Button>
              <button type="button" onClick={() => setOpen(false)}
                className="text-sm text-ink-muted hover:text-ink-strong">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

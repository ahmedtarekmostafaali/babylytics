'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppointmentSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2 } from 'lucide-react';
import { Section, Field, QuickPill, Stepper, WhenPicker } from '@/components/forms/FormKit';

export type AppointmentFormValue = {
  id?: string;
  doctor_id: string | null;
  scheduled_at: string;
  duration_min?: number | null;
  purpose?: string | null;
  location?: string | null;
  status?: 'scheduled'|'completed'|'cancelled'|'missed'|'rescheduled';
  notes?: string | null;
  conclusion?: string | null;
};

const STATUSES: { value: NonNullable<AppointmentFormValue['status']>; label: string }[] = [
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'missed',      label: 'Missed'      },
  { value: 'rescheduled', label: 'Rescheduled' },
];

export function AppointmentForm({
  babyId, doctors, initial,
}: {
  babyId: string;
  doctors: { id: string; name: string; specialty: string | null }[];
  initial?: AppointmentFormValue;
}) {
  const router = useRouter();
  const [doctorId, setDoctorId] = useState<string | null>(initial?.doctor_id ?? doctors[0]?.id ?? null);
  const [when, setWhen]         = useState(initial?.scheduled_at ? isoToLocalInput(initial.scheduled_at) : nowLocalInput());
  const [duration, setDuration] = useState<number>(initial?.duration_min ?? 30);
  const [purpose, setPurpose]   = useState(initial?.purpose ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [status, setStatus]     = useState<AppointmentFormValue['status']>(initial?.status ?? 'scheduled');
  const [notes, setNotes]       = useState(initial?.notes ?? '');
  const [conclusion, setConclusion] = useState(initial?.conclusion ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(when);
    if (!iso) { setErr('Pick a valid time.'); return; }
    const parsed = AppointmentSchema.safeParse({
      doctor_id: doctorId || null,
      scheduled_at: iso,
      duration_min: duration ? Number(duration) : null,
      purpose: purpose || null,
      location: location || null,
      status: status ?? 'scheduled',
      notes: notes || null,
      conclusion: conclusion || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('appointments').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('appointments').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/doctors`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this appointment?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/doctors`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Doctor + status */}
      <Section n={1} title="Who and what status?">
        <div className="space-y-4">
          <Field label="Doctor">
            <Select
              value={doctorId ?? ''}
              onChange={e => setDoctorId(e.target.value || null)}
              className="h-12 rounded-2xl"
            >
              <option value="">— No doctor —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.specialty ? ` · ${d.specialty}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <div className="flex flex-wrap gap-2">
              {STATUSES.map(s => (
                <QuickPill key={s.value} active={status === s.value} onClick={() => setStatus(s.value)} tint="lavender">
                  {s.label}
                </QuickPill>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      {/* 2. When + duration + purpose */}
      <Section n={2} title="When and what for?">
        <div className="space-y-4">
          <WhenPicker time={when} onChange={setWhen} tint="lavender" />
          <Stepper
            label="Duration"
            value={duration}
            onChange={setDuration}
            unit="min"
            step={5}
            min={5}
            max={600}
            badge={{ text: 'TIME', tint: 'lavender' }}
          />
          <Field label="Purpose">
            <input
              value={purpose ?? ''}
              onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. 2-month check-up, vaccination"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30"
            />
          </Field>
        </div>
      </Section>

      {/* 3. Location */}
      <Section n={3} title="Where?" optional>
        <Field label="Location">
          <input
            value={location ?? ''}
            onChange={e => setLocation(e.target.value)}
            placeholder="Clinic address or video link"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30"
          />
        </Field>
      </Section>

      {/* 4. Notes — split prep + conclusion */}
      <Section n={4} title="Add details" optional>
        <div className="space-y-4">
          <Field label="Prep notes (before the visit)" hint="Questions to ask, prep notes, things to remember.">
            <textarea
              rows={3}
              value={notes ?? ''}
              onChange={e => setNotes(e.target.value)}
              placeholder="Questions to ask, prep notes, things to remember…"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30"
            />
          </Field>
          <Field label="Doctor's conclusion (after the visit)" hint="Fill this in after the appointment so it stays in the baby's record.">
            <textarea
              rows={4}
              value={conclusion ?? ''}
              onChange={e => setConclusion(e.target.value)}
              placeholder="What the doctor said, diagnosis, treatment plan, follow-up instructions, next appointment, prescriptions issued, etc."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30"
            />
          </Field>
        </div>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-brand-500 hover:from-lavender-600 hover:to-brand-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Book appointment'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">Takes less than 2 seconds <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

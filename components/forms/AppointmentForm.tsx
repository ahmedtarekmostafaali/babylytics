'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AppointmentSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2, CalendarClock } from 'lucide-react';

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
  const [duration, setDuration] = useState<string>(initial?.duration_min?.toString() ?? '30');
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
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Doctor</Label>
          <Select value={doctorId ?? ''} onChange={e => setDoctorId(e.target.value || null)}>
            <option value="">— No doctor —</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}{d.specialty ? ` · ${d.specialty}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as AppointmentFormValue['status'])}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="missed">Missed</option>
            <option value="rescheduled">Rescheduled</option>
          </Select>
        </div>
        <div>
          <Label>Date & time</Label>
          <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} required />
        </div>
        <div>
          <Label>Duration (min)</Label>
          <Input type="number" min={5} max={600} step={5} value={duration} onChange={e => setDuration(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Purpose</Label>
          <Input value={purpose ?? ''} onChange={e => setPurpose(e.target.value)} placeholder="e.g. 2-month check-up, vaccination" />
        </div>
        <div className="sm:col-span-2">
          <Label>Location</Label>
          <Input value={location ?? ''} onChange={e => setLocation(e.target.value)} placeholder="Clinic address or video link" />
        </div>
      </div>

      <div>
        <Label>Prep notes (before the visit)</Label>
        <Textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder="Questions to ask, prep notes, things to remember…" />
      </div>

      <div>
        <Label>Doctor&apos;s conclusion (after the visit)</Label>
        <Textarea rows={4} value={conclusion ?? ''} onChange={e => setConclusion(e.target.value)}
          placeholder="What the doctor said, diagnosis, treatment plan, follow-up instructions, next appointment, prescriptions issued, etc." />
        <p className="text-[11px] text-ink-muted mt-1">Fill this in after the appointment so it stays in the baby&apos;s record.</p>
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <CalendarClock className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Book appointment'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-12 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

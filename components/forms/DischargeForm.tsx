'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DischargeSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput, fmtDateTime } from '@/lib/dates';
import { Trash2, LogOut } from 'lucide-react';

export type DischargeFormValue = {
  id?: string;
  discharged_at: string;
  admission_id?: string | null;
  hospital?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  follow_up?: string | null;
  notes?: string | null;
  file_id?: string | null;
};

export function DischargeForm({
  babyId, admissions, initial,
}: {
  babyId: string;
  admissions: { id: string; admitted_at: string; hospital: string | null; reason: string | null }[];
  initial?: DischargeFormValue;
}) {
  const router = useRouter();
  const [dischargedAt, setDischargedAt] = useState(initial?.discharged_at ? isoToLocalInput(initial.discharged_at) : nowLocalInput());
  const [admissionId, setAdmissionId]   = useState<string | null>(initial?.admission_id ?? admissions[0]?.id ?? null);
  const [hospital, setHospital]         = useState(initial?.hospital ?? '');
  const [diagnosis, setDiagnosis]       = useState(initial?.diagnosis ?? '');
  const [treatment, setTreatment]       = useState(initial?.treatment ?? '');
  const [followUp, setFollowUp]         = useState(initial?.follow_up ?? '');
  const [notes, setNotes]               = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(dischargedAt);
    if (!iso) { setErr('Pick a valid discharge time.'); return; }
    const parsed = DischargeSchema.safeParse({
      discharged_at: iso,
      admission_id: admissionId || null,
      hospital: hospital || null,
      diagnosis: diagnosis || null,
      treatment: treatment || null,
      follow_up: followUp || null,
      notes: notes || null,
      file_id: initial?.file_id ?? null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('discharges').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('discharges').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this discharge record?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('discharges')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Discharged at</Label>
          <Input type="datetime-local" value={dischargedAt} onChange={e => setDischargedAt(e.target.value)} required />
        </div>
        <div>
          <Label>Linked admission</Label>
          <Select value={admissionId ?? ''} onChange={e => setAdmissionId(e.target.value || null)}>
            <option value="">— Standalone (no admission record) —</option>
            {admissions.map(a => (
              <option key={a.id} value={a.id}>
                {fmtDateTime(a.admitted_at)} · {a.hospital ?? 'unknown'}{a.reason ? ` · ${a.reason}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Hospital</Label>
          <Input value={hospital} onChange={e => setHospital(e.target.value)} placeholder="Hospital name" />
        </div>
        <div className="sm:col-span-2">
          <Label>Discharge diagnosis</Label>
          <Textarea rows={2} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Treatment given</Label>
          <Textarea rows={3} value={treatment} onChange={e => setTreatment(e.target.value)}
            placeholder="Procedures, medications, length of stay, transfusions…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Follow-up plan</Label>
          <Textarea rows={2} value={followUp} onChange={e => setFollowUp(e.target.value)}
            placeholder="Next appointments, meds to continue, red-flag symptoms…" />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-mint-500 to-brand-500">
          <LogOut className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save discharge'}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicalConditionSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Trash2, Activity } from 'lucide-react';

export type ConditionFormValue = {
  id?: string;
  name: string;
  icd_code?: string | null;
  diagnosed_at?: string | null;
  status: 'active'|'resolved'|'chronic'|'suspected';
  treatment?: string | null;
  notes?: string | null;
};

export function ConditionForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ConditionFormValue;
}) {
  const router = useRouter();
  const [name, setName]               = useState(initial?.name ?? '');
  const [icdCode, setIcdCode]         = useState(initial?.icd_code ?? '');
  const [diagnosedAt, setDiagnosedAt] = useState(initial?.diagnosed_at ?? '');
  const [status, setStatus]           = useState<ConditionFormValue['status']>(initial?.status ?? 'active');
  const [treatment, setTreatment]     = useState(initial?.treatment ?? '');
  const [notes, setNotes]             = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = MedicalConditionSchema.safeParse({
      name, icd_code: icdCode || null, diagnosed_at: diagnosedAt || null,
      status, treatment: treatment || null, notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('medical_conditions').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('medical_conditions').insert({
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
    if (!window.confirm('Delete this condition?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('medical_conditions')
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
        <div className="sm:col-span-2">
          <Label>Condition</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Asthma, Reflux (GERD), Iron deficiency anemia" />
        </div>
        <div>
          <Label>ICD-10 code (optional)</Label>
          <Input value={icdCode} onChange={e => setIcdCode(e.target.value)} placeholder="e.g. J45.9" />
        </div>
        <div>
          <Label>Diagnosed on</Label>
          <Input type="date" value={diagnosedAt} onChange={e => setDiagnosedAt(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as ConditionFormValue['status'])}>
            <option value="active">Active</option>
            <option value="chronic">Chronic</option>
            <option value="suspected">Suspected</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Treatment / management</Label>
          <Textarea rows={3} value={treatment} onChange={e => setTreatment(e.target.value)}
            placeholder="Current meds, lifestyle changes, monitoring schedule…" />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-brand-500 to-mint-500">
          <Activity className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save condition'}
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

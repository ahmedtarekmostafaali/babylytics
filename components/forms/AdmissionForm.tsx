'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AdmissionSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, Hospital } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type AdmissionFormValue = {
  id?: string;
  admitted_at: string;
  hospital?: string | null;
  department?: string | null;
  reason?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  file_id?: string | null;
};

export function AdmissionForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: AdmissionFormValue;
}) {
  const router = useRouter();
  const t = useT();
  const [admittedAt, setAdmittedAt] = useState(initial?.admitted_at ? isoToLocalInput(initial.admitted_at) : nowLocalInput());
  const [hospital, setHospital]     = useState(initial?.hospital ?? '');
  const [department, setDepartment] = useState(initial?.department ?? '');
  const [reason, setReason]         = useState(initial?.reason ?? '');
  const [diagnosis, setDiagnosis]   = useState(initial?.diagnosis ?? '');
  const [notes, setNotes]           = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(admittedAt);
    if (!iso) { setErr(t('forms.adm_pick_valid_time')); return; }
    const parsed = AdmissionSchema.safeParse({
      admitted_at: iso,
      hospital: hospital || null,
      department: department || null,
      reason: reason || null,
      diagnosis: diagnosis || null,
      notes: notes || null,
      file_id: initial?.file_id ?? null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('admissions').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('admissions').insert({
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
    if (!window.confirm(t('forms.adm_delete_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('admissions')
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
          <Label>{t('forms.adm_admitted_at')}</Label>
          <Input type="datetime-local" value={admittedAt} onChange={e => setAdmittedAt(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.adm_department')}</Label>
          <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder={t('forms.adm_department_ph')} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.adm_hospital')}</Label>
          <Input value={hospital} onChange={e => setHospital(e.target.value)} placeholder={t('forms.adm_hospital_ph')} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.adm_reason')}</Label>
          <Input value={reason} onChange={e => setReason(e.target.value)} placeholder={t('forms.adm_reason_ph')} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.adm_diagnosis')}</Label>
          <Textarea rows={2} value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder={t('forms.adm_diagnosis_ph')} />
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.adm_notes_ph')} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <Hospital className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.adm_save_cta')}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PrenatalVisitSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, Stethoscope } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type PrenatalVisitValue = {
  id?: string;
  visited_at: string;
  gestational_week?: number | null;
  gestational_day?: number | null;
  maternal_weight_kg?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  fetal_heart_rate_bpm?: number | null;
  fundal_height_cm?: number | null;
  doctor_id?: string | null;
  file_id?: string | null;
  notes?: string | null;
};

export function PrenatalVisitForm({
  babyId, doctors, initial,
}: {
  babyId: string;
  doctors: { id: string; name: string; specialty: string | null }[];
  initial?: PrenatalVisitValue;
}) {
  const router = useRouter();
  const t = useT();
  const [visitedAt, setVisitedAt] = useState(initial?.visited_at ? isoToLocalInput(initial.visited_at) : nowLocalInput());
  const [gw, setGw]               = useState<string>(initial?.gestational_week?.toString() ?? '');
  const [gd, setGd]               = useState<string>(initial?.gestational_day?.toString() ?? '');
  const [weight, setWeight]       = useState<string>(initial?.maternal_weight_kg?.toString() ?? '');
  const [sys, setSys]             = useState<string>(initial?.bp_systolic?.toString() ?? '');
  const [dia, setDia]             = useState<string>(initial?.bp_diastolic?.toString() ?? '');
  const [fhr, setFhr]             = useState<string>(initial?.fetal_heart_rate_bpm?.toString() ?? '');
  const [fundal, setFundal]       = useState<string>(initial?.fundal_height_cm?.toString() ?? '');
  const [doctorId, setDoctorId]   = useState<string | null>(initial?.doctor_id ?? doctors[0]?.id ?? null);
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(visitedAt);
    if (!iso) { setErr('Pick a valid visit time.'); return; }
    const parsed = PrenatalVisitSchema.safeParse({
      visited_at: iso,
      gestational_week: gw ? Number(gw) : null,
      gestational_day:  gd ? Number(gd) : null,
      maternal_weight_kg: weight ? Number(weight) : null,
      bp_systolic:        sys    ? Number(sys)    : null,
      bp_diastolic:       dia    ? Number(dia)    : null,
      fetal_heart_rate_bpm: fhr  ? Number(fhr)    : null,
      fundal_height_cm:   fundal ? Number(fundal) : null,
      doctor_id: doctorId || null,
      file_id:   initial?.file_id ?? null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('prenatal_visits').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('prenatal_visits').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/visits`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this prenatal visit?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('prenatal_visits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/visits`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('forms.visit_date')}</Label>
          <Input type="datetime-local" value={visitedAt} onChange={e => setVisitedAt(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.visit_provider')}</Label>
          <Select value={doctorId ?? ''} onChange={e => setDoctorId(e.target.value || null)}>
            <option value="">—</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ''}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t('forms.visit_ga_weeks')}</Label>
          <Input type="number" min={0} max={45} value={gw} onChange={e => setGw(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_ga_days')}</Label>
          <Input type="number" min={0} max={6} value={gd} onChange={e => setGd(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_weight')}</Label>
          <Input type="number" step="0.1" min={20} max={300} value={weight} onChange={e => setWeight(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_fundal_height')}</Label>
          <Input type="number" step="0.1" min={0} max={60} value={fundal} onChange={e => setFundal(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_bp_sys')}</Label>
          <Input type="number" min={50} max={260} value={sys} onChange={e => setSys(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_bp_dia')}</Label>
          <Input type="number" min={30} max={180} value={dia} onChange={e => setDia(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_fetal_hr')}</Label>
          <Input type="number" min={50} max={250} value={fhr} onChange={e => setFhr(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <Stethoscope className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.visit_save_cta')}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { PregnancyProfileSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Save, Heart } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type PregnancyProfileValue = {
  mother_dob?: string | null;
  mother_blood_type?: string | null;
  gravida?: number | null;
  para?: number | null;
  pre_pregnancy_weight_kg?: number | null;
  pre_pregnancy_height_cm?: number | null;
  risk_factors?: string | null;
  notes?: string | null;
};

const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

export function PregnancyProfileForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: PregnancyProfileValue;
}) {
  const router = useRouter();
  const t = useT();
  const [motherDob, setMotherDob]       = useState(initial?.mother_dob ?? '');
  const [bloodType, setBloodType]       = useState(initial?.mother_blood_type ?? '');
  const [gravida, setGravida]           = useState<string>(initial?.gravida?.toString() ?? '');
  const [para, setPara]                 = useState<string>(initial?.para?.toString() ?? '');
  const [preWeight, setPreWeight]       = useState<string>(initial?.pre_pregnancy_weight_kg?.toString() ?? '');
  const [preHeight, setPreHeight]       = useState<string>(initial?.pre_pregnancy_height_cm?.toString() ?? '');
  const [riskFactors, setRiskFactors]   = useState(initial?.risk_factors ?? '');
  const [notes, setNotes]               = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const parsed = PregnancyProfileSchema.safeParse({
      mother_dob: motherDob || null,
      mother_blood_type: bloodType || null,
      gravida: gravida ? Number(gravida) : null,
      para:    para    ? Number(para)    : null,
      pre_pregnancy_weight_kg: preWeight ? Number(preWeight) : null,
      pre_pregnancy_height_cm: preHeight ? Number(preHeight) : null,
      risk_factors: riskFactors || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('pregnancy_profile').upsert({
      baby_id: babyId,
      ...parsed.data,
      updated_by: (await supabase.auth.getUser()).data.user?.id,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg(t('forms.preg_saved'));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('forms.preg_mother_dob')}</Label>
          <Input type="date" value={motherDob} onChange={e => setMotherDob(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.preg_mother_blood')}</Label>
          <Select value={bloodType} onChange={e => setBloodType(e.target.value)}>
            {BLOOD_TYPES.map(bt => <option key={bt} value={bt}>{bt || t('forms.preg_unknown')}</option>)}
          </Select>
        </div>
        <div>
          <Label>{t('forms.preg_gravida')}</Label>
          <Input type="number" min={0} max={30} value={gravida} onChange={e => setGravida(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.preg_para')}</Label>
          <Input type="number" min={0} max={30} value={para} onChange={e => setPara(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.preg_pre_weight')}</Label>
          <Input type="number" step="0.1" min={20} max={300} value={preWeight} onChange={e => setPreWeight(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.preg_pre_height')}</Label>
          <Input type="number" step="0.1" min={100} max={250} value={preHeight} onChange={e => setPreHeight(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>{t('forms.preg_risk_factors')}</Label>
        <Textarea rows={2} value={riskFactors} onChange={e => setRiskFactors(e.target.value)} />
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
      {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-peach-500">
          <Heart className="h-4 w-4" /> {saving ? t('forms.saving') : t('forms.preg_save_cta')}
        </Button>
      </div>
    </form>
  );
}

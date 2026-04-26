'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MedicalConditionSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Trash2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

export type ConditionFormValue = {
  id?: string;
  name: string;
  icd_code?: string | null;
  diagnosed_at?: string | null;
  status: 'active'|'resolved'|'chronic'|'suspected';
  treatment?: string | null;
  notes?: string | null;
};

// Common pediatric conditions surfaced as one-tap pills. ICD-10 codes are
// approximate — the parent or doctor can refine on edit. The list errs on the
// side of "things parents in our pilot ask about" rather than a comprehensive
// medical taxonomy.
const PRESETS: { name: string; icd: string; emoji: string }[] = [
  { name: "Cow's milk protein allergy",  icd: 'K52.21', emoji: '🥛' },
  { name: 'Lactose intolerance',         icd: 'E73.9',  emoji: '🥛' },
  { name: 'Eczema (atopic dermatitis)',  icd: 'L20.9',  emoji: '🧴' },
  { name: 'Reflux (GERD)',               icd: 'K21.9',  emoji: '🍼' },
  { name: 'Colic',                       icd: 'R10.83', emoji: '😢' },
  { name: 'Asthma',                      icd: 'J45.9',  emoji: '🌬️' },
  { name: 'Bronchiolitis',               icd: 'J21.9',  emoji: '🫁' },
  { name: 'Otitis media (ear infection)',icd: 'H66.9',  emoji: '👂' },
  { name: 'Iron-deficiency anemia',      icd: 'D50.9',  emoji: '🩸' },
  { name: 'Vitamin D deficiency',        icd: 'E55.9',  emoji: '☀️' },
  { name: 'Jaundice (neonatal)',         icd: 'P59.9',  emoji: '🟡' },
  { name: 'Diaper rash',                 icd: 'L22',    emoji: '👶' },
  { name: 'Thrush (oral candidiasis)',   icd: 'B37.0',  emoji: '🍼' },
  { name: 'Constipation',                icd: 'K59.0',  emoji: '💩' },
  { name: 'Egg allergy',                 icd: 'Z91.012',emoji: '🥚' },
  { name: 'Peanut allergy',              icd: 'Z91.010',emoji: '🥜' },
];

export function ConditionForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ConditionFormValue;
}) {
  const router = useRouter();
  const t = useT();
  const [name, setName]               = useState(initial?.name ?? '');
  const [icdCode, setIcdCode]         = useState(initial?.icd_code ?? '');
  const [diagnosedAt, setDiagnosedAt] = useState(initial?.diagnosed_at ?? '');
  const [status, setStatus]           = useState<ConditionFormValue['status']>(initial?.status ?? 'active');
  const [treatment, setTreatment]     = useState(initial?.treatment ?? '');
  const [notes, setNotes]             = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pickPreset(p: typeof PRESETS[number]) {
    setName(p.name);
    if (!icdCode) setIcdCode(p.icd);
  }

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
      {/* Quick presets — only on the new form, not edit. */}
      {!initial?.id && (
        <div>
          <Label>{t('forms.cond_section_picks')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button type="button" key={p.name} onClick={() => pickPreset(p)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  name === p.name
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-ink',
                )}>
                <span className="text-base leading-none">{p.emoji}</span>
                {p.name}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-ink-muted mt-1">{t('forms.cond_picks_help')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{t('forms.cond_name')}</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.cond_icd')}</Label>
          <Input value={icdCode} onChange={e => setIcdCode(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_diagnosed_at')}</Label>
          <Input type="date" value={diagnosedAt} onChange={e => setDiagnosedAt(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_status')}</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as ConditionFormValue['status'])}>
            <option value="active">{t('forms.cond_status_active')}</option>
            <option value="chronic">{t('forms.cond_status_chronic')}</option>
            <option value="suspected">{t('forms.cond_status_suspected')}</option>
            <option value="resolved">{t('forms.cond_status_resolved')}</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.cond_treatment')}</Label>
          <Textarea rows={3} value={treatment} onChange={e => setTreatment(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-brand-500 to-mint-500">
          <Activity className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.cond_save_cta')}
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

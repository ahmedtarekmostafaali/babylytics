'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AllergySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type AllergyFormValue = {
  id?: string;
  allergen: string;
  category?: 'food'|'drug'|'environmental'|'contact'|'latex'|'other'|null;
  reaction?: string | null;
  severity: 'mild'|'moderate'|'severe'|'life_threatening';
  diagnosed_at?: string | null;
  status: 'active'|'resolved'|'suspected';
  notes?: string | null;
};

export function AllergyForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: AllergyFormValue;
}) {
  const router = useRouter();
  const t = useT();
  const [allergen, setAllergen]   = useState(initial?.allergen ?? '');
  const [category, setCategory]   = useState<AllergyFormValue['category']>(initial?.category ?? 'food');
  const [reaction, setReaction]   = useState(initial?.reaction ?? '');
  const [severity, setSeverity]   = useState<AllergyFormValue['severity']>(initial?.severity ?? 'mild');
  const [diagnosedAt, setDiagnosedAt] = useState(initial?.diagnosed_at ?? '');
  const [status, setStatus]       = useState<AllergyFormValue['status']>(initial?.status ?? 'active');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = AllergySchema.safeParse({
      allergen, category: category || null, reaction: reaction || null,
      severity, diagnosed_at: diagnosedAt || null, status, notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('allergies').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('allergies').insert({
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
    if (!window.confirm('Delete this allergy record?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('allergies')
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
          <Label>{t('forms.allergy_substance')}</Label>
          <Input value={allergen} onChange={e => setAllergen(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.allergy_category')}</Label>
          <Select value={category ?? ''} onChange={e => setCategory((e.target.value || null) as AllergyFormValue['category'])}>
            <option value="">{t('forms.preg_unknown')}</option>
            <option value="food">{t('forms.allergy_cat_food')}</option>
            <option value="drug">{t('forms.allergy_cat_drug')}</option>
            <option value="environmental">{t('forms.allergy_cat_env')}</option>
            <option value="contact">{t('forms.allergy_cat_contact')}</option>
            <option value="latex">{t('forms.allergy_cat_latex')}</option>
            <option value="other">{t('forms.allergy_cat_other')}</option>
          </Select>
        </div>
        <div>
          <Label>{t('forms.allergy_severity')}</Label>
          <Select value={severity} onChange={e => setSeverity(e.target.value as AllergyFormValue['severity'])}>
            <option value="mild">{t('forms.allergy_severity_mild')}</option>
            <option value="moderate">{t('forms.allergy_severity_moderate')}</option>
            <option value="severe">{t('forms.allergy_severity_severe')}</option>
            <option value="life_threatening">{t('forms.allergy_severity_anaphylactic')}</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.allergy_reaction')}</Label>
          <Textarea rows={2} value={reaction} onChange={e => setReaction(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_diagnosed_at')}</Label>
          <Input type="date" value={diagnosedAt} onChange={e => setDiagnosedAt(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_status')}</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as AllergyFormValue['status'])}>
            <option value="active">{t('forms.cond_status_active')}</option>
            <option value="suspected">{t('forms.cond_status_suspected')}</option>
            <option value="resolved">{t('forms.cond_status_resolved')}</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-peach-500">
          <AlertTriangle className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.allergy_save_cta')}
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

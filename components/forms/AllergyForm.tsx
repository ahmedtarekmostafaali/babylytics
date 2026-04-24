'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AllergySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Trash2, AlertTriangle } from 'lucide-react';

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
          <Label>Allergen</Label>
          <Input value={allergen} onChange={e => setAllergen(e.target.value)} required placeholder="e.g. Cow's milk protein, Penicillin, Peanuts" />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category ?? ''} onChange={e => setCategory((e.target.value || null) as AllergyFormValue['category'])}>
            <option value="">— Unknown —</option>
            <option value="food">Food</option>
            <option value="drug">Drug</option>
            <option value="environmental">Environmental</option>
            <option value="contact">Contact</option>
            <option value="latex">Latex</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label>Severity</Label>
          <Select value={severity} onChange={e => setSeverity(e.target.value as AllergyFormValue['severity'])}>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
            <option value="life_threatening">Life-threatening (anaphylaxis)</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Reaction</Label>
          <Textarea rows={2} value={reaction} onChange={e => setReaction(e.target.value)}
            placeholder="What happens — hives, vomiting, swelling, breathing difficulty…" />
        </div>
        <div>
          <Label>Diagnosed on</Label>
          <Input type="date" value={diagnosedAt} onChange={e => setDiagnosedAt(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as AllergyFormValue['status'])}>
            <option value="active">Active</option>
            <option value="suspected">Suspected</option>
            <option value="resolved">Resolved</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Treatment plan, EpiPen on hand, avoidance instructions…" />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-peach-500">
          <AlertTriangle className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save allergy'}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DoctorSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Save, Trash2, Star } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type DoctorFormValue = {
  id?: string;
  name: string;
  specialty?: string | null;
  clinic?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_primary?: boolean;
};

export function DoctorForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: DoctorFormValue;
}) {
  const router = useRouter();
  const t = useT();
  const [name, setName]           = useState(initial?.name ?? '');
  const [specialty, setSpecialty] = useState(initial?.specialty ?? '');
  const [clinic, setClinic]       = useState(initial?.clinic ?? '');
  const [phone, setPhone]         = useState(initial?.phone ?? '');
  const [email, setEmail]         = useState(initial?.email ?? '');
  const [address, setAddress]     = useState(initial?.address ?? '');
  const [notes, setNotes]         = useState(initial?.notes ?? '');
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = DoctorSchema.safeParse({
      name, specialty: specialty || null, clinic: clinic || null,
      phone: phone || null, email: email || null, address: address || null,
      notes: notes || null, is_primary: isPrimary,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();

    // If marking this one as primary, clear the flag on others first.
    if (parsed.data.is_primary) {
      await supabase.from('doctors').update({ is_primary: false })
        .eq('baby_id', babyId).neq('id', initial?.id ?? '00000000-0000-0000-0000-000000000000');
    }

    const op = initial?.id
      ? supabase.from('doctors').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('doctors').insert({
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
    if (!window.confirm(t('forms.doc_remove_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('doctors')
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
          <Label>{t('forms.doc_full_name')}</Label>
          <Input value={name} required onChange={e => setName(e.target.value)} placeholder={t('forms.doc_full_name_ph')} />
        </div>
        <div>
          <Label>{t('forms.doc_specialty')}</Label>
          <Input value={specialty ?? ''} onChange={e => setSpecialty(e.target.value)} placeholder={t('forms.doc_specialty_ph')} />
        </div>
        <div>
          <Label>{t('forms.doc_clinic')}</Label>
          <Input value={clinic ?? ''} onChange={e => setClinic(e.target.value)} placeholder={t('forms.doc_clinic_ph')} />
        </div>
        <div>
          <Label>{t('forms.doc_phone')}</Label>
          <Input value={phone ?? ''} onChange={e => setPhone(e.target.value)} placeholder={t('forms.doc_phone_ph')} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.doc_email')}</Label>
          <Input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} placeholder={t('forms.doc_email_ph')} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.doc_address')}</Label>
          <Input value={address ?? ''} onChange={e => setAddress(e.target.value)} placeholder={t('forms.doc_address_ph')} />
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.doc_notes_ph')} />
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-lavender-50/50 px-4 py-3 text-sm cursor-pointer">
        <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
        <Star className={`h-4 w-4 ${isPrimary ? 'text-peach-600 fill-peach-500' : 'text-ink-muted'}`} />
        <span>{t('forms.doc_set_primary')}</span>
      </label>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <Save className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.doc_save_cta')}
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

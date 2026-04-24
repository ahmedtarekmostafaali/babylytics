'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DoctorSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Save, Trash2, Star } from 'lucide-react';

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
    if (!window.confirm('Remove this doctor? Existing appointments will be kept but their doctor link will be cleared.')) return;
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
          <Label>Full name</Label>
          <Input value={name} required onChange={e => setName(e.target.value)} placeholder="Dr. Sarah Ahmed" />
        </div>
        <div>
          <Label>Specialty</Label>
          <Input value={specialty ?? ''} onChange={e => setSpecialty(e.target.value)} placeholder="Pediatrician" />
        </div>
        <div>
          <Label>Clinic / hospital</Label>
          <Input value={clinic ?? ''} onChange={e => setClinic(e.target.value)} placeholder="Cairo Children Clinic" />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone ?? ''} onChange={e => setPhone(e.target.value)} placeholder="+20 100 000 0000" />
        </div>
        <div className="sm:col-span-2">
          <Label>Email</Label>
          <Input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" />
        </div>
        <div className="sm:col-span-2">
          <Label>Address</Label>
          <Input value={address ?? ''} onChange={e => setAddress(e.target.value)} placeholder="12 Orouba St, Heliopolis" />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder="Office hours, insurance, anything worth remembering." />
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-lavender-50/50 px-4 py-3 text-sm cursor-pointer">
        <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} />
        <Star className={`h-4 w-4 ${isPrimary ? 'text-peach-600 fill-peach-500' : 'text-ink-muted'}`} />
        <span>Set as primary doctor</span>
      </label>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Add doctor'}
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

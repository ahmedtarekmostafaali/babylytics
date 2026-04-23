'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';

export function InviteForm({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor'|'viewer'|'owner'>('editor');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('invite_caregiver', {
      p_baby: babyId, p_email: email, p_role: role,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg(`Added ${email} as ${role}.`);
    setEmail('');
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div>
        <Label htmlFor="em">Email (must already have a Babylytics account)</Label>
        <Input id="em" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="rl">Role</Label>
        <Select id="rl" value={role} onChange={e => setRole(e.target.value as 'editor')}>
          <option value="viewer">Viewer (read-only)</option>
          <option value="editor">Editor (write logs)</option>
          <option value="owner">Owner (full control)</option>
        </Select>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={saving || !email}>{saving ? 'Inviting…' : 'Invite'}</Button>
    </form>
  );
}

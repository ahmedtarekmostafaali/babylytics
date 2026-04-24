'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Shield, Stethoscope, Heart, Eye, Check } from 'lucide-react';

export type CaregiverRole = 'parent' | 'doctor' | 'nurse' | 'viewer';

const ROLE_OPTIONS: { value: CaregiverRole; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tint: string }[] = [
  { value: 'parent', label: 'Parent / Guardian', desc: 'Full access — write every log, upload files, invite caregivers.', icon: Shield,      tint: 'bg-brand-100 text-brand-700' },
  { value: 'doctor', label: 'Doctor',            desc: 'Read logs, add comments, export reports. No write access.',        icon: Stethoscope, tint: 'bg-lavender-100 text-lavender-700' },
  { value: 'nurse',  label: 'Nurse',             desc: 'Read-only access to logs. Cannot add, edit, or comment.',         icon: Heart,       tint: 'bg-coral-100 text-coral-700' },
  { value: 'viewer', label: 'Viewer',            desc: 'Overview page only. No access to logs or reports.',               icon: Eye,         tint: 'bg-slate-100 text-ink' },
];

export function InviteForm({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<CaregiverRole>('nurse');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!email) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('invite_caregiver', { p_baby: babyId, p_email: email, p_role: role });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg(`Added ${email} as ${role}.`);
    setEmail('');
    router.refresh();
  }

  const selected = ROLE_OPTIONS.find(r => r.value === role)!;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-ink-strong mb-2">Email address</div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
          <Input type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="caregiver@example.com"
            className="pl-9" />
        </div>
        <p className="mt-1 text-xs text-ink-muted">They must already have a Babylytics account.</p>
      </div>

      <div>
        <div className="text-sm font-semibold text-ink-strong mb-2">Select role</div>
        <div className="grid gap-2">
          {ROLE_OPTIONS.map(o => {
            const active = role === o.value;
            const Icon = o.icon;
            return (
              <button type="button" key={o.value} onClick={() => setRole(o.value)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  active ? 'ring-2 ring-brand-500 border-transparent bg-brand-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}>
                <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${o.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-ink-strong text-sm">{o.label}</span>
                  <span className="block text-xs text-ink-muted truncate">{o.desc}</span>
                </span>
                {active && <Check className="h-4 w-4 text-brand-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-ink-muted">
        <span className="font-semibold text-ink">Permissions for this caregiver.</span>{' '}
        Set automatically based on role — you can change it at any time from the table above.
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
      {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}

      <Button type="submit" disabled={saving || !email}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-mint-500 to-mint-600">
        <Mail className="h-4 w-4" /> {saving ? 'Inviting…' : `Invite ${selected.label.toLowerCase()}`}
      </Button>
    </form>
  );
}

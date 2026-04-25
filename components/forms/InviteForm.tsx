'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Mail, Shield, Stethoscope, Heart, Eye, Check, Link2, Copy, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CaregiverRole = 'parent' | 'doctor' | 'nurse' | 'viewer';
type Mode = 'email' | 'link';

const ROLE_OPTIONS: { value: CaregiverRole; label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tint: string }[] = [
  { value: 'parent', label: 'Parent / Guardian', desc: 'Full access — write every log, upload files, invite caregivers.', icon: Shield,      tint: 'bg-brand-100 text-brand-700' },
  { value: 'doctor', label: 'Doctor',            desc: 'Read logs, add comments, export reports. No write access.',        icon: Stethoscope, tint: 'bg-lavender-100 text-lavender-700' },
  { value: 'nurse',  label: 'Nurse',             desc: 'Read-only access to logs. Cannot add, edit, or comment.',         icon: Heart,       tint: 'bg-coral-100 text-coral-700' },
  { value: 'viewer', label: 'Viewer',            desc: 'Overview page only. No access to logs or reports.',               icon: Eye,         tint: 'bg-slate-100 text-ink' },
];

export function InviteForm({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [mode, setMode]   = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [role, setRole]   = useState<CaregiverRole>('nurse');
  const [message, setMessage] = useState('');
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submitEmail(e: React.FormEvent) {
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

  async function generateLink() {
    setErr(null); setMsg(null); setCopied(false); setLinkUrl(null);
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('invitations').insert({
      baby_id: babyId,
      role,
      email: email || null,
      message: message || null,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    }).select('id').single();
    setSaving(false);
    if (error || !data) { setErr(error?.message ?? 'Failed to create link'); return; }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setLinkUrl(`${origin}/invite/${data.id}`);
    router.refresh();
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  }

  async function shareLink() {
    if (!linkUrl) return;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: 'Babylytics caregiver invite',
          text: message || 'You\'re invited to help with the baby on Babylytics.',
          url: linkUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }

  const selected = ROLE_OPTIONS.find(r => r.value === role)!;

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="rounded-2xl bg-slate-100 p-1 grid grid-cols-2 text-sm font-semibold">
        <button type="button"
          onClick={() => { setMode('email'); setLinkUrl(null); setMsg(null); }}
          className={cn('rounded-xl py-2 transition inline-flex items-center justify-center gap-1.5',
            mode === 'email' ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
          <Mail className="h-4 w-4" /> By email
        </button>
        <button type="button"
          onClick={() => { setMode('link'); setMsg(null); }}
          className={cn('rounded-xl py-2 transition inline-flex items-center justify-center gap-1.5',
            mode === 'link' ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
          <Link2 className="h-4 w-4" /> Share link
        </button>
      </div>

      {/* Role picker (shared by both modes) */}
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

      {mode === 'email' ? (
        <form onSubmit={submitEmail} className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-ink-strong mb-2">Email address</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="caregiver@example.com"
                className="pl-9" />
            </div>
            <p className="mt-1 text-xs text-ink-muted">They must already have a Babylytics account. If they don&apos;t, use the share-link tab instead.</p>
          </div>
          {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
          {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}
          <Button type="submit" disabled={saving || !email}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-mint-500 to-mint-600">
            <Mail className="h-4 w-4" /> {saving ? 'Inviting…' : `Invite ${selected.label.toLowerCase()}`}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-ink-strong mb-2">Pre-fill email (optional)</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="dr.elsayed@clinic.com"
                className="pl-9" />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-strong mb-2">Welcome message (optional)</div>
            <Textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
              placeholder="A short note for the recipient…" />
          </div>

          {!linkUrl ? (
            <>
              {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
              <Button type="button" disabled={saving} onClick={generateLink}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
                <Link2 className="h-4 w-4" /> {saving ? 'Generating…' : `Generate link for ${selected.label.toLowerCase()}`}
              </Button>
              <p className="text-[11px] text-ink-muted text-center">
                Anyone with the link can join as <strong>{selected.label}</strong>. Link expires in 14 days. The recipient will need to create a Babylytics account if they don&apos;t already have one.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-mint-700">Invite link ready · 14-day expiry</div>
              <div className="rounded-xl bg-white border border-slate-200 p-2 text-xs font-mono text-ink-strong break-all">
                {linkUrl}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={copyLink} className="rounded-full bg-brand-500 hover:bg-brand-600">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy link'}
                </Button>
                <Button type="button" onClick={shareLink} variant="secondary" className="rounded-full">
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <button type="button" onClick={() => { setLinkUrl(null); setEmail(''); setMessage(''); }}
                  className="text-xs text-ink-muted hover:text-ink-strong ml-auto self-center">
                  Generate another
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

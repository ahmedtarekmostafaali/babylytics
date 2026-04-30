'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Mail, Shield, Stethoscope, Heart, Eye, Check, Link2, Copy, Share2, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

// 046 batch added 'pharmacy' as a caregiver role with read-only access to
// medication stock + dose history (RLS enforced server-side).
export type CaregiverRole = 'parent' | 'doctor' | 'nurse' | 'viewer' | 'pharmacy';
type Mode = 'email' | 'link';

const ROLE_META: { value: CaregiverRole; icon: React.ComponentType<{ className?: string }>; tint: string }[] = [
  { value: 'parent',   icon: Shield,      tint: 'bg-brand-100 text-brand-700'     },
  { value: 'doctor',   icon: Stethoscope, tint: 'bg-lavender-100 text-lavender-700' },
  { value: 'nurse',    icon: Heart,       tint: 'bg-coral-100 text-coral-700'     },
  { value: 'pharmacy', icon: Pill,        tint: 'bg-mint-100 text-mint-700'       },
  { value: 'viewer',   icon: Eye,         tint: 'bg-slate-100 text-ink'           },
];

export function InviteForm({ babyId }: { babyId: string }) {
  const router = useRouter();
  const t = useT();
  const ROLE_LABEL: Record<CaregiverRole, string> = {
    parent:   t('forms.invite_role_parent'),
    doctor:   t('forms.invite_role_doctor'),
    nurse:    t('forms.invite_role_nurse'),
    viewer:   t('forms.invite_role_viewer'),
    pharmacy: 'Pharmacy',
  };
  const ROLE_DESC: Record<CaregiverRole, string> = {
    parent:   t('forms.invite_role_parent_desc'),
    doctor:   t('forms.invite_role_doctor_desc'),
    nurse:    t('forms.invite_role_nurse_desc'),
    viewer:   t('forms.invite_role_viewer_desc'),
    pharmacy: 'Sees medication stock + dose history only. Useful for refill coordination.',
  };
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
    setMsg(t('forms.invite_email_added', { email, role: ROLE_LABEL[role] }));
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
    if (error || !data) { setErr(error?.message ?? t('forms.invite_link_failed')); return; }
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
          title: t('forms.invite_link_share_title'),
          text: message || t('forms.invite_link_share_text'),
          url: linkUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }

  const selectedLabel = ROLE_LABEL[role];

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="rounded-2xl bg-slate-100 p-1 grid grid-cols-2 text-sm font-semibold">
        <button type="button"
          onClick={() => { setMode('email'); setLinkUrl(null); setMsg(null); }}
          className={cn('rounded-xl py-2 transition inline-flex items-center justify-center gap-1.5',
            mode === 'email' ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
          <Mail className="h-4 w-4" /> {t('forms.invite_by_email')}
        </button>
        <button type="button"
          onClick={() => { setMode('link'); setMsg(null); }}
          className={cn('rounded-xl py-2 transition inline-flex items-center justify-center gap-1.5',
            mode === 'link' ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
          <Link2 className="h-4 w-4" /> {t('forms.invite_by_link')}
        </button>
      </div>

      {/* Role picker (shared by both modes) */}
      <div>
        <div className="text-sm font-semibold text-ink-strong mb-2">{t('forms.invite_role_label')}</div>
        <div className="grid gap-2">
          {ROLE_META.map(o => {
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
                  <span className="block font-semibold text-ink-strong text-sm">{ROLE_LABEL[o.value]}</span>
                  <span className="block text-xs text-ink-muted truncate">{ROLE_DESC[o.value]}</span>
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
            <div className="text-sm font-semibold text-ink-strong mb-2">{t('forms.invite_email_label')}</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('forms.invite_email_ph')}
                className="pl-9" />
            </div>
            <p className="mt-1 text-xs text-ink-muted">{t('forms.invite_email_help')}</p>
          </div>
          {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
          {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}
          <Button type="submit" disabled={saving || !email}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-mint-500 to-mint-600">
            <Mail className="h-4 w-4" /> {saving ? t('forms.invite_inviting') : t('forms.invite_send_cta', { role: selectedLabel })}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-ink-strong mb-2">{t('forms.invite_link_pre_email_label')}</div>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
              <Input type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={t('forms.invite_link_pre_email_ph')}
                className="pl-9" />
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-strong mb-2">{t('forms.invite_link_msg_label')}</div>
            <Textarea rows={2} value={message} onChange={e => setMessage(e.target.value)}
              placeholder={t('forms.invite_link_msg_ph')} />
          </div>

          {!linkUrl ? (
            <>
              {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
              <Button type="button" disabled={saving} onClick={generateLink}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
                <Link2 className="h-4 w-4" /> {saving ? t('forms.invite_generating') : t('forms.invite_generate_cta', { role: selectedLabel })}
              </Button>
              <p className="text-[11px] text-ink-muted text-center">
                {t('forms.invite_link_help', { role: selectedLabel })}
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-mint-700">{t('forms.invite_link_ready')}</div>
              <div className="rounded-xl bg-white border border-slate-200 p-2 text-xs font-mono text-ink-strong break-all">
                {linkUrl}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={copyLink} className="rounded-full bg-brand-500 hover:bg-brand-600">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('forms.invite_link_copied') : t('forms.invite_link_copy')}
                </Button>
                <Button type="button" onClick={shareLink} variant="secondary" className="rounded-full">
                  <Share2 className="h-4 w-4" /> {t('forms.invite_link_share')}
                </Button>
                <button type="button" onClick={() => { setLinkUrl(null); setEmail(''); setMessage(''); }}
                  className="text-xs text-ink-muted hover:text-ink-strong ml-auto self-center">
                  {t('forms.invite_link_generate_another')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

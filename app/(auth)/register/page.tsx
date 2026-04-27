'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/Wordmark';
import { Check } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { LanguageToggle } from '@/components/LanguageToggle';

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [ageOK, setAgeOK]     = useState(false);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!ageOK) { setErr(t('auth.register_age_18_required')); return; }
    if (!consent) { setErr(t('auth.register_consent_required')); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, consent_accepted_at: new Date().toISOString() } },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (!data.session) {
      setMsg(t('auth.register_check_email'));
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen flex relative">
      <div className="absolute top-4 right-4 z-30"><LanguageToggle /></div>
      {/* Left: warm beige/coral panel */}
      <section className="hidden lg:flex w-5/12 relative overflow-hidden bg-gradient-to-br from-peach-100 via-beige/50 to-coral-100">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 900" preserveAspectRatio="none" aria-hidden>
          <circle cx="400" cy="200" r="120" fill="#FFF" opacity="0.45" />
          <circle cx="80"  cy="700" r="160" fill="#FFF" opacity="0.4" />
          <circle cx="350" cy="780" r="60"  fill="#FFF" opacity="0.5" />
        </svg>
        <div className="relative p-12 flex flex-col justify-between w-full">
          <Link href="/" className="inline-block"><Wordmark size="md" /></Link>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight text-ink-strong">
              {t('auth.register_hero_title')}
            </h2>
            <p className="text-ink max-w-sm">
              {t('auth.register_hero_body')}
            </p>
            <ul className="space-y-2 text-ink text-sm">
              <PerkRow>{t('auth.register_perk_free')}</PerkRow>
              <PerkRow>{t('auth.register_perk_ocr')}</PerkRow>
              <PerkRow>{t('auth.register_perk_roles')}</PerkRow>
              <PerkRow>{t('auth.register_perk_reports')}</PerkRow>
            </ul>
          </div>

          <div className="text-xs text-ink-muted">{t('auth.register_hero_trust')}</div>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex-1 grid place-items-center px-4 py-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
          <h1 className="text-4xl font-bold tracking-tight text-ink-strong">{t('auth.register_title')}</h1>
          <p className="mt-2 text-ink">{t('auth.register_subtitle')}</p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <Field label={t('auth.register_your_name')}>
              <input required placeholder={t('auth.register_name_ph')} value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <Field label={t('auth.email')}>
              <input type="email" required placeholder={t('auth.email_ph')} value={email} onChange={e => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <Field label={t('auth.password')}>
              <input type="password" required minLength={8} placeholder={t('auth.register_password_ph')}
                value={password} onChange={e => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-ink cursor-pointer">
              <input type="checkbox" checked={ageOK} onChange={e => setAgeOK(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-coral-500" />
              <span>
                {t('auth.register_age_confirm_pre')}
                <strong>{t('auth.register_age_confirm_strong')}</strong>
                {t('auth.register_age_confirm_post')}
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs text-ink cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-coral-500" />
              <span>
                {t('auth.register_consent_pre')}
                <Link href="/privacy" target="_blank" className="text-brand-700 underline font-semibold">{t('auth.register_consent_privacy')}</Link>
                {t('auth.register_consent_sep1')}
                <Link href="/terms"   target="_blank" className="text-brand-700 underline font-semibold">{t('auth.register_consent_terms')}</Link>
                {t('auth.register_consent_and')}
                <Link href="/disclaimer" target="_blank" className="text-coral-700 underline font-semibold">{t('auth.register_consent_disclaimer')}</Link>
                {t('auth.register_consent_post')}
                <strong>{t('auth.register_consent_strong')}</strong>
                {t('auth.register_consent_tail')}
              </span>
            </label>

            {err && <p className="text-sm text-coral-600">{err}</p>}
            {msg && <p className="text-sm text-mint-700">{msg}</p>}
            <button type="submit" disabled={loading || !ageOK || !consent}
              className="w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm disabled:opacity-60">
              {loading ? t('auth.register_creating') : t('auth.register_create_cta')}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-muted text-center">
            {t('auth.register_have_account')}{' '}
            <Link href="/login" className="text-brand-600 font-semibold hover:underline">{t('auth.register_login_link')}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      {children}
    </div>
  );
}

function PerkRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 h-5 w-5 rounded-full bg-mint-500 text-white grid place-items-center shrink-0">
        <Check className="h-3 w-3" />
      </span>
      {children}
    </li>
  );
}

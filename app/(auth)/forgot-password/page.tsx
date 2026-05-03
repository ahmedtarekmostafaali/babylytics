'use client';

// Forgot-password — sends a Supabase password-reset email. The recipient
// link points to /reset-password where the new password is set. Same
// hero-shell layout as /login + /register so the visual language is
// consistent.

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/Wordmark';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useT } from '@/lib/i18n/client';
import { Mail, Check, ArrowLeft } from 'lucide-react';

function ForgotPasswordCard() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const supabase = createClient();
    // The redirect target must be on an allow-listed Supabase Auth URL.
    // Babylytics uses the deployed origin in prod and localhost in dev,
    // both already configured in Supabase Auth → URL Configuration.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    setLoading(false);
    // Always show "sent" on success or unknown email — Supabase intentionally
    // doesn't reveal whether the email exists, so we mirror that behaviour
    // in the UI to avoid accidental account enumeration.
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm">
        <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
        <div className="rounded-3xl border border-mint-200 bg-mint-50/60 p-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-mint-500 text-white grid place-items-center mb-3">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink-strong">Check your inbox</h1>
          <p className="mt-2 text-sm text-ink-muted">
            If an account exists for <span className="font-semibold text-ink-strong">{email}</span>,
            we sent a reset link. Open it on this device to set a new password.
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            The email may take a minute to arrive — check spam if you don&apos;t see it.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-strong">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
      <h1 className="text-4xl font-bold tracking-tight text-ink-strong">Forgot password?</h1>
      <p className="mt-2 text-ink">No problem — enter your email and we&apos;ll send you a reset link.</p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('auth.email')}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <input type="email" required autoComplete="email" placeholder={t('auth.email_ph')}
              value={email} onChange={e => setEmail(e.target.value)}
              className="h-12 w-full rounded-2xl bg-white border border-slate-200 pl-9 pr-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          </div>
        </div>
        {err && <p className="text-sm text-coral-600">{err}</p>}
        <button type="submit" disabled={loading || !email}
          className="w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm disabled:opacity-60">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted text-center">
        Remembered it?{' '}
        <Link href="/login" className="text-coral-600 font-semibold hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen flex relative">
      <div className="absolute top-4 right-4 z-30"><LanguageToggle /></div>
      <section className="hidden lg:flex w-5/12 relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-lavender-500">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 900" preserveAspectRatio="none" aria-hidden>
          <circle cx="100" cy="150" r="120" fill="#FFF" opacity="0.08" />
          <circle cx="420" cy="720" r="180" fill="#FFF" opacity="0.08" />
          <circle cx="60"  cy="720" r="60"  fill="#FFF" opacity="0.12" />
        </svg>
        <div className="relative z-10 flex flex-col justify-between text-white p-12 w-full">
          <Wordmark size="md" />
          <div>
            <h2 className="text-3xl font-bold leading-tight">A fresh start in two minutes.</h2>
            <p className="mt-3 text-white/80">Enter your email, click the link, set a new password. That&apos;s it.</p>
          </div>
          <div className="text-xs text-white/70">© Babylytics</div>
        </div>
      </section>
      <section className="flex-1 grid place-items-center px-6 py-10 lg:py-16">
        <ForgotPasswordCard />
      </section>
    </main>
  );
}

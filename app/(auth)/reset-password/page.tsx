'use client';

// Reset-password — destination of the email link from /forgot-password.
// Supabase ships the recovery token in the URL hash (#access_token=…)
// and the SDK auto-detects it on page load, putting the user into a
// transient PASSWORD_RECOVERY session. From there we can call
// supabase.auth.updateUser({ password }) to set the new password.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/Wordmark';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Lock, Check, ArrowLeft } from 'lucide-react';

function ResetPasswordCard() {
  const router = useRouter();
  const [recoveryReady, setRecoveryReady] = useState<'pending' | 'ok' | 'invalid'>('pending');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  // Subscribe to PASSWORD_RECOVERY auth state so we know when the SDK has
  // consumed the URL hash. If a user lands here without a valid token
  // (e.g. expired link, manual URL paste) we show an error.
  useEffect(() => {
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryReady('ok');
    });
    // Also check the current session in case the recovery event already
    // fired before the listener attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady('ok');
      else setTimeout(() => {
        // Give the SDK a moment to parse the hash; if still no session,
        // mark invalid so the user knows the link didn't work.
        setRecoveryReady(s => s === 'pending' ? 'invalid' : s);
      }, 800);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setErr('Passwords don\'t match.'); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    // Auto-route to dashboard after a short delay so the success state
    // is visible before redirect.
    setTimeout(() => { router.push('/dashboard'); router.refresh(); }, 1500);
  }

  if (done) {
    return (
      <div className="w-full max-w-sm">
        <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
        <div className="rounded-3xl border border-mint-200 bg-mint-50/60 p-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-mint-500 text-white grid place-items-center mb-3">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink-strong">Password updated</h1>
          <p className="mt-2 text-sm text-ink-muted">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  if (recoveryReady === 'invalid') {
    return (
      <div className="w-full max-w-sm">
        <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
        <h1 className="text-2xl font-bold text-ink-strong">Reset link expired</h1>
        <p className="mt-2 text-sm text-ink-muted">
          This recovery link is no longer valid — they expire after a short time
          for security. Request a new one and try again.
        </p>
        <Link href="/forgot-password"
          className="mt-5 inline-flex items-center justify-center w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm">
          Send new link
        </Link>
        <div className="mt-4 text-center">
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
      <h1 className="text-4xl font-bold tracking-tight text-ink-strong">Set a new password</h1>
      <p className="mt-2 text-ink">Pick something at least 8 characters. We&apos;ll sign you in after.</p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">New password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <input type="password" required minLength={8} autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)}
              disabled={recoveryReady !== 'ok'}
              className="h-12 w-full rounded-2xl bg-white border border-slate-200 pl-9 pr-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Confirm new password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
            <input type="password" required minLength={8} autoComplete="new-password"
              value={confirm} onChange={e => setConfirm(e.target.value)}
              disabled={recoveryReady !== 'ok'}
              className="h-12 w-full rounded-2xl bg-white border border-slate-200 pl-9 pr-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50" />
          </div>
        </div>
        {err && <p className="text-sm text-coral-600">{err}</p>}
        {recoveryReady === 'pending' && (
          <p className="text-sm text-ink-muted">Verifying reset link…</p>
        )}
        <button type="submit" disabled={loading || recoveryReady !== 'ok' || !password || !confirm}
          className="w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm disabled:opacity-60">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted text-center">
        <Link href="/login" className="text-coral-600 font-semibold hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
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
          <Wordmark size="md" variant="light" />
          <div>
            <h2 className="text-3xl font-bold leading-tight">Almost there.</h2>
            <p className="mt-3 text-white/80">Pick a new password and you&apos;re back in.</p>
          </div>
          <div className="text-xs text-white/70">© Babylytics</div>
        </div>
      </section>
      <section className="flex-1 grid place-items-center px-6 py-10 lg:py-16">
        <ResetPasswordCard />
      </section>
    </main>
  );
}

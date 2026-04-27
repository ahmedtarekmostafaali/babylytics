'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/Wordmark';
import { Heart, Milk, Moon, Baby, Scale } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

function LoginForm() {
  const router = useRouter();
  const t = useT();
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm">
      <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
      <h1 className="text-4xl font-bold tracking-tight text-ink-strong">{t('auth.login_welcome')}</h1>
      <p className="mt-2 text-ink">{t('auth.login_subtitle')}</p>

      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('auth.email')}</label>
          <input type="email" required autoComplete="email" placeholder={t('auth.email_ph')}
            value={email} onChange={e => setEmail(e.target.value)}
            className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">{t('auth.password')}</label>
          <input type="password" required autoComplete="current-password" placeholder={t('auth.password_ph')}
            value={password} onChange={e => setPassword(e.target.value)}
            className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
        </div>
        {err && <p className="text-sm text-coral-600">{err}</p>}
        <button type="submit" disabled={loading}
          className="w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm disabled:opacity-60">
          {loading ? t('auth.login_signing_in') : t('auth.login_cta')}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted text-center">
        {t('auth.login_no_account')}{' '}
        <Link href="/register" className="text-coral-600 font-semibold hover:underline">{t('auth.login_sign_up_link')}</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const t = useT();
  return (
    <main className="min-h-screen flex">
      {/* Left: full-color hero panel (desktop) */}
      <section className="hidden lg:flex w-5/12 relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-lavender-500">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 900" preserveAspectRatio="none" aria-hidden>
          <circle cx="100" cy="150" r="120" fill="#FFF" opacity="0.08" />
          <circle cx="420" cy="720" r="180" fill="#FFF" opacity="0.08" />
          <circle cx="60"  cy="720" r="60"  fill="#FFF" opacity="0.12" />
        </svg>
        <div className="relative p-12 flex flex-col justify-between w-full">
          <Link href="/" className="inline-block">
            <span dir="ltr" className="flex items-center gap-2 text-white text-xl font-bold">
              <img src="/Logo.png" alt="" className="h-8 w-8 rounded-md object-cover" />
              Babylytics
            </span>
          </Link>

          <div className="text-white space-y-6">
            {/* Stacked illustrated pill badges */}
            <div className="flex flex-wrap gap-3">
              <Badge icon={Milk}  label={t('auth.hero_badge_feedings')} />
              <Badge icon={Moon}  label={t('auth.hero_badge_sleep')} />
              <Badge icon={Baby}  label={t('auth.hero_badge_diaper')} />
              <Badge icon={Scale} label={t('auth.hero_badge_growth')} />
              <Badge icon={Heart} label={t('auth.hero_badge_health')} />
            </div>
            <h2 className="text-4xl font-bold leading-tight">{t('auth.hero_track_today')}<br />{t('auth.hero_nurture_tomorrow')}</h2>
            <p className="text-white/80 max-w-sm">
              {t('auth.hero_welcome_back')}
            </p>
          </div>

          <div className="text-xs text-white/60">
            {t('auth.hero_made_with_love')}
          </div>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex-1 grid place-items-center px-4 py-12 bg-white">
        <Suspense fallback={<div className="text-sm text-ink-muted">{t('auth.loading')}</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}

function Badge({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 px-3 py-1 text-xs font-medium border border-white/20">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

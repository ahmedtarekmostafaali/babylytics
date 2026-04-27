'use client';

// Social-sign-in button row. Drops onto the login + register pages
// above the email/password form. Each button calls
// supabase.auth.signInWithOAuth({ provider }) which returns a redirect
// URL — Supabase ferries the user to Google / Apple / Facebook,
// receives the OAuth code back, and bounces them to our callback at
// /auth/callback (handled by app/auth/callback/route.ts) which
// finalises the session.
//
// The `next` query param flows through so a user who opened
// /login?next=/babies/X gets back to that page after auth.
//
// Providers must be enabled in the Supabase dashboard
// (Authentication → Providers) with the platform's OAuth credentials
// before these buttons work.

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

type Provider = 'google' | 'apple' | 'facebook';

// Per-provider activation flag. Flip to `true` once the provider has
// been enabled in Supabase Authentication → Providers (with valid
// OAuth credentials) and the redirect URLs whitelisted in
// Authentication → URL Configuration. Until then the button renders
// with a "Coming soon" pill and is non-interactive.
const PROVIDER_ENABLED: Record<Provider, boolean> = {
  google:   false,
  apple:    false,
  facebook: false,
};

export function SocialAuthButtons({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const t = useT();
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [loading, setLoading] = useState<Provider | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function signInWith(provider: Provider) {
    if (!PROVIDER_ENABLED[provider]) return;
    setErr(null); setLoading(provider);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        // Apple requires the `name email` scopes on first connect.
        scopes: provider === 'apple' ? 'name email' : undefined,
      },
    });
    if (error) { setErr(error.message); setLoading(null); }
    // On success, Supabase navigates the browser to the provider — no
    // need to clear loading state, the page is leaving.
  }

  return (
    <div className="space-y-2.5">
      <SocialButton provider="google"
        active={PROVIDER_ENABLED.google}
        loading={loading === 'google'}
        disabled={loading !== null}
        onClick={() => signInWith('google')}
        label={mode === 'register' ? t('auth.social_register_google') : t('auth.social_login_google')}
        comingSoonLabel={t('auth.social_coming_soon')}
        glyph={<GoogleGlyph />}
        styleClasses="bg-white border border-slate-200 text-ink hover:bg-slate-50"
      />
      <SocialButton provider="apple"
        active={PROVIDER_ENABLED.apple}
        loading={loading === 'apple'}
        disabled={loading !== null}
        onClick={() => signInWith('apple')}
        label={mode === 'register' ? t('auth.social_register_apple') : t('auth.social_login_apple')}
        comingSoonLabel={t('auth.social_coming_soon')}
        glyph={<AppleGlyph />}
        styleClasses="bg-black text-white hover:bg-neutral-800"
      />
      <SocialButton provider="facebook"
        active={PROVIDER_ENABLED.facebook}
        loading={loading === 'facebook'}
        disabled={loading !== null}
        onClick={() => signInWith('facebook')}
        label={mode === 'register' ? t('auth.social_register_facebook') : t('auth.social_login_facebook')}
        comingSoonLabel={t('auth.social_coming_soon')}
        glyph={<FacebookGlyph />}
        styleClasses="bg-[#1877F2] text-white hover:bg-[#0E60D8]"
      />

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      {/* "or" divider before the email/password form */}
      <div className="flex items-center gap-3 pt-2">
        <span className="flex-1 h-px bg-slate-200" />
        <span className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">{t('auth.social_divider')}</span>
        <span className="flex-1 h-px bg-slate-200" />
      </div>
    </div>
  );
}

function SocialButton({
  active, loading, disabled, onClick, label, comingSoonLabel, glyph, styleClasses,
}: {
  provider: Provider;
  active: boolean;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  comingSoonLabel: string;
  glyph: React.ReactNode;
  styleClasses: string;
}) {
  // When the provider isn't enabled in Supabase yet we render the
  // button non-interactive with a small "Coming soon" pill on the
  // right. Visual style is preserved (full color + glyph) so users
  // see what's on the way and can recognise the providers.
  const inactive = !active;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || inactive}
      aria-disabled={inactive}
      title={inactive ? comingSoonLabel : undefined}
      className={`relative w-full h-12 inline-flex items-center justify-center gap-3 rounded-2xl font-semibold shadow-sm ${styleClasses} ${inactive ? 'opacity-70 cursor-not-allowed' : ''} ${disabled && !inactive ? 'opacity-60' : ''}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : glyph}
      <span>{label}</span>
      {inactive && (
        <span className="ms-2 inline-flex items-center rounded-full bg-white/95 text-ink-strong text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-slate-200">
          {comingSoonLabel}
        </span>
      )}
    </button>
  );
}

// ---- Provider glyphs ------------------------------------------------------
// Inline SVGs so we don't ship icon dependencies for these three.

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5c-2 1.5-4.6 2.5-7.6 2.5-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.5 39.5 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2.1-2 3.9-3.7 5.2l6.5 5.5c-.5.4 6.9-5 6.9-14.7 0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="currentColor" d="M16.365 1.43c0 1.14-.46 2.236-1.21 3.014-.79.815-2.06 1.443-3.103 1.36-.13-1.115.42-2.262 1.135-2.973.81-.812 2.156-1.44 3.178-1.4zM21.5 17.55c-.55 1.27-.81 1.84-1.52 2.97-1 1.58-2.4 3.55-4.13 3.56-1.54.01-1.94-1-4.03-.99-2.09.01-2.53 1-4.07.99-1.73-.01-3.06-1.78-4.06-3.36C1.49 17.62.97 12.13 3.13 9.13 4.62 7 6.94 5.74 9.07 5.74c2.13 0 3.43 1.16 5.18 1.16 1.7 0 2.74-1.16 5.16-1.16 1.86 0 3.83.99 5.21 2.71-4.55 2.51-3.81 9.05.88 9.1z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="currentColor" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.408c0-3.014 1.792-4.677 4.533-4.677 1.313 0 2.687.235 2.687.235v2.96h-1.514c-1.491 0-1.956.93-1.956 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.099 24 12.073z" />
    </svg>
  );
}

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { loadUserPrefs } from '@/lib/user-prefs';
import { I18nProvider } from '@/lib/i18n/client';
import { isRtl, type Lang } from '@/lib/i18n';

export const metadata: Metadata = {
  title: {
    default: 'Babylytics — baby health tracking',
    template: '%s · Babylytics',
  },
  description: 'Track feedings, stools, medications, growth and medical records with built-in OCR review.',
  icons: {
    icon: [
      { url: '/Logo.png', type: 'image/png' },
    ],
    apple: '/Logo.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Load the signed-in user's preferences server-side so SSR matches the
  // client. For guests we still want a way to flip the language on the
  // marketing/auth pages — the LanguageToggle component writes a `lang`
  // cookie and reloads. The signed-in user's stored preference always wins
  // over the cookie so the toggle on the home page can't override their
  // permanent choice.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const prefs = await loadUserPrefs(supabase);
  // Signed-in: their saved pref wins. Guest: fall back to the lang cookie set
  // by the LanguageToggle on the marketing/auth pages.
  const cookieLang = cookies().get('lang')?.value;
  const guestLang: Lang = cookieLang === 'ar' ? 'ar' : 'en';
  const lang: Lang = user ? prefs.language : guestLang;
  const dir = isRtl(lang) ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir}>
      <body className="font-sans min-h-full antialiased">
        <I18nProvider lang={lang}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}

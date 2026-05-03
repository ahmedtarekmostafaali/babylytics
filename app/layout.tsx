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
  // 050 batch: theme. 'system' is resolved client-side via the inline
  // boot script below — for SSR we emit no .dark class and let the script
  // add it before paint to avoid the wrong-theme flash.
  const theme = user ? prefs.theme : 'system';
  const initialDarkAttr = theme === 'dark' ? 'dark' : '';

  return (
    <html lang={lang} dir={dir} className={initialDarkAttr}>
      <head>
        {/* Pre-paint theme resolver. Reads the user's pref (passed via the
            html.className on SSR for explicit dark, otherwise blank), then
            consults prefers-color-scheme for 'system'. Inline so the user
            never sees a light flash before the dark theme kicks in. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function () {
            try {
              var t = ${JSON.stringify(theme)};
              var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              document.documentElement.classList.toggle('dark', dark);
            } catch (e) {}
          })();
        `}} />
      </head>
      <body className="font-sans min-h-full antialiased">
        <I18nProvider lang={lang}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}

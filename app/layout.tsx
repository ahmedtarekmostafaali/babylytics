import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { createClient } from '@/lib/supabase/server';
import { loadUserPrefs } from '@/lib/user-prefs';
import { I18nProvider } from '@/lib/i18n/client';
import { isRtl } from '@/lib/i18n';

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
  // client. Falls back to English / Egypt defaults for guests and for users
  // who haven't visited /preferences yet.
  const supabase = createClient();
  const prefs = await loadUserPrefs(supabase);
  const dir = isRtl(prefs.language) ? 'rtl' : 'ltr';

  return (
    <html lang={prefs.language} dir={dir}>
      <body className="font-sans min-h-full antialiased">
        <I18nProvider lang={prefs.language}>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}

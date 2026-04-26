'use client';

// React provider + useT() hook. The server lays down a cookie + initial lang
// (so SSR matches), and the provider hydrates client-side reads.

import { createContext, useContext, useEffect, useMemo } from 'react';
import { tFor, type Lang, isRtl } from './index';

type Ctx = {
  lang: Lang;
  t: ReturnType<typeof tFor>;
  isRtl: boolean;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ lang, t: tFor(lang), isRtl: isRtl(lang) }), [lang]);

  // Sync <html dir> + <html lang> so RTL flips correctly. We do this from the
  // client because the server template can't read user prefs without an extra
  // round-trip on every request.
  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = isRtl(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const v = useContext(I18nContext);
  if (!v) {
    // Fallback for components rendered outside the provider — e.g. while the
    // tree warms up. Default to English so layout doesn't break.
    return { lang: 'en', t: tFor('en'), isRtl: false };
  }
  return v;
}

export function useT() {
  return useI18n().t;
}

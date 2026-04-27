'use client';

import { useEffect, useState } from 'react';

/**
 * Pre-login language toggle for the marketing landing + auth pages. Writes a
 * `lang` cookie that the root layout reads server-side on the next request,
 * then reloads so the SSR-rendered text comes back in the chosen language.
 *
 * Signed-in users have their saved preference applied at the layout level so
 * this toggle won't override their permanent choice — it only matters for
 * guests visiting `/`, `/login`, `/register`.
 */
export function LanguageToggle({ className = '' }: { className?: string }) {
  const [current, setCurrent] = useState<'en' | 'ar'>('en');

  useEffect(() => {
    // Read the current cookie so the toggle reflects the active language.
    const m = document.cookie.match(/(?:^|;\s*)lang=(en|ar)/);
    if (m && (m[1] === 'en' || m[1] === 'ar')) setCurrent(m[1]);
  }, []);

  function pick(lang: 'en' | 'ar') {
    if (lang === current) return;
    // 1-year cookie, same-site so it isn't sent to third parties.
    document.cookie = `lang=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // Full reload — the layout reads cookies server-side, so SSR + dir attr
    // need to be regenerated. router.refresh() doesn't refresh the layout's
    // initial cookie read.
    window.location.reload();
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white shadow-sm overflow-hidden text-xs font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => pick('en')}
        className={`px-3 py-1.5 transition ${current === 'en' ? 'bg-coral-500 text-white' : 'text-ink hover:bg-slate-50'}`}
        aria-pressed={current === 'en'}
      >
        EN
      </button>
      <span className="w-px self-stretch bg-slate-200" />
      <button
        type="button"
        onClick={() => pick('ar')}
        className={`px-3 py-1.5 transition ${current === 'ar' ? 'bg-coral-500 text-white' : 'text-ink hover:bg-slate-50'}`}
        aria-pressed={current === 'ar'}
        dir="rtl"
      >
        ع
      </button>
    </div>
  );
}

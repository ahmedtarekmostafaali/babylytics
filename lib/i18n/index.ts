// Public i18n surface. Server side: `tFor(lang)` returns a sync `t()` function
// scoped to a language. Client side: use the <I18nProvider> + `useT()` hook
// from ./client.
import { en, type Messages } from './messages.en';
import { ar } from './messages.ar';

export type Lang = 'en' | 'ar';

export const DICTIONARIES: Record<Lang, Messages> = { en, ar };

export const RTL_LANGS: Lang[] = ['ar'];

export function isRtl(lang: Lang): boolean {
  return RTL_LANGS.includes(lang);
}

/** Dotted-path lookup with safe fallback to the key itself. */
export function lookup(messages: Messages, path: string): string {
  const segs = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = messages;
  for (const s of segs) {
    if (cur == null) return path;
    cur = cur[s];
  }
  return typeof cur === 'string' ? cur : path;
}

/** Server-side translator for a given language. */
export function tFor(lang: Lang) {
  const dict = DICTIONARIES[lang] ?? en;
  return (path: string, vars?: Record<string, string | number>) => {
    let str = lookup(dict, path);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  };
}

export type TFunc = ReturnType<typeof tFor>;

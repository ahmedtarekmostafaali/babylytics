import Link from 'next/link';
import { Filter } from 'lucide-react';

/**
 * Server-rendered category filter bar. Shows "All" plus one chip per option.
 * Clicking a chip writes a new URL with ?type=<slug>[,<slug>…] and triggers
 * the server component to re-run the query with the new filter applied.
 *
 *  - Multi-select: clicking a chip toggles it in/out of the active set.
 *  - Single-select mode: pass `mode="single"` to behave like a radio group.
 *  - An empty `activeKeys` array means "show all".
 *
 * The parent page is responsible for reading the `type` param, splitting it
 * on commas, and applying `.in(<column>, activeKeys)` to its Supabase query.
 */
export type FilterOption = {
  key: string;
  label: string;
};

export function LogTypeFilter({
  label, options, activeKeys, baseHref, extraParams, mode = 'multi',
}: {
  label: string;
  options: FilterOption[];
  activeKeys: string[];
  /** Base path, e.g. "/babies/xyz/stool" */
  baseHref: string;
  /** Extra query params to preserve, e.g. { range: '7d' } */
  extraParams?: Record<string, string | undefined>;
  mode?: 'multi' | 'single';
}) {
  const typeActive = activeKeys.length > 0 && activeKeys.length < options.length;

  function hrefFor(next: string[] | null) {
    const q = new URLSearchParams();
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) q.set(k, v);
      }
    }
    if (next && next.length > 0) q.set('type', next.join(','));
    const qs = q.toString();
    return qs ? `${baseHref}?${qs}` : baseHref;
  }

  function toggle(k: string): string[] | null {
    if (mode === 'single') return activeKeys.includes(k) ? null : [k];
    const has = activeKeys.includes(k);
    const next = has ? activeKeys.filter(x => x !== k) : [...activeKeys, k];
    return next.length === 0 ? null : next;
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 p-1 shadow-sm flex-wrap max-w-full">
      <span className="px-2 py-1.5 text-xs font-semibold text-ink-muted inline-flex items-center gap-1">
        <Filter className="h-3 w-3" /> {label}
      </span>
      <Chip href={hrefFor(null)} label="All" active={!typeActive} />
      {options.map(o => (
        <Chip key={o.key}
          href={hrefFor(toggle(o.key))}
          label={o.label}
          active={activeKeys.includes(o.key)} />
      ))}
    </div>
  );
}

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
        active ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-slate-50'
      }`}>
      {label}
    </Link>
  );
}

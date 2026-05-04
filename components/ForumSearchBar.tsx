'use client';

// ForumSearchBar — Wave 29. A small search input that submits to
// /forum/search?q=...&cat=... so the results page is bookmark-able and
// shareable. Renders at the top of the forum index (cat unset = global
// scope) and inside each category page (cat = that slug = scoped).

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function ForumSearchBar({
  categorySlug, lang = 'en', initialQuery = '',
}: {
  /** When set, search is scoped to one category. When omitted, global. */
  categorySlug?: string;
  lang?: 'en' | 'ar';
  initialQuery?: string;
}) {
  const router = useRouter();
  const isAr   = lang === 'ar';
  const [q, setQ] = useState(initialQuery);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const params = new URLSearchParams({ q: trimmed });
    if (categorySlug) params.set('cat', categorySlug);
    router.push(`/forum/search?${params.toString()}`);
  }

  return (
    <form onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white shadow-card px-4 py-2 hover:border-coral-300 focus-within:border-coral-500 transition">
      <Search className="h-4 w-4 text-ink-muted shrink-0" />
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={categorySlug
          ? (isAr ? 'ابحثي في هذا القسم…' : 'Search this category…')
          : (isAr ? 'ابحثي في كل المنتدى…' : 'Search the forum…')}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-ink placeholder:text-ink-muted"
      />
      {q.trim().length >= 2 && (
        <button type="submit"
          className="text-xs font-semibold text-coral-700 hover:text-coral-800 shrink-0">
          {isAr ? 'بحث' : 'Search'}
        </button>
      )}
    </form>
  );
}

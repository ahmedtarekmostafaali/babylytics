import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { ForumSearchBar } from '@/components/ForumSearchBar';
import { fmtRelative } from '@/lib/dates';
import { MessageCircle, Search } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search the forum' };

interface SearchRow {
  thread_id:         string;
  category_slug:     string;
  category_title_en: string;
  category_title_ar: string;
  title:             string;
  snippet:           string;
  reply_count:       number;
  last_reply_at:     string;
  matched_in:        'thread' | 'reply' | 'both';
  rank:              number;
}

export default async function ForumSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const q   = (searchParams.q ?? '').trim();
  const cat = (searchParams.cat ?? '').trim() || null;

  // Resolve the scoped-category metadata for the page header.
  const { data: catRow } = cat
    ? await supabase.from('forum_categories')
        .select('slug,title_en,title_ar').eq('slug', cat).maybeSingle()
    : { data: null as { slug: string; title_en: string; title_ar: string } | null };

  let results: SearchRow[] = [];
  if (q.length >= 2) {
    const { data } = await supabase.rpc('search_forum', {
      p_query:         q,
      p_category_slug: cat,
      p_limit:         30,
    });
    results = (data ?? []) as SearchRow[];
  }

  const scopeLabel = catRow
    ? (isAr ? catRow.title_ar : catRow.title_en)
    : (isAr ? 'كل المنتدى' : 'whole forum');

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={catRow ? `/forum/${catRow.slug}` : '/forum'}
        backLabel={catRow ? (isAr ? catRow.title_ar : catRow.title_en) : (isAr ? 'المنتدى' : 'Forum')}
        eyebrow={isAr ? 'بحث' : 'SEARCH'} eyebrowTint="brand"
        title={q ? `"${q}"` : (isAr ? 'ابحثي في المنتدى' : 'Search the forum')}
        subtitle={q
          ? (isAr
              ? `${results.length} نتيجة في ${scopeLabel}`
              : `${results.length} result${results.length === 1 ? '' : 's'} in ${scopeLabel}`)
          : (isAr
              ? 'اكتبي كلمة في الشريط أدناه للبدء.'
              : 'Type a word in the bar below to start.')}
      />

      <ForumSearchBar
        categorySlug={cat ?? undefined}
        lang={userPrefs.language}
        initialQuery={q}
      />

      {q.length < 2 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
          <Search className="h-6 w-6 mx-auto mb-2 text-ink-muted" />
          {isAr
            ? 'اكتبي كلمتين على الأقل لتبدأ النتائج بالظهور.'
            : 'Type at least two characters to see results.'}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
          {isAr
            ? `لا توجد نتائج لـ "${q}" في ${scopeLabel}. جرّبي كلمات مختلفة أو وسّعي البحث للكل.`
            : `No results for "${q}" in ${scopeLabel}. Try different words or widen to the whole forum.`}
          {cat && (
            <div className="mt-3">
              <Link href={`/forum/search?q=${encodeURIComponent(q)}`}
                className="text-xs font-semibold text-coral-700 hover:text-coral-800">
                {isAr ? 'وسّعي البحث للمنتدى كله' : 'Search the whole forum instead'}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {results.map(r => (
            <li key={r.thread_id}>
              <Link href={`/forum/${r.category_slug}/${r.thread_id}`}
                className="block rounded-2xl border border-slate-200 bg-white hover:border-coral-300 hover:shadow-card transition p-4">
                <div className="flex items-center gap-2 text-[11px] text-ink-muted mb-1.5 flex-wrap">
                  <span className="rounded-full bg-slate-100 text-ink font-semibold px-2 py-0.5">
                    {isAr ? r.category_title_ar : r.category_title_en}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {r.reply_count}
                  </span>
                  <span>·</span>
                  <span>{fmtRelative(r.last_reply_at)}</span>
                  {r.matched_in === 'reply' && (
                    <span className="ms-auto rounded-full bg-lavender-100 text-lavender-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                      {isAr ? 'في رد' : 'in reply'}
                    </span>
                  )}
                  {r.matched_in === 'both' && (
                    <span className="ms-auto rounded-full bg-coral-100 text-coral-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                      {isAr ? 'موضوع + رد' : 'thread + reply'}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-ink-strong">{r.title}</h3>
                {r.snippet && (
                  <p
                    className="mt-1.5 text-xs text-ink-muted leading-relaxed [&_mark]:bg-coral-100 [&_mark]:text-coral-800 [&_mark]:rounded [&_mark]:px-0.5 [&_mark]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: sanitiseSnippet(r.snippet) }}
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

/** Snippets come from ts_headline with explicit <mark> tags as the
 *  start/stop selector — but the underlying body could contain
 *  user-entered HTML. Strip every tag except <mark>…</mark> so the
 *  highlight survives and nothing else renders. */
function sanitiseSnippet(html: string): string {
  // Replace any <mark>/</mark> (case-insensitive) with sentinels, drop
  // everything else, restore the marks.
  const SENTINEL_OPEN  = 'MARK_OPEN';
  const SENTINEL_CLOSE = 'MARK_CLOSE';
  let s = html
    .replace(/<\s*mark\s*>/gi, SENTINEL_OPEN)
    .replace(/<\s*\/\s*mark\s*>/gi, SENTINEL_CLOSE)
    .replace(/<[^>]*>/g, '');
  // Re-encode any leftover & < > so they don't render as HTML.
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s.split(SENTINEL_OPEN).join('<mark>').split(SENTINEL_CLOSE).join('</mark>');
}

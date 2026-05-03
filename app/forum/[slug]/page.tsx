import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { fmtRelative } from '@/lib/dates';
import { MessageSquare, EyeOff } from 'lucide-react';
import { ForumThreadCompose } from '@/components/ForumThreadCompose';

export const dynamic = 'force-dynamic';

export default async function CategoryThreads({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const { data: cat } = await supabase
    .from('forum_categories')
    .select('id,slug,kind,title_en,title_ar,description_en,description_ar')
    .eq('slug', params.slug).maybeSingle();
  if (!cat) notFound();

  // Threads in this category, joined with author display via the view.
  const { data: threads } = await supabase
    .from('forum_thread_with_meta')
    .select('id,title,author_display,anonymous,created_at,last_reply_at,reply_count')
    .eq('category_id', cat.id)
    .order('last_reply_at', { ascending: false })
    .limit(60);

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref="/forum"
        backLabel={isAr ? 'المنتدى' : 'Forum'}
        eyebrow={isAr ? 'مجتمع' : 'COMMUNITY'} eyebrowTint="brand"
        title={isAr ? cat.title_ar : cat.title_en}
        subtitle={(isAr ? cat.description_ar : cat.description_en) ?? undefined}
      />

      <ForumThreadCompose categorySlug={cat.slug} lang={userPrefs.language} />

      {(threads ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
          {isAr ? 'لا توجد مواضيع بعد. كوني أول من يبدأ.' : 'No threads yet — be the first.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {(threads ?? []).map(t => (
            <li key={t.id}>
              <Link href={`/forum/${cat.slug}/${t.id}`}
                className="block hover:bg-slate-50 transition px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-ink-strong text-sm leading-tight">{t.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        {t.anonymous && <EyeOff className="h-3 w-3" />}
                        {t.author_display}
                      </span>
                      <span>·</span>
                      <span>{fmtRelative(t.created_at)}</span>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-ink-muted shrink-0 flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink font-semibold px-2 py-0.5">
                      <MessageSquare className="h-3 w-3" /> {t.reply_count}
                    </span>
                    <span>{fmtRelative(t.last_reply_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

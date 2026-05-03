import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { fmtRelative, fmtDateTime } from '@/lib/dates';
import { EyeOff } from 'lucide-react';
import { ForumReplyCompose } from '@/components/ForumReplyCompose';
import { ForumReportButton } from '@/components/ForumReportButton';

export const dynamic = 'force-dynamic';

export default async function ForumThreadPage({
  params,
}: {
  params: { slug: string; threadId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const [{ data: cat }, { data: thread }, { data: replies }] = await Promise.all([
    supabase.from('forum_categories').select('id,slug,title_en,title_ar')
      .eq('slug', params.slug).maybeSingle(),
    supabase.from('forum_thread_with_meta')
      .select('id,title,body,author_display,anonymous,created_at,edited_at,reply_count,author_id')
      .eq('id', params.threadId).maybeSingle(),
    supabase.from('forum_reply_with_meta')
      .select('id,body,author_display,anonymous,created_at,author_id')
      .eq('thread_id', params.threadId)
      .order('created_at', { ascending: true })
      .limit(500),
  ]);

  if (!cat || !thread) notFound();

  // Wave 19c: opening a thread clears any unread forum_reply notifications
  // for it. Server-side fire-and-forget — we don't await the promise of
  // the response since the visible state doesn't depend on it.
  void supabase.rpc('mark_thread_replies_read', { p_thread_id: thread.id });

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/forum/${cat.slug}`}
        backLabel={isAr ? cat.title_ar : cat.title_en}
        eyebrow={isAr ? 'موضوع' : 'THREAD'} eyebrowTint="brand"
        title={thread.title}
        subtitle={(isAr ? 'بدأه' : 'Started by') + ' ' + thread.author_display + ' · ' + fmtRelative(thread.created_at)}
      />

      {/* OP body */}
      <article className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1 font-semibold text-ink-strong">
            {thread.anonymous && <EyeOff className="h-3 w-3" />}
            {thread.author_display}
          </span>
          <span>·</span>
          <span title={fmtDateTime(thread.created_at)}>{fmtRelative(thread.created_at)}</span>
        </div>
        <p className="mt-3 text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
          {thread.body}
        </p>
        {/* Report button hidden when you're the author — you can't report
            yourself; deleting your own thread happens elsewhere. */}
        {thread.author_id !== user.id && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <ForumReportButton targetType="thread" targetId={thread.id} lang={userPrefs.language} />
          </div>
        )}
      </article>

      {/* Replies */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted px-1">
          {isAr ? `الردود (${replies?.length ?? 0})` : `Replies (${replies?.length ?? 0})`}
        </h3>
        {(replies ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-ink-muted">
            {isAr ? 'لا توجد ردود بعد. كوني أول من يرد.' : 'No replies yet — be the first.'}
          </div>
        ) : (
          (replies ?? []).map(r => (
            <article key={r.id}
              className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1 font-semibold text-ink-strong">
                  {r.anonymous && <EyeOff className="h-3 w-3" />}
                  {r.author_display}
                </span>
                <span>·</span>
                <span title={fmtDateTime(r.created_at)}>{fmtRelative(r.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
                {r.body}
              </p>
              {r.author_id !== user.id && (
                <div className="mt-2 flex justify-end">
                  <ForumReportButton targetType="reply" targetId={r.id} lang={userPrefs.language} />
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Compose */}
      <ForumReplyCompose threadId={thread.id} lang={userPrefs.language} />
    </PageShell>
  );
}

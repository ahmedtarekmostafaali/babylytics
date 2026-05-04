import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { fmtRelative, fmtDateTime } from '@/lib/dates';
import { EyeOff } from 'lucide-react';
import { ForumReplyCompose } from '@/components/ForumReplyCompose';
import { ForumReportButton } from '@/components/ForumReportButton';
import { ForumReactions, type ReactionKind } from '@/components/ForumReactions';
import { ForumSubscribeButton } from '@/components/ForumSubscribeButton';
import { ArchiveThreadButton } from '@/components/ArchiveThreadButton';
import { Lock } from 'lucide-react';

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
      .select('id,title,body,author_display,anonymous,created_at,edited_at,reply_count,author_id,reaction_counts,my_reactions,i_subscribe,archived_at')
      .eq('id', params.threadId).maybeSingle(),
    supabase.from('forum_reply_with_meta')
      .select('id,body,author_display,anonymous,created_at,author_id,reaction_counts,my_reactions')
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

        {/* Wave 24: reactions row. Wave 30: + Follow toggle on the
            right. Authors are auto-subscribed by trigger but can still
            mute their own thread by tapping "Following". */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 flex-wrap">
          <ForumReactions
            targetType="thread"
            targetId={thread.id}
            initialCounts={(thread.reaction_counts ?? {}) as Record<ReactionKind, number>}
            initialMine={(thread.my_reactions ?? []) as ReactionKind[]}
            lang={userPrefs.language}
          />
          <div className="ms-auto flex items-center gap-2 flex-wrap">
            <ForumSubscribeButton
              threadId={thread.id}
              initialSubscribed={Boolean((thread as { i_subscribe?: boolean }).i_subscribe)}
              lang={userPrefs.language}
            />
            {/* Wave 31c: Archive toggle — author only. Admins also have
                a separate path via /admin/forum-reports. */}
            {thread.author_id === user.id && (
              <ArchiveThreadButton
                threadId={thread.id}
                isArchived={Boolean((thread as { archived_at?: string | null }).archived_at)}
                lang={userPrefs.language}
              />
            )}
            {/* Report button hidden when you're the author — you can't
                report yourself; deleting your own thread happens elsewhere. */}
            {thread.author_id !== user.id && (
              <ForumReportButton targetType="thread" targetId={thread.id} lang={userPrefs.language} />
            )}
          </div>
        </div>
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
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-3 flex-wrap">
                <ForumReactions
                  targetType="reply"
                  targetId={r.id}
                  initialCounts={(r.reaction_counts ?? {}) as Record<ReactionKind, number>}
                  initialMine={(r.my_reactions ?? []) as ReactionKind[]}
                  lang={userPrefs.language}
                />
                {r.author_id !== user.id && (
                  <div className="ms-auto">
                    <ForumReportButton targetType="reply" targetId={r.id} lang={userPrefs.language} />
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {/* Compose — Wave 31c: replaced by a locked banner when archived. */}
      {(thread as { archived_at?: string | null }).archived_at ? (
        <div className="rounded-2xl border border-peach-200 bg-peach-50/60 p-4 flex items-start gap-3 text-sm text-ink">
          <span className="h-9 w-9 rounded-xl bg-peach-100 text-peach-700 grid place-items-center shrink-0">
            <Lock className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-strong">
              {isAr ? 'هذا الموضوع مؤرشف' : 'This thread is archived'}
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {isAr
                ? 'لا يمكن إضافة ردود جديدة. التفاعلات والبحث لا يزالان يعملان.'
                : 'No new replies can be posted. Reactions and search still work.'}
            </p>
          </div>
        </div>
      ) : (
        <ForumReplyCompose threadId={thread.id} lang={userPrefs.language} />
      )}
    </PageShell>
  );
}

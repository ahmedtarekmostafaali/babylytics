import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ForumReportRow } from '@/components/ForumReportRow';
import { Flag, Check } from 'lucide-react';
import { fmtRelative } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forum reports — admin' };

export default async function ForumReportsAdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS already gates the queue on is_platform_admin(), but bouncing
  // here gives a friendlier flow than rendering an empty list.
  const { data: ok } = await supabase.rpc('is_platform_admin');
  if (!ok) redirect('/dashboard');

  const { data: reports } = await supabase
    .from('forum_reports')
    .select('id,target_type,target_id,reported_by,reason,detail,created_at,resolved_at,resolution')
    .order('created_at', { ascending: false })
    .limit(200);

  const open     = (reports ?? []).filter(r => !r.resolved_at);
  const resolved = (reports ?? []).filter(r =>  r.resolved_at);

  // Resolve target previews — title for threads, body excerpt for replies.
  // Group ids by target_type and fetch in two queries.
  const threadIds = open.filter(r => r.target_type === 'thread').map(r => r.target_id);
  const replyIds  = open.filter(r => r.target_type === 'reply').map(r => r.target_id);

  const [{ data: threads }, { data: replies }] = await Promise.all([
    threadIds.length
      ? supabase.from('forum_threads')
          .select('id,title,body,author_id,category_id,deleted_at')
          .in('id', threadIds)
      : { data: [] as { id: string; title: string; body: string; author_id: string; category_id: string; deleted_at: string | null }[] },
    replyIds.length
      ? supabase.from('forum_replies')
          .select('id,body,author_id,thread_id,deleted_at')
          .in('id', replyIds)
      : { data: [] as { id: string; body: string; author_id: string; thread_id: string; deleted_at: string | null }[] },
  ]);

  // Map category id → slug for the "open in forum" link.
  const catIds = (threads ?? []).map(t => t.category_id);
  const { data: cats } = catIds.length
    ? await supabase.from('forum_categories').select('id,slug').in('id', catIds)
    : { data: [] as { id: string; slug: string }[] };
  const catSlugById = new Map((cats ?? []).map(c => [c.id, c.slug]));

  // For replies, look up their thread to get the category slug too.
  const replyThreadIds = (replies ?? []).map(r => r.thread_id);
  const { data: replyThreads } = replyThreadIds.length
    ? await supabase.from('forum_threads').select('id,category_id').in('id', replyThreadIds)
    : { data: [] as { id: string; category_id: string }[] };
  const threadCatById = new Map((replyThreads ?? []).map(t => [t.id, t.category_id]));

  // Resolve reporter display names.
  const reporterIds = (reports ?? []).map(r => r.reported_by);
  const { data: profiles } = reporterIds.length
    ? await supabase.from('profiles').select('id,display_name,email').in('id', reporterIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
  const profById = new Map((profiles ?? []).map(p => [p.id, p]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink-strong inline-flex items-center gap-2">
          <Flag className="h-5 w-5 text-coral-600" /> Forum reports
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {open.length} open · {resolved.length} resolved (recent 200)
        </p>
      </div>

      {/* Open queue */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Open queue</h2>
        {open.length === 0 ? (
          <div className="rounded-2xl border border-mint-200 bg-mint-50/50 p-6 text-center text-sm text-mint-800 inline-flex items-center gap-2">
            <Check className="h-4 w-4" /> All caught up — no open reports.
          </div>
        ) : (
          <ul className="space-y-3">
            {open.map(r => {
              const target = r.target_type === 'thread'
                ? (threads ?? []).find(t => t.id === r.target_id) ?? null
                : (replies ?? []).find(rep => rep.id === r.target_id) ?? null;
              const reporter = profById.get(r.reported_by);
              const slug = r.target_type === 'thread'
                ? (target ? catSlugById.get((target as { category_id: string }).category_id) : null)
                : (target ? catSlugById.get(threadCatById.get((target as { thread_id: string }).thread_id) ?? '') : null);
              const link = r.target_type === 'thread'
                ? slug ? `/forum/${slug}/${r.target_id}` : '/forum'
                : slug && target ? `/forum/${slug}/${(target as { thread_id: string }).thread_id}` : '/forum';
              return (
                <ForumReportRow
                  key={r.id}
                  report={r}
                  reporterLabel={reporter?.display_name?.trim() || reporter?.email?.split('@')[0] || r.reported_by.slice(0, 8)}
                  reporterCreatedAt={fmtRelative(r.created_at)}
                  targetType={r.target_type as 'thread' | 'reply'}
                  targetExcerpt={
                    target
                      ? (r.target_type === 'thread'
                        ? `${(target as { title: string }).title} — ${(target as { body: string }).body.slice(0, 200)}`
                        : (target as { body: string }).body.slice(0, 300))
                      : '(target deleted)'
                  }
                  targetDeleted={(target as { deleted_at: string | null } | null)?.deleted_at != null}
                  forumLink={link}
                />
              );
            })}
          </ul>
        )}
      </section>

      {/* Resolved (collapsed-ish — just a quick reference) */}
      {resolved.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Recently resolved</h2>
          <ul className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
            {resolved.slice(0, 30).map(r => (
              <li key={r.id} className="px-4 py-3 text-sm flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted px-2 py-0.5 rounded-full bg-slate-100">
                  {r.resolution ?? 'resolved'}
                </span>
                <span className="text-ink-muted">{r.target_type}</span>
                <span className="text-ink">{r.reason}</span>
                <span className="text-xs text-ink-muted ms-auto">{fmtRelative(r.resolved_at!)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-ink-muted">
        Need to add Forum to the admin nav? <Link href="/admin" className="underline">Back to /admin</Link>.
      </p>
    </div>
  );
}

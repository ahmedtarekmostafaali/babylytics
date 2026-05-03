'use client';

// ForumUnreadBanner — shown at the top of /forum when the user has
// unread forum_reply notifications. Each row deep-links into the
// thread; opening the thread auto-clears its notifications via the
// mark_thread_replies_read RPC (called from the server page on view),
// so this list shrinks naturally as you read.
//
// "Mark all read" button clears everything in one tap.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Check, Loader2 } from 'lucide-react';
import { fmtRelative } from '@/lib/dates';

export interface UnreadForumReply {
  id: string;
  thread_id: string;
  thread_title: string;
  thread_slug: string;     // category slug — server resolves this for the link
  is_op: boolean;          // true when caller is the original poster
  created_at: string;
}

export function ForumUnreadBanner({
  items, lang = 'en',
}: {
  items: UnreadForumReply[];
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const visible = items.filter(i => !hidden.has(i.id));

  if (visible.length === 0) return null;

  async function markAll() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc('mark_all_user_notifications_read');
    setBusy(false);
    setHidden(new Set(items.map(i => i.id)));
    start(() => router.refresh());
  }

  return (
    <section className="rounded-2xl border border-coral-200 bg-gradient-to-br from-coral-50 via-peach-50 to-mint-50 p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-coral-100 text-coral-700">
          <MessageSquare className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-ink-strong">
          {isAr
            ? `${visible.length} رد جديد على مواضيعك`
            : `${visible.length} new ${visible.length === 1 ? 'reply' : 'replies'} in your threads`}
        </h3>
        <button type="button" onClick={markAll} disabled={busy}
          className="ms-auto inline-flex items-center gap-1 text-[11px] font-semibold text-coral-700 hover:text-coral-800 disabled:opacity-50">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {isAr ? 'تعليم الكل كمقروء' : 'Mark all read'}
        </button>
      </div>
      <ul className="space-y-1">
        {visible.slice(0, 8).map(i => (
          <li key={i.id}>
            <Link href={`/forum/${i.thread_slug}/${i.thread_id}`}
              className="flex items-center gap-2 text-sm text-ink-strong hover:text-coral-700 group">
              <span className="text-coral-500 shrink-0">•</span>
              <span className="flex-1 min-w-0 truncate">
                {i.is_op
                  ? <strong className="font-semibold">{isAr ? 'في موضوعك:' : 'In your thread:'}</strong>
                  : null} {' '}
                {i.thread_title}
              </span>
              <span className="text-[10px] text-ink-muted shrink-0">{fmtRelative(i.created_at)}</span>
            </Link>
          </li>
        ))}
        {visible.length > 8 && (
          <li className="text-[11px] text-ink-muted pt-1">
            {isAr ? `+ ${visible.length - 8} غيرها` : `+ ${visible.length - 8} more`}
          </li>
        )}
      </ul>
    </section>
  );
}

'use client';

// ChatBell — quick-access shortcut to the per-profile chat from any page
// header. Visual peer of NotificationsBell. Shows an unread dot when any
// chat thread (group or direct) has messages newer than the caller's
// last-seen timestamp.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export function ChatBell({ babyId }: { babyId: string }) {
  const t = useT();
  const [unreadCount, setUnreadCount] = useState(0);

  // Best-effort unread count for direct threads. Group chat doesn't track
  // per-user last-seen yet (that's a follow-up table) so it's omitted.
  // Re-checks every 60s and on mount; realtime push is overkill for a
  // header dot.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Pull my participant rows for this baby's threads.
      const { data: parts } = await supabase
        .from('chat_thread_participants')
        .select('thread_id, last_read_at, chat_threads!inner(baby_id)')
        .eq('user_id', user.id);
      type Row = { thread_id: string; last_read_at: string; chat_threads: { baby_id: string } | null };
      const mine = ((parts ?? []) as unknown as Row[])
        .filter(r => r.chat_threads?.baby_id === babyId);
      if (mine.length === 0) {
        if (!cancelled) setUnreadCount(0);
        return;
      }

      // For each thread, count messages newer than my last_read_at.
      // Single batched query: the IN list scopes the work tightly; we
      // sum on the client.
      const ids = mine.map(m => m.thread_id);
      const { data: msgs } = await supabase
        .from('chat_thread_messages')
        .select('thread_id, created_at, user_id')
        .in('thread_id', ids)
        .is('deleted_at', null);
      let count = 0;
      const lastByThread = new Map(mine.map(m => [m.thread_id, m.last_read_at]));
      for (const msg of (msgs ?? [])) {
        if (msg.user_id === user.id) continue; // don't count my own posts
        const last = lastByThread.get(msg.thread_id);
        if (!last || new Date(msg.created_at) > new Date(last)) count++;
      }
      if (!cancelled) setUnreadCount(count);
    }
    check();
    const id = window.setInterval(check, 60000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [babyId]);

  return (
    <Link
      href={`/babies/${babyId}/chat`}
      aria-label={t('chat.aria_open') || 'Open chat'}
      className="relative h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm">
      <MessageCircle className={`h-4 w-4 ${unreadCount > 0 ? 'text-mint-600' : 'text-ink'}`} />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-mint-500 text-white text-[10px] grid place-items-center font-bold">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

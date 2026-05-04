'use client';

// ForumSubscribeButton — Wave 30. Tiny "Follow" / "Following" toggle
// at the top of a thread. Calls toggle_forum_subscription which
// returns the new state. Optimistic UI with rollback on error.
//
// The thread author + anyone who has replied is auto-subscribed via
// triggers, so this button mainly matters for two cases:
//   - Lurkers who want to follow without replying.
//   - Past repliers who want to mute a thread that's still active.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Bell, BellOff, Loader2 } from 'lucide-react';

export function ForumSubscribeButton({
  threadId, initialSubscribed, lang = 'en',
}: {
  threadId: string;
  initialSubscribed: boolean;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr   = lang === 'ar';
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const before = subscribed;
    setSubscribed(!before); // optimistic flip
    const supabase = createClient();
    const { data, error } = await supabase.rpc('toggle_forum_subscription', {
      p_thread_id: threadId,
    });
    if (error) {
      setSubscribed(before); // rollback
    } else if (typeof data === 'boolean') {
      setSubscribed(data);   // server-truth
    }
    setBusy(false);
    start(() => router.refresh());
  }

  return (
    <button type="button" onClick={toggle} disabled={busy}
      aria-pressed={subscribed}
      className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5 transition ${
        subscribed
          ? 'bg-coral-100 text-coral-700 ring-1 ring-coral-300 hover:bg-coral-200'
          : 'bg-slate-50 text-ink hover:bg-slate-100'
      } disabled:opacity-50`}>
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : subscribed
          ? <Bell    className="h-3.5 w-3.5" />
          : <BellOff className="h-3.5 w-3.5" />}
      {subscribed
        ? (isAr ? 'تتابعينه' : 'Following')
        : (isAr ? 'متابعة' : 'Follow')}
    </button>
  );
}

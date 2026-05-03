'use client';

// MarkAllRead — small "Mark all as read" button used on the dashboard's
// unread-notifications header. Calls the mark_all_notifications_read RPC
// added in 050, then refreshes the page so the panel disappears.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Check, Loader2, CheckCheck } from 'lucide-react';

export function MarkAllRead({ babyId, label = 'Mark all read' }: { babyId?: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone]  = useState(false);
  const [err,  setErr]   = useState<string | null>(null);

  function run() {
    setErr(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('mark_all_notifications_read', {
        p_baby: babyId ?? null,
      });
      if (error) { setErr(error.message); return; }
      setDone(true);
      setTimeout(() => setDone(false), 2000);
      router.refresh();
    });
  }

  return (
    <button type="button"
      onClick={run}
      disabled={pending || done}
      className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-[11px] font-semibold px-2.5 py-1 disabled:opacity-60"
      title={err ?? undefined}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" />
       : done ? <Check className="h-3 w-3 text-mint-600" />
       : <CheckCheck className="h-3 w-3" />}
      {done ? 'Cleared' : label}
    </button>
  );
}

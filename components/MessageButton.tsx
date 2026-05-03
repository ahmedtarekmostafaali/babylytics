'use client';

// MessageButton — opens (or creates) a direct chat thread with the given
// caregiver and routes to /babies/[id]/chat?thread=<id>. Used in the
// caregivers list per-row.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export function MessageButton({
  babyId, otherUserId, label, className,
}: {
  babyId: string;
  otherUserId: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    const supabase = createClient();
    const { data: threadId, error } = await supabase.rpc('start_or_get_direct_thread', {
      p_baby: babyId, p_other_user: otherUserId,
    });
    setBusy(false);
    if (error || !threadId) {
      window.alert(error?.message ?? t('chat.could_not_open'));
      return;
    }
    router.push(`/babies/${babyId}/chat?thread=${threadId}`);
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      title={t('chat.open_direct_title')}
      className={
        className
        ?? 'inline-flex items-center gap-1.5 rounded-full border border-lavender-200 bg-lavender-50/60 hover:bg-lavender-100 text-lavender-700 text-xs font-semibold px-3 py-1.5'
      }>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
      {label ?? t('chat.message_btn')}
    </button>
  );
}

'use client';

// ArchiveThreadButton — Wave 31c. Author-only (or admin) button on
// the thread page that toggles archived state via the
// archive_forum_thread RPC. Archiving locks the thread from new
// replies; existing reactions, search results, and subscriptions all
// stay live. Unarchive is the same button when archived.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Lock, Unlock, Loader2 } from 'lucide-react';

export function ArchiveThreadButton({
  threadId, isArchived, lang = 'en',
}: {
  threadId: string;
  isArchived: boolean;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [archived, setArchived] = useState(isArchived);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function toggle() {
    if (busy) return;
    if (!archived) {
      const ok = window.confirm(isAr
        ? 'هل تريدين أرشفة هذا الموضوع؟ لن يتمكن أحد من الرد عليه. التفاعلات والبحث يستمران.'
        : 'Archive this thread? No one will be able to reply. Reactions and search keep working.');
      if (!ok) return;
    }
    setBusy(true);
    const before = archived;
    setArchived(!before); // optimistic
    const supabase = createClient();
    const { data, error } = await supabase.rpc('archive_forum_thread', {
      p_thread_id: threadId,
      p_unarchive: before,
    });
    if (error) {
      setArchived(before); // rollback
    } else if (typeof data === 'boolean') {
      setArchived(data);
    }
    setBusy(false);
    start(() => router.refresh());
  }

  return (
    <button type="button" onClick={toggle} disabled={busy}
      aria-pressed={archived}
      title={archived
        ? (isAr ? 'إلغاء الأرشفة' : 'Unarchive')
        : (isAr ? 'أرشفة الموضوع' : 'Archive thread')}
      className={`inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-3 py-1.5 transition ${
        archived
          ? 'bg-peach-100 text-peach-700 ring-1 ring-peach-300 hover:bg-peach-200'
          : 'bg-slate-50 text-ink hover:bg-slate-100'
      } disabled:opacity-50`}>
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : archived
          ? <Unlock className="h-3.5 w-3.5" />
          : <Lock   className="h-3.5 w-3.5" />}
      {archived
        ? (isAr ? 'مؤرشف' : 'Archived')
        : (isAr ? 'أرشفة' : 'Archive')}
    </button>
  );
}

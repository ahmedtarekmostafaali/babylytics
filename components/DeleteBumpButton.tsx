'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Loader2 } from 'lucide-react';

export function DeleteBumpButton({ id, lang = 'en' }: { id: string; lang?: 'en' | 'ar' }) {
  const router = useRouter();
  const isAr   = lang === 'ar';
  const [busy, setBusy] = useState(false);
  const [, start]       = useTransition();

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(isAr
      ? 'حذف هذه الصورة؟ لا يمكن التراجع.'
      : 'Delete this photo? Cannot be undone.');
    if (!ok) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('soft_delete_bump_photo', { p_id: id });
    setBusy(false);
    if (!error) start(() => router.refresh());
  }

  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-coral-700 disabled:opacity-50">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      {isAr ? 'حذف' : 'Delete'}
    </button>
  );
}

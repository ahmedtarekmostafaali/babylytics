'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Square, Trash2, Loader2 } from 'lucide-react';

export function PumpingRowActions({
  id, isOpen, lang = 'en',
}: {
  id: string;
  isOpen: boolean;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [busy, setBusy] = useState<'stop' | 'del' | null>(null);
  const [, start] = useTransition();

  async function stopRunning() {
    if (busy) return;
    const ml = window.prompt(isAr ? 'كم مل؟ (اختياري)' : 'How many ml? (optional)') ?? '';
    setBusy('stop');
    const supabase = createClient();
    const { error } = await supabase.from('pumping_logs')
      .update({ ended_at: new Date().toISOString(), volume_ml: ml ? Number(ml) : null })
      .eq('id', id);
    setBusy(null);
    if (!error) start(() => router.refresh());
  }

  async function del() {
    if (busy) return;
    const ok = window.confirm(isAr ? 'حذف هذه الجلسة؟' : 'Delete this session?');
    if (!ok) return;
    setBusy('del');
    const supabase = createClient();
    const { error } = await supabase.rpc('soft_delete_pumping_log', { p_id: id });
    setBusy(null);
    if (!error) start(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {isOpen && (
        <button type="button" onClick={stopRunning} disabled={!!busy}
          className="inline-flex items-center gap-1 rounded-full bg-coral-100 hover:bg-coral-200 text-coral-700 text-[11px] font-semibold px-2 py-1 disabled:opacity-50">
          {busy === 'stop' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
          {isAr ? 'إيقاف' : 'Stop'}
        </button>
      )}
      <button type="button" onClick={del} disabled={!!busy}
        className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-coral-700 disabled:opacity-50">
        {busy === 'del' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </button>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * Soft-deletes a medical_files row + the linked extracted_text rows + the
 * storage object. We set deleted_at rather than hard-deleting so any audit
 * log references stay intact.
 *
 * Size + style variants are provided for use inline in a list row vs. at the
 * top of the detail panel.
 */
export function FileDeleteButton({
  fileId, storageBucket, storagePath, redirectTo, variant = 'icon',
}: {
  fileId: string;
  storageBucket: string | null;
  storagePath: string | null;
  /** Where to route after delete (eg. the smart scan page with ?tab=archive). */
  redirectTo: string;
  variant?: 'icon' | 'text';
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this file? You can\'t undo this from the UI.')) return;

    start(async () => {
      setErr(null);
      const supabase = createClient();

      // 1. Soft-delete medical_files + extracted_text rows.
      const { error: fErr } = await supabase.from('medical_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId);
      if (fErr) { setErr(fErr.message); return; }

      await supabase.from('extracted_text')
        .update({ status: 'discarded' })
        .eq('file_id', fileId);

      // 2. Remove the object from Storage so it doesn't occupy quota.
      if (storageBucket && storagePath) {
        try { await supabase.storage.from(storageBucket).remove([storagePath]); }
        catch { /* non-fatal — row is already soft-deleted */ }
      }

      router.push(redirectTo);
      router.refresh();
    });
  }

  if (variant === 'text') {
    return (
      <button onClick={onDelete} disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full border border-coral-200 bg-white hover:bg-coral-50 text-coral-700 text-xs font-semibold px-3 py-1.5 disabled:opacity-60"
        title="Delete file">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Delete file
        {err && <span className="ml-2 text-[10px] text-coral-500">{err}</span>}
      </button>
    );
  }

  return (
    <button onClick={onDelete} disabled={pending}
      aria-label="Delete file"
      title={err ?? 'Delete file'}
      className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted hover:text-coral-600 hover:bg-coral-50 disabled:opacity-50">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

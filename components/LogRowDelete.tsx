'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * Soft-deletes a single log row by setting its `deleted_at` column, then
 * bounces back to the list without the selected id in the URL so the detail
 * panel doesn't try to render a deleted record.
 */
export function LogRowDelete({
  table, id, label = 'Delete',
}: {
  /** The log table, e.g. 'feedings'. RLS + audit triggers handle the rest. */
  table:
    | 'feedings' | 'stool_logs' | 'medications' | 'medication_logs'
    | 'measurements' | 'temperature_logs' | 'vaccinations' | 'sleep_logs'
    | 'screen_time_logs' | 'activity_logs' | 'lab_panels'
    | 'prenatal_visits' | 'ultrasounds' | 'fetal_movements' | 'maternal_symptoms'
    | 'teething_logs' | 'speaking_logs' | 'developmental_milestones'
    | 'shopping_list_items';
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (!window.confirm('Delete this entry? You can restore it from a database backup if needed.')) return;
    setErr(null);
    start(async () => {
      const supabase = createClient();
      const { error } = await supabase.from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { setErr(error.message); return; }
      // Strip ?id=… from the URL so the detail panel collapses.
      const next = new URLSearchParams(Array.from(params?.entries() ?? []));
      next.delete('id');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : (pathname ?? '/'));
      router.refresh();
    });
  }

  return (
    <button onClick={run} disabled={pending}
      title={err ?? label}
      className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 bg-white text-coral-600 hover:bg-coral-50 hover:border-coral-300 disabled:opacity-60"
      aria-label={label}>
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
    </button>
  );
}

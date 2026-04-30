'use client';

// Tiny client button that one-taps a medication into the shopping list
// under the medication scope. Used on the medications list/detail pages
// and on the medication stock page next to the refill button.
//
// Posts via the SECURITY DEFINER `add_medication_to_shopping` RPC so the
// scope/category/medication_id are set correctly without trusting the
// client.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShoppingCart, Loader2, Check } from 'lucide-react';

export function AddMedToShopping({
  medId, label = 'Add to shopping', size = 'sm', className = '',
}: {
  medId: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err,  setErr]  = useState<string | null>(null);

  async function add() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('add_medication_to_shopping', {
      p_med_id: medId, p_quantity: 'refill', p_notes: null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
    router.refresh();
  }

  const padding = size === 'md' ? 'px-3 py-1.5' : 'px-2.5 py-1';
  const text    = size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <button
      type="button"
      onClick={add}
      disabled={busy || done}
      className={`inline-flex items-center gap-1 rounded-full ${padding} ${text} font-semibold transition ${
        done
          ? 'bg-mint-100 text-mint-700'
          : 'border border-peach-200 bg-peach-50 hover:bg-peach-100 text-peach-700'
      } ${className}`}
      title={err ?? undefined}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" />
        : done ? <Check className="h-3 w-3" />
        : <ShoppingCart className="h-3 w-3" />}
      {done ? 'Added' : label}
    </button>
  );
}

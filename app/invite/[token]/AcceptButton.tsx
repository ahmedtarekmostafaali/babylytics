'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Check, Loader2 } from 'lucide-react';

export function AcceptButton({ token, babyId }: { token: string; babyId: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setErr(null);
    setAccepting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('accept_invitation', { p_token: token });
    if (error) {
      setAccepting(false);
      setErr(error.message);
      return;
    }
    router.push(`/babies/${babyId}`);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={accept} disabled={accepting}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-brand-500 to-mint-500 text-base font-semibold">
        {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {accepting ? 'Accepting…' : 'Accept invitation'}
      </Button>
      {err && <p className="text-sm text-coral-600 font-medium text-center">{err}</p>}
    </div>
  );
}

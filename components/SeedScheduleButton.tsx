'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Sparkles } from 'lucide-react';

export function SeedScheduleButton({ babyId }: { babyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!window.confirm('Seed a standard first-year vaccine schedule? You can edit or remove any entry afterwards.')) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('seed_vaccine_schedule', { p_baby: babyId });
    setBusy(false);
    if (error) { window.alert(error.message); return; }
    router.refresh();
  }
  return (
    <Button variant="mint" onClick={go} disabled={busy}>
      <Sparkles className="h-4 w-4" /> {busy ? 'Seeding…' : 'Suggest schedule'}
    </Button>
  );
}

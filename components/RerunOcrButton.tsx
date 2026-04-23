'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export function RerunOcrButton({ fileId, babyId, provider }: { fileId: string; babyId: string; provider?: 'anthropic'|'google' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke('ocr-extract', {
      body: { file_id: fileId, provider },
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (data && typeof data === 'object' && 'extracted_id' in data) {
      router.push(`/babies/${babyId}/ocr/${(data as { extracted_id: string }).extracted_id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <Button variant="secondary" size="sm" onClick={run} disabled={busy}>
        {busy ? 'Running OCR…' : provider ? `Re-run with ${provider}` : 'Re-run OCR'}
      </Button>
    </div>
  );
}

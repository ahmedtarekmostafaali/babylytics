// MentalHealthSlot — Wave 41. Server-side wrapper that asks the DB
// whether a screening prompt is due for this baby + user, and renders
// the client prompt card only when it is. Returns null otherwise so
// the overview stays clean for users who aren't in a prompt window.

import { createClient } from '@/lib/supabase/server';
import { MentalHealthPromptCard } from '@/components/MentalHealthPromptCard';

interface PromptDue {
  kind:            'epds' | 'phq2';
  reason:          string;
  reason_label_en: string;
  reason_label_ar: string;
}

export async function MentalHealthSlot({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const supabase = createClient();
  const { data } = await supabase.rpc('mental_health_prompt_due', { p_baby: babyId });
  const prompt = ((data ?? []) as PromptDue[])[0] ?? null;
  if (!prompt) return null;
  return <MentalHealthPromptCard babyId={babyId} prompt={prompt} lang={lang} />;
}

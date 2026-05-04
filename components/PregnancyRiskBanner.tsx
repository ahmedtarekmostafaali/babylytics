// Wave 35: PregnancyRiskBanner is now a thin wrapper around the
// stage-aware AiRiskBanner. Kept as a back-compat re-export so any
// stale imports keep working — the canonical component is AiRiskBanner
// with stage="pregnancy".

import { AiRiskBanner } from '@/components/AiRiskBanner';

export async function PregnancyRiskBanner({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  return <AiRiskBanner babyId={babyId} stage="pregnancy" lang={lang} />;
}

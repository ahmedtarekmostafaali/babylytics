// Wave 34: PregnancyCompanion is now a thin wrapper around the
// stage-aware AiCompanion. Kept as a back-compat re-export so any
// stale imports keep working — the canonical component is AiCompanion
// with stage="pregnancy".

import { AiCompanion } from '@/components/AiCompanion';

export function PregnancyCompanion({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  return <AiCompanion babyId={babyId} stage="pregnancy" lang={lang} />;
}

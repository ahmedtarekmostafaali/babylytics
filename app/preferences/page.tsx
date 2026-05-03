import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';
import { PreferencesForm } from '@/components/forms/PreferencesForm';
import { PageShell, PageHeader } from '@/components/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preferences' };

export default async function PreferencesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const prefs = await loadUserPrefs(supabase);
  const t = tFor(prefs.language);

  // 050 batch: load per-stage feature visibility for the new Features card.
  const { data: prefRow } = await supabase.from('user_preferences')
    .select('enabled_features').eq('user_id', user.id).maybeSingle();
  const features = (prefRow?.enabled_features as Record<string, string[]> | null) ?? {};

  return (
    <PageShell max="3xl">
      <PageHeader backHref="/dashboard" backLabel={t('nav.my_babies')}
        eyebrow={t('nav.preferences').toUpperCase()} eyebrowTint="brand"
        title={t('prefs.title')}
        subtitle={t('prefs.subtitle')} />
      <PreferencesForm initial={prefs} initialFeatures={features} />
    </PageShell>
  );
}

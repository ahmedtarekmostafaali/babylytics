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

  // 051 batch: per-stage features moved to each profile's edit page —
  // no longer loaded here.

  return (
    <PageShell max="3xl">
      <PageHeader backHref="/dashboard" backLabel={t('nav.my_babies')}
        eyebrow={t('nav.preferences').toUpperCase()} eyebrowTint="brand"
        title={t('prefs.title')}
        subtitle={t('prefs.subtitle')} />
      <PreferencesForm initial={prefs} />
    </PageShell>
  );
}

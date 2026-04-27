import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { MedicationForm } from '@/components/forms/MedicationForm';
import { Card, CardContent } from '@/components/ui/Card';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { Pill, Lightbulb, Sparkles } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add medication' };

export default async function NewMedication({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const [{ data: recent }, { data: docs }] = await Promise.all([
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,starts_at,ends_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('doctors')
      .select('id,name,specialty')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      <div className="mb-6">
        <Link href={`/babies/${params.babyId}/medications`}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm text-ink hover:bg-slate-50 shadow-sm">
          {t('new_pages.nm_back')}
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-lavender-700">{t('new_pages.nm_eyebrow')}</div>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-ink-strong">
            {t('new_pages.nm_title')}
          </h1>
          <p className="mt-2 text-ink">{t('new_pages.nm_subtitle')}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          <MedicationForm babyId={params.babyId}
            doctors={(docs ?? []) as { id: string; name: string; specialty: string | null }[]} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2">
                <Lightbulb className="h-4 w-4 text-peach-500" /> {t('new_pages.nm_tips')}
              </div>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>
                    {t('new_pages.nm_tip1_pre')}<strong>{t('new_pages.nm_tip1_strong')}</strong>{t('new_pages.nm_tip1_post')}<em>{t('new_pages.nm_tip1_em')}</em>{t('new_pages.nm_tip1_tail')}<em>{t('new_pages.nm_tip1_em2')}</em>{t('new_pages.nm_tip1_close')}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>{t('new_pages.nm_tip2_pre')}<em>{t('new_pages.nm_tip2_em')}</em>{t('new_pages.nm_tip2_post')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>{t('new_pages.nm_tip3')}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-sm font-semibold text-ink-strong mb-3">{t('new_pages.nm_other')}</div>
              {(recent ?? []).length === 0 && <p className="text-sm text-ink-muted">{t('new_pages.nm_none')}</p>}
              <ul className="space-y-2">
                {recent?.map(m => {
                  const active = !m.ends_at || new Date(m.ends_at).getTime() > Date.now();
                  return (
                    <li key={m.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="font-semibold text-ink-strong truncate">{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</div>
                        <div className="text-xs text-ink-muted truncate">
                          {t('new_pages.nm_every_h', { n: m.frequency_hours ?? '—', date: fmtDate(m.starts_at) })}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-ink-muted'}`}>
                        {active ? t('new_pages.nm_active') : t('new_pages.nm_ended')}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {recent && recent.length > 0 && (
                <p className="mt-3 text-xs text-ink-muted">{t('new_pages.nm_last_added', { when: fmtDateTime(recent[0]!.starts_at) })}</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

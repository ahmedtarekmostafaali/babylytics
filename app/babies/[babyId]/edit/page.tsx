import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BabyProfileForm, type BabyProfileValue } from '@/components/forms/BabyProfileForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Sparkline } from '@/components/Sparkline';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { ageInDays } from '@/lib/dates';
import { fmtKg, fmtCm } from '@/lib/units';
import {
  Cake, Flag, Droplet, Star, Eye, TrendingUp, ExternalLink,
  UserPlus, Camera, Share2, Stethoscope,
} from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';
import { ProfileFeaturesCard } from '@/components/ProfileFeaturesCard';
import type { LifecycleStage } from '@/lib/lifecycle';
import { stageBucket } from '@/lib/areas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Baby profile' };

function zodiac(dob: string | null | undefined): string {
  if (!dob) return '—';
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return '—';
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const sign =
    (m === 1  && day >= 20) || (m === 2  && day <= 18) ? 'Aquarius' :
    (m === 2  && day >= 19) || (m === 3  && day <= 20) ? 'Pisces'   :
    (m === 3  && day >= 21) || (m === 4  && day <= 19) ? 'Aries'    :
    (m === 4  && day >= 20) || (m === 5  && day <= 20) ? 'Taurus'   :
    (m === 5  && day >= 21) || (m === 6  && day <= 20) ? 'Gemini'   :
    (m === 6  && day >= 21) || (m === 7  && day <= 22) ? 'Cancer'   :
    (m === 7  && day >= 23) || (m === 8  && day <= 22) ? 'Leo'      :
    (m === 8  && day >= 23) || (m === 9  && day <= 22) ? 'Virgo'    :
    (m === 9  && day >= 23) || (m === 10 && day <= 22) ? 'Libra'    :
    (m === 10 && day >= 23) || (m === 11 && day <= 21) ? 'Scorpio'  :
    (m === 11 && day >= 22) || (m === 12 && day <= 21) ? 'Sagittarius'
                                                       : 'Capricorn';
  return sign;
}

/** Age in "Nm Xd" format, clamping to reasonable buckets. */
function ageFromDays(days: number, t: TFunc): string {
  if (days < 30) {
    return days === 1 ? t('edit_baby.age_days_one') : t('edit_baby.age_days_n', { n: days });
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    const d = days % 30;
    return m === 1 ? t('edit_baby.age_months_one', { d }) : t('edit_baby.age_months_n', { m, d });
  }
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return y === 1 ? t('edit_baby.age_years_one', { m }) : t('edit_baby.age_years_n', { y, m });
}

/** Very rough next-milestone bucket for the progress bar. */
function nextMilestone(days: number, t: TFunc): { label: string; pct: number } {
  const milestones: { at: number; tkey: string }[] = [
    { at: 30,   tkey: 'edit_baby.ms_1m' },
    { at: 60,   tkey: 'edit_baby.ms_2m' },
    { at: 90,   tkey: 'edit_baby.ms_3m' },
    { at: 120,  tkey: 'edit_baby.ms_4m' },
    { at: 180,  tkey: 'edit_baby.ms_6m' },
    { at: 365,  tkey: 'edit_baby.ms_1y' },
    { at: 730,  tkey: 'edit_baby.ms_2y' },
  ];
  for (let i = 0; i < milestones.length; i++) {
    if (days < milestones[i]!.at) {
      const prev = i === 0 ? 0 : milestones[i - 1]!.at;
      const pct = Math.round(((days - prev) / (milestones[i]!.at - prev)) * 100);
      return { label: t(milestones[i]!.tkey), pct };
    }
  }
  return { label: '—', pct: 100 };
}

export default async function EditBaby({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,birth_height_cm,feeding_factor_ml_per_kg_per_day,notes,avatar_path,blood_type,doctor_name,doctor_phone,doctor_clinic,next_appointment_at,next_appointment_notes,lifecycle_stage')
    .eq('id', params.babyId)
    .is('deleted_at', null)
    .single();
  if (!baby) notFound();

  // 051 batch: enabled_features lives on the babies table now. Fetched in a
  // SEPARATE query so the page still loads on environments where sql/051
  // hasn't been applied yet (column missing → query fails silently, card
  // shows "all areas" until the migration runs).
  const { data: featRow } = await supabase
    .from('babies')
    .select('enabled_features')
    .eq('id', params.babyId)
    .maybeSingle();
  const enabledFeatures = (featRow as { enabled_features?: string[] | null } | null)?.enabled_features ?? null;

  const [{ data: membership }, { data: currentWeight }, { data: weightRows }, { data: heightRows }, avatarUrl] = await Promise.all([
    supabase.from('baby_users')
      .select('role')
      .eq('baby_id', params.babyId)
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
    supabase.rpc('current_weight_kg', { p_baby: params.babyId }),
    supabase.from('measurements').select('weight_kg,measured_at').eq('baby_id', params.babyId).is('deleted_at', null).order('measured_at', { ascending: true }),
    supabase.from('measurements').select('height_cm,measured_at').eq('baby_id', params.babyId).is('deleted_at', null).order('measured_at', { ascending: true }),
    signAvatarUrl(supabase, baby.avatar_path),
  ]);

  const role = membership?.role as 'owner'|'parent'|'doctor'|'nurse'|'caregiver'|'viewer'|'editor' | undefined;
  const canEditHealth = role === 'owner' || role === 'parent' || role === 'editor';
  const canDelete = role === 'owner';

  const ageDays = ageInDays(baby.dob);
  const ms = nextMilestone(ageDays, t);
  const zod = zodiac(baby.dob);

  const weightSpark = ((weightRows ?? []) as { weight_kg: number | null }[]).filter(r => r.weight_kg != null).map(r => Number(r.weight_kg));
  const heightSpark = ((heightRows ?? []) as { height_cm: number | null }[]).filter(r => r.height_cm != null).map(r => Number(r.height_cm));
  const currentHeight = heightSpark.length ? heightSpark[heightSpark.length - 1] : null;

  // Wave 22: gate right-rail baby-only KPIs by stage. Cycle (planning)
  // profiles still reach this page via the Family > Profile sidebar link
  // (since the page handles the profile name, avatar, blood type, and
  // features picker for them too) — but Age, Next milestone, Zodiac, and
  // Growth Summary are all baby-mode concepts that read as nonsense on a
  // cycle profile (Age: 0 days, Next milestone: 1 month, height/weight
  // sparklines empty). Show only Blood type for non-baby stages.
  const stage = (baby as { lifecycle_stage?: LifecycleStage | null }).lifecycle_stage ?? null;
  const isBabyStage = stageBucket(stage) === 'baby';

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('edit_baby.eyebrow')} eyebrowTint="coral" title={t('edit_baby.title')}
        subtitle={t('edit_baby.subtitle', { name: baby.name })}
        right={
          <Link href={`/babies/${params.babyId}`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
            <Eye className="h-4 w-4" /> {t('edit_baby.view_profile')}
          </Link>
        } />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form. Wave 7: Features tab is rendered inline beside Notes via
            the featuresPanel prop, no longer a separate full-width section. */}
        <BabyProfileForm
          baby={{ ...baby, nickname: null } as BabyProfileValue}
          currentWeightKg={currentWeight as number | null}
          canDelete={canDelete}
          canEditHealth={canEditHealth}
          avatarUrl={avatarUrl}
          stage={(baby as { lifecycle_stage?: LifecycleStage | null }).lifecycle_stage ?? null}
          featuresPanel={
            <ProfileFeaturesCard
              babyId={params.babyId}
              stage={(baby as { lifecycle_stage?: LifecycleStage | null }).lifecycle_stage ?? null}
              initial={enabledFeatures}
              canEdit={canEditHealth}
            />
          }
        />

        {/* Right rail — At a Glance / Growth / Quick Actions */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* At a glance */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-600 grid place-items-center">
                <Star className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-ink-strong">{t('edit_baby.at_a_glance')}</h3>
            </div>

            <ul className="space-y-3 text-sm">
              {isBabyStage && (
                <>
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-ink-muted"><Cake className="h-4 w-4" /> {t('edit_baby.age')}</span>
                    <span className="font-semibold text-ink-strong text-right">{ageFromDays(ageDays, t)}</span>
                  </li>
                  <li>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-ink-muted"><Flag className="h-4 w-4" /> {t('edit_baby.next_milestone')}</span>
                      <span className="font-semibold text-ink-strong">{ms.label}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-coral-400 to-coral-600" style={{ width: `${Math.max(5, Math.min(100, ms.pct))}%` }} />
                    </div>
                    <div className="mt-0.5 text-[10px] text-ink-muted text-right">{Math.max(0, Math.min(100, ms.pct))}%</div>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-ink-muted"><Star className="h-4 w-4" /> {t('edit_baby.zodiac')}</span>
                    <span className="font-semibold text-ink-strong">{zod}</span>
                  </li>
                </>
              )}
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-ink-muted"><Droplet className="h-4 w-4" /> {t('edit_baby.blood_type')}</span>
                <span className="font-semibold text-ink-strong">{baby.blood_type && baby.blood_type !== 'unknown' ? baby.blood_type : t('edit_baby.not_set')}</span>
              </li>
            </ul>
          </section>

          {/* Doctors & appointments shortcut — parent/owner only */}
          {canEditHealth && (
            <Link href={`/babies/${params.babyId}/doctors`}
              className="block rounded-2xl bg-gradient-to-br from-lavender-500 to-brand-500 text-white shadow-card hover:shadow-panel transition p-5">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider opacity-80">{t('edit_baby.health_eyebrow')}</div>
                  <div className="font-bold">{t('edit_baby.doctors_appts')}</div>
                  <p className="text-xs opacity-90 mt-0.5">{t('edit_baby.doctors_appts_sub')}</p>
                </div>
              </div>
            </Link>
          )}

          {/* Growth summary — baby stage only. Wave 22: hidden on cycle
              and pregnancy profiles where weight/height sparklines refer
              to the baby's growth (which doesn't exist yet). */}
          {isBabyStage && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-bold text-ink-strong">{t('edit_baby.growth_summary')}</h3>
              </div>

              <div className="space-y-4">
                <GrowthRow
                  label={t('edit_baby.growth_weight')}
                  value={fmtKg(currentWeight as number | null)}
                  spark={weightSpark}
                  color="#B9A7D8"
                  pctLabel={t('edit_baby.growth_pct')}
                />
                <GrowthRow
                  label={t('edit_baby.growth_height')}
                  value={currentHeight != null ? fmtCm(currentHeight) : '—'}
                  spark={heightSpark}
                  color="#7FC8A9"
                  pctLabel={t('edit_baby.growth_pct')}
                />
              </div>

              <Link href={`/babies/${params.babyId}/measurements`}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                {t('edit_baby.view_growth_chart')} <ExternalLink className="h-3 w-3" />
              </Link>
            </section>
          )}

          {/* Quick actions */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">{t('edit_baby.quick_actions')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href={`/babies/${params.babyId}/caregivers`} icon={UserPlus} tint="lavender" label={t('edit_baby.qa_caregiver')} />
              <QuickAction href={`/babies/${params.babyId}/edit`} icon={Camera} tint="brand" label={t('edit_baby.qa_photo')} />
              <QuickAction href={`/babies/${params.babyId}/reports/full`} icon={Share2} tint="mint" label={t('edit_baby.qa_export')} />
              <QuickAction href={`/babies/${params.babyId}/ocr`} icon={Eye} tint="coral" label={t('edit_baby.qa_scan')} />
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function GrowthRow({
  label, value, spark, color, pctLabel,
}: {
  label: string;
  value: string;
  spark: number[];
  color: string;
  pctLabel: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-lg font-bold text-ink-strong leading-tight">{value}</div>
        <div className="mt-0.5 text-[10px] rounded-full bg-mint-50 text-mint-700 inline-block px-2 py-0.5 font-semibold">{pctLabel}</div>
      </div>
      <div className="flex-1 min-w-0">
        <Sparkline data={spark.length ? spark : [0, 0.5, 1]} color={color} width={160} height={44} strokeWidth={2.5} />
      </div>
    </div>
  );
}

function QuickAction({
  href, icon: Icon, tint, label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'mint' | 'lavender' | 'brand' | 'peach';
  label: string;
}) {
  const map = {
    coral:    'bg-coral-50 text-coral-700 hover:bg-coral-100',
    mint:     'bg-mint-50 text-mint-700 hover:bg-mint-100',
    lavender: 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100',
    brand:    'bg-brand-50 text-brand-700 hover:bg-brand-100',
    peach:    'bg-peach-50 text-peach-700 hover:bg-peach-100',
  }[tint];
  return (
    <Link href={href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${map}`}>
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

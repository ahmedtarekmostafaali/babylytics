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
function ageFromDays(days: number): string {
  if (days < 30)      return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 365)     return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'}, ${days % 30} day${days % 30 === 1 ? '' : 's'}`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return `${y} year${y === 1 ? '' : 's'}, ${m} month${m === 1 ? '' : 's'}`;
}

/** Very rough next-milestone bucket for the progress bar. */
function nextMilestone(days: number): { label: string; pct: number } {
  const milestones: { at: number; label: string }[] = [
    { at: 30,   label: '1 month' },
    { at: 60,   label: '2 months' },
    { at: 90,   label: '3 months' },
    { at: 120,  label: '4 months' },
    { at: 180,  label: '6 months' },
    { at: 365,  label: '1 year' },
    { at: 730,  label: '2 years' },
  ];
  for (let i = 0; i < milestones.length; i++) {
    if (days < milestones[i]!.at) {
      const prev = i === 0 ? 0 : milestones[i - 1]!.at;
      const pct = Math.round(((days - prev) / (milestones[i]!.at - prev)) * 100);
      return { label: milestones[i]!.label, pct };
    }
  }
  return { label: '—', pct: 100 };
}

export default async function EditBaby({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,birth_height_cm,feeding_factor_ml_per_kg_per_day,notes,avatar_path,blood_type,doctor_name,doctor_phone,doctor_clinic,next_appointment_at,next_appointment_notes')
    .eq('id', params.babyId)
    .is('deleted_at', null)
    .single();
  if (!baby) notFound();

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
  const ms = nextMilestone(ageDays);
  const zod = zodiac(baby.dob);

  const weightSpark = ((weightRows ?? []) as { weight_kg: number | null }[]).filter(r => r.weight_kg != null).map(r => Number(r.weight_kg));
  const heightSpark = ((heightRows ?? []) as { height_cm: number | null }[]).filter(r => r.height_cm != null).map(r => Number(r.height_cm));
  const currentHeight = heightSpark.length ? heightSpark[heightSpark.length - 1] : null;

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Profile" eyebrowTint="coral" title="Baby Profile"
        subtitle={`Manage ${baby.name}'s information and preferences.`}
        right={
          <Link href={`/babies/${params.babyId}`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
            <Eye className="h-4 w-4" /> View profile
          </Link>
        } />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form */}
        <BabyProfileForm
          baby={{ ...baby, nickname: null } as BabyProfileValue}
          currentWeightKg={currentWeight as number | null}
          canDelete={canDelete}
          canEditHealth={canEditHealth}
          avatarUrl={avatarUrl}
        />

        {/* Right rail — At a Glance / Growth / Quick Actions */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* At a glance */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-600 grid place-items-center">
                <Star className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-ink-strong">At a Glance</h3>
            </div>

            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-ink-muted"><Cake className="h-4 w-4" /> Age</span>
                <span className="font-semibold text-ink-strong text-right">{ageFromDays(ageDays)}</span>
              </li>
              <li>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-ink-muted"><Flag className="h-4 w-4" /> Next milestone</span>
                  <span className="font-semibold text-ink-strong">{ms.label}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-coral-400 to-coral-600" style={{ width: `${Math.max(5, Math.min(100, ms.pct))}%` }} />
                </div>
                <div className="mt-0.5 text-[10px] text-ink-muted text-right">{Math.max(0, Math.min(100, ms.pct))}%</div>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-ink-muted"><Star className="h-4 w-4" /> Zodiac</span>
                <span className="font-semibold text-ink-strong">{zod}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-ink-muted"><Droplet className="h-4 w-4" /> Blood type</span>
                <span className="font-semibold text-ink-strong">{baby.blood_type && baby.blood_type !== 'unknown' ? baby.blood_type : 'Not set'}</span>
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
                  <div className="text-xs uppercase tracking-wider opacity-80">Health</div>
                  <div className="font-bold">Doctors &amp; appointments</div>
                  <p className="text-xs opacity-90 mt-0.5">Manage your pediatrician, specialists and upcoming visits.</p>
                </div>
              </div>
            </Link>
          )}

          {/* Growth summary */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center">
                <TrendingUp className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-bold text-ink-strong">Growth Summary</h3>
            </div>

            <div className="space-y-4">
              <GrowthRow
                label="Weight"
                value={fmtKg(currentWeight as number | null)}
                spark={weightSpark}
                color="#B9A7D8"
              />
              <GrowthRow
                label="Height"
                value={currentHeight != null ? fmtCm(currentHeight) : '—'}
                spark={heightSpark}
                color="#7FC8A9"
              />
            </div>

            <Link href={`/babies/${params.babyId}/measurements`}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
              View growth chart <ExternalLink className="h-3 w-3" />
            </Link>
          </section>

          {/* Quick actions */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction href={`/babies/${params.babyId}/caregivers`} icon={UserPlus} tint="lavender" label="Add caregiver" />
              <QuickAction href={`/babies/${params.babyId}/edit`} icon={Camera} tint="brand" label="Upload photo" />
              <QuickAction href={`/babies/${params.babyId}/reports/full`} icon={Share2} tint="mint" label="Export data" />
              <QuickAction href={`/babies/${params.babyId}/ocr`} icon={Eye} tint="coral" label="Smart scan" />
            </div>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function GrowthRow({
  label, value, spark, color,
}: {
  label: string;
  value: string;
  spark: number[];
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-lg font-bold text-ink-strong leading-tight">{value}</div>
        <div className="mt-0.5 text-[10px] rounded-full bg-mint-50 text-mint-700 inline-block px-2 py-0.5 font-semibold">— percentile</div>
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

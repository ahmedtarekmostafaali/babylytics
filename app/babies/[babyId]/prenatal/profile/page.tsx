import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PregnancyProfileForm } from '@/components/forms/PregnancyProfileForm';
import { ProfileFeaturesCard } from '@/components/ProfileFeaturesCard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { BabyAvatar } from '@/components/BabyAvatar';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { fmtGestationalAge } from '@/lib/lifecycle';
import { Heart, Calendar, Stethoscope, Eye } from 'lucide-react';
import Link from 'next/link';
import type { LifecycleStage } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pregnancy profile' };

export default async function PregnancyProfilePage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  if (!['owner','parent'].includes(m?.role as string)) redirect(`/babies/${params.babyId}`);

  const [{ data: baby }, { data: data }, { data: featRow }] = await Promise.all([
    supabase.from('babies')
      .select('id,name,avatar_path,lifecycle_stage,edd,lmp')
      .eq('id', params.babyId).is('deleted_at', null).single(),
    supabase.from('pregnancy_profile').select('*').eq('baby_id', params.babyId).maybeSingle(),
    supabase.from('babies').select('enabled_features').eq('id', params.babyId).maybeSingle(),
  ]);
  if (!baby) notFound();
  const enabledFeatures = (featRow as { enabled_features?: string[] | null } | null)?.enabled_features ?? null;

  const avatarUrl = await signAvatarUrl(supabase, baby.avatar_path);
  // fmtGestationalAge takes (edd, lmp) directly and returns the formatted
  // label or empty string when neither is set.
  const gaLabel = fmtGestationalAge(baby.edd, baby.lmp) || null;

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="SETTINGS" eyebrowTint="lavender" title="Pregnancy profile"
        subtitle="Maternal info that helps the dashboard contextualize trends."
        right={
          <Link href={`/babies/${params.babyId}`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
            <Eye className="h-4 w-4" /> Pregnancy overview
          </Link>
        } />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {/* Hero band — same layout style as the baby BabyProfileForm so
              both profile types feel consistent. */}
          <div className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-lavender-50 via-coral-50 to-mint-50 shadow-card p-6 flex items-center gap-6 flex-wrap">
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden>
              <defs>
                <radialGradient id="pp-a" cx="85%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#B9A7D8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#B9A7D8" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="800" height="300" fill="url(#pp-a)" />
              <circle cx="700" cy="60"  r="70" fill="#FFF" opacity="0.4" />
              <circle cx="760" cy="240" r="40" fill="#FFF" opacity="0.3" />
            </svg>
            <div className="relative">
              <BabyAvatar url={avatarUrl} size="2xl" />
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-lavender-700">Pregnancy</div>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink-strong">{baby.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {gaLabel && <Chip tint="lavender"><Calendar className="h-3 w-3" /> {gaLabel}</Chip>}
                <Chip tint="coral"><Heart className="h-3 w-3" /> Expecting</Chip>
              </div>
            </div>
          </div>

          {/* Form card — matches the SectionCard look used on baby /edit. */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-lavender-50 to-coral-50">
              <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-strong text-sm">Maternal information</div>
                <div className="text-[11px] text-ink-muted">All fields optional — fill in what you know.</div>
              </div>
            </div>
            <div className="p-5">
              <PregnancyProfileForm babyId={params.babyId}
                initial={data ? {
                  mother_dob: data.mother_dob,
                  mother_blood_type: data.mother_blood_type,
                  gravida: data.gravida, para: data.para,
                  pre_pregnancy_weight_kg: data.pre_pregnancy_weight_kg,
                  pre_pregnancy_height_cm: data.pre_pregnancy_height_cm,
                  risk_factors: data.risk_factors, notes: data.notes,
                } : undefined} />
            </div>
          </section>

          {/* Per-profile features — same component baby /edit uses, matching
              UI across the two flows. */}
          <ProfileFeaturesCard
            babyId={params.babyId}
            stage={(baby.lifecycle_stage as LifecycleStage | null) ?? null}
            initial={enabledFeatures}
            canEdit={true}
          />
        </div>

        {/* Right rail — links to the prenatal trackers so this page mirrors
            the baby /edit right rail's "shortcut to relevant pages" pattern. */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">Prenatal shortcuts</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink href={`/babies/${params.babyId}/prenatal/visits`} tint="lavender" label="Prenatal visits" />
              <QuickLink href={`/babies/${params.babyId}/prenatal/ultrasounds`} tint="brand" label="Ultrasounds" />
              <QuickLink href={`/babies/${params.babyId}/prenatal/kicks`} tint="coral" label="Kick counter" />
              <QuickLink href={`/babies/${params.babyId}/prenatal/maternal-vitals`} tint="peach" label="Maternal vitals" />
              <QuickLink href={`/babies/${params.babyId}/prenatal/symptoms`} tint="lavender" label="Symptoms" />
              <QuickLink href={`/babies/${params.babyId}/labs`} tint="peach" label="Labs & scans" />
            </div>
          </section>

          <Link href={`/babies/${params.babyId}/doctors`}
            className="block rounded-2xl bg-gradient-to-br from-lavender-500 to-brand-500 text-white shadow-card hover:shadow-panel transition p-5">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
                <Stethoscope className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider opacity-80">Health</div>
                <div className="font-bold">Doctors &amp; appointments</div>
                <p className="text-xs opacity-90 mt-0.5">Manage your OB-GYN, midwife, and visits.</p>
              </div>
            </div>
          </Link>
        </aside>
      </div>
    </PageShell>
  );
}

function Chip({ tint, children }: { tint: 'lavender' | 'coral' | 'mint'; children: React.ReactNode }) {
  const map = {
    lavender: 'bg-lavender-100 text-lavender-700',
    coral:    'bg-coral-100 text-coral-700',
    mint:     'bg-mint-100 text-mint-700',
  }[tint];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${map} text-xs font-semibold px-2.5 py-1`}>
      {children}
    </span>
  );
}

function QuickLink({ href, tint, label }: { href: string; tint: 'coral'|'mint'|'lavender'|'brand'|'peach'; label: string }) {
  const map = {
    coral:    'bg-coral-50 text-coral-700 hover:bg-coral-100',
    mint:     'bg-mint-50 text-mint-700 hover:bg-mint-100',
    lavender: 'bg-lavender-50 text-lavender-700 hover:bg-lavender-100',
    brand:    'bg-brand-50 text-brand-700 hover:bg-brand-100',
    peach:    'bg-peach-50 text-peach-700 hover:bg-peach-100',
  }[tint];
  return (
    <Link href={href} className={`flex items-center justify-center text-center rounded-xl px-3 py-2.5 text-xs font-semibold ${map}`}>
      {label}
    </Link>
  );
}

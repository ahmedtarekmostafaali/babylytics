import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InviteForm } from '@/components/forms/InviteForm';
import { CaregiverRowActions } from '@/components/CaregiverRowActions';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDate } from '@/lib/dates';
import {
  Shield, Stethoscope, Heart, Users, Eye, Lock, UserCog,
  Edit3, BarChart3, ShieldCheck, History,
} from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caregivers' };

type Role = 'owner' | 'parent' | 'doctor' | 'nurse' | 'caregiver' | 'viewer' | 'editor';

const ROLE_META: Record<Role, { tkey: string; tint: string; icon: React.ComponentType<{ className?: string }> }> = {
  owner:     { tkey: 'caregivers.label_owner',  tint: 'bg-brand-100    text-brand-700',    icon: Shield },
  parent:    { tkey: 'caregivers.label_parent', tint: 'bg-mint-100     text-mint-700',     icon: Shield },
  editor:    { tkey: 'caregivers.label_parent', tint: 'bg-mint-100     text-mint-700',     icon: Shield }, // legacy
  doctor:    { tkey: 'caregivers.label_doctor', tint: 'bg-lavender-100 text-lavender-700', icon: Stethoscope },
  nurse:     { tkey: 'caregivers.label_nurse',  tint: 'bg-coral-100    text-coral-700',    icon: Heart },
  caregiver: { tkey: 'caregivers.label_nurse',  tint: 'bg-coral-100    text-coral-700',    icon: Heart }, // legacy → nurse
  viewer:    { tkey: 'caregivers.label_viewer', tint: 'bg-slate-100    text-ink',          icon: Eye },
};

const ROLE_DEFS: { role: Role; titleKey: string; permsKey: string }[] = [
  { role: 'parent', titleKey: 'caregivers.role_parent_t', permsKey: 'caregivers.role_parent_p' },
  { role: 'doctor', titleKey: 'caregivers.role_doctor_t', permsKey: 'caregivers.role_doctor_p' },
  { role: 'nurse',  titleKey: 'caregivers.role_nurse_t',  permsKey: 'caregivers.role_nurse_p' },
  { role: 'viewer', titleKey: 'caregivers.role_viewer_t', permsKey: 'caregivers.role_viewer_p' },
];

function initials(s: string) {
  const p = s.trim().split(/\s+/);
  if (p.length >= 2) return (p[0]!.charAt(0) + p[1]!.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default async function CaregiversPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: baby } = await supabase.from('babies')
    .select('id,name,lifecycle_stage,dob')
    .eq('id', params.babyId).single();
  if (!baby) notFound();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  // 050 batch: pass stage to InviteForm + CaregiverRowActions so the
  // AreaPicker only shows areas relevant to this profile (cycle items
  // for planning, prenatal for pregnancy, baby trackers for born).
  const { stageBucket: bucketFor } = await import('@/lib/areas');
  const { effectiveStage: effStg } = await import('@/lib/lifecycle');
  const stage = bucketFor(effStg(
    baby.lifecycle_stage as 'planning'|'pregnancy'|'newborn'|'infant'|'toddler'|'child'|'archived'|null,
    baby.dob as string | null,
  ));

  type Row = { baby_id: string; user_id: string; role: Role; created_at: string; allowed_areas: string[] | null };
  const { data: rowsRaw } = await supabase
    .from('baby_users')
    .select('baby_id,user_id,role,created_at,allowed_areas')
    .eq('baby_id', params.babyId)
    .order('created_at', { ascending: true });
  const rows = (rowsRaw ?? []) as Row[];

  const ids = rows.map(r => r.user_id);
  const { data: profs } = ids.length
    ? await supabase.from('profiles').select('id,email,display_name').in('id', ids)
    : { data: [] as { id: string; email: string; display_name: string | null }[] };
  const profById = new Map((profs ?? []).map(p => [p.id, p]));

  const me = rows.find(r => r.user_id === user?.id);
  const myRole: Role | null = me?.role ?? null;
  const canManage = myRole === 'owner' || myRole === 'parent' || myRole === 'editor';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('caregivers.eyebrow')} eyebrowTint="mint"
        title={<>{t('caregivers.title')} <span className="inline-flex items-center gap-1 text-mint-600 ml-1"><Users className="h-5 w-5" /></span></>}
        subtitle={t('caregivers.subtitle', { name: baby.name })} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT — 2/3: current caregivers + invite */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current caregivers — card-based list, not a grid, so each row
              reliably wraps without breaking alignment. */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink-strong">{t('caregivers.current_h')}</h2>
                <span className="rounded-full bg-mint-100 text-mint-700 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                  {rows.length === 1 ? t('caregivers.count_one') : t('caregivers.count_n', { n: rows.length })}
                </span>
              </div>
            </div>

            <ul className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-ink-muted">
                  {t('caregivers.none')}
                </li>
              )}
              {rows.map(r => {
                const prof = profById.get(r.user_id);
                const name = prof?.display_name
                  || (prof?.email ? prof.email.split('@')[0]! : r.user_id.slice(0, 8));
                const meta = ROLE_META[r.role];
                const isSelf = r.user_id === user?.id;
                return (
                  <li key={r.user_id} className="px-4 sm:px-5 py-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar + name (flex-1 takes remaining space) */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="h-11 w-11 rounded-full bg-gradient-to-br from-brand-100 to-mint-100 text-brand-700 grid place-items-center text-xs font-bold shrink-0">
                          {initials(name)}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">
                            {isSelf ? t('caregivers.you') : name}
                            {r.role === 'owner' && <span className="text-ink-muted font-normal">{t('caregivers.owner_suffix')}</span>}
                          </div>
                          <div className="text-xs text-ink-muted truncate">{prof?.email ?? r.user_id}</div>
                          {/* Mobile-only meta: role chip + joined under email */}
                          <div className="mt-1 flex items-center gap-2 sm:hidden">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tint}`}>
                              <meta.icon className="h-3 w-3" />
                              {t(meta.tkey)}
                            </span>
                            <span className="text-[10px] text-ink-muted">{t('caregivers.joined', { date: fmtDate(r.created_at) })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Desktop-only chips (hidden on mobile to keep one tidy line) */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tint}`}>
                          <meta.icon className="h-3 w-3" />
                          {t(meta.tkey)}
                        </span>
                        <div className="flex items-center gap-1">
                          <PermIcon role={r.role} kind="view" t={t} />
                          <PermIcon role={r.role} kind="edit" t={t} />
                          <PermIcon role={r.role} kind="reports" t={t} />
                        </div>
                        <span className="text-[11px] text-ink-muted whitespace-nowrap">{fmtDate(r.created_at)}</span>
                      </div>

                      {/* Actions menu — always at the end. Includes the
                          new "Edit visibility" option that opens the
                          AreaPicker scoped to this profile's stage. */}
                      <div className="shrink-0">
                        <CaregiverRowActions babyId={params.babyId} userId={r.user_id}
                          currentRole={r.role} canManage={canManage} isSelf={isSelf}
                          stage={stage} currentAreas={r.allowed_areas} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-ink-muted flex items-center gap-1 justify-center">
              <History className="h-3.5 w-3.5" />
              {t('caregivers.audited')}
            </div>
          </section>

          {/* Invite */}
          {canManage && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-1">
                  <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-mint-100 to-peach-100 grid place-items-center">
                    <span className="text-xl">💌</span>
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-ink-strong">{t('caregivers.invite_h')}</h2>
                    <p className="text-xs text-ink-muted">{t('caregivers.invite_sub')}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <InviteForm babyId={params.babyId} stage={stage} />
                </div>
              </div>
            </section>
          )}

          {!canManage && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-ink-muted">
              {t('caregivers.no_perm')}
            </div>
          )}
        </div>

        {/* RIGHT — 1/3: About + role cards */}
        <div className="space-y-6">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">{t('caregivers.about_h')}</h3>
            <div className="space-y-4">
              <Pillar icon={ShieldCheck} tint="mint"     title={t('caregivers.pillar_secure_t')} body={t('caregivers.pillar_secure_b')} />
              <Pillar icon={UserCog}     tint="lavender" title={t('caregivers.pillar_role_t')}   body={t('caregivers.pillar_role_b')} />
              <Pillar icon={Edit3}       tint="peach"    title={t('caregivers.pillar_edit_t')}   body={t('caregivers.pillar_edit_b')} />
            </div>
          </section>

          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong">{t('caregivers.roles_h')}</h3>
            <p className="text-xs text-ink-muted mt-0.5">{t('caregivers.roles_sub')}</p>
            <ul className="mt-4 space-y-2">
              {ROLE_DEFS.map(def => {
                const meta = ROLE_META[def.role];
                return (
                  <li key={def.role} className="flex items-start gap-3 rounded-xl border border-slate-100 p-2.5">
                    <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${meta.tint}`}>
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-strong truncate">{t(def.titleKey)}</div>
                      <div className="text-xs text-ink-muted">{t(def.permsKey)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>

      {/* Tips banner */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-peach-50 via-white to-lavender-50 p-4 flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-white grid place-items-center shrink-0 shadow-sm">
          <Lock className="h-4 w-4 text-peach-600" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-strong">{t('caregivers.tips_h')}</div>
          <p className="text-xs text-ink-muted mt-0.5">
            {t('caregivers.tips_b')}
          </p>
        </div>
      </div>
    </PageShell>
  );
}

function PermIcon({ role, kind, t }: { role: Role; kind: 'edit' | 'view' | 'reports'; t: TFunc }) {
  // Align with lib/permissions.ts:
  //   edit    → owner/parent only (writes, uploads)
  //   reports → owner/parent/doctor (export + comments)
  //   view    → everyone except (nothing — even viewer sees overview)
  const canEdit    = role === 'owner' || role === 'parent' || role === 'editor';
  const canReports = canEdit || role === 'doctor';
  const state = kind === 'edit' ? canEdit : kind === 'reports' ? canReports : true;
  const Icon  = kind === 'edit' ? Edit3 : kind === 'reports' ? BarChart3 : Eye;
  const title = kind === 'edit' ? t('caregivers.perm_edit') : kind === 'reports' ? t('caregivers.perm_reports') : t('caregivers.perm_view');
  return (
    <span title={title}
      className={`h-7 w-7 rounded-lg grid place-items-center ${state ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-300'}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function Pillar({ icon: Icon, tint, title, body }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'mint' | 'lavender' | 'peach';
  title: string; body: string;
}) {
  const tintClasses = {
    mint:     'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    peach:    'bg-peach-100 text-peach-700',
  }[tint];
  return (
    <div className="flex items-start gap-3">
      <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${tintClasses}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-strong">{title}</div>
        <div className="text-xs text-ink-muted">{body}</div>
      </div>
    </div>
  );
}

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

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caregivers' };

type Role = 'owner' | 'parent' | 'doctor' | 'nurse' | 'caregiver' | 'viewer' | 'editor';

const ROLE_META: Record<Role, { label: string; tint: string; icon: React.ComponentType<{ className?: string }> }> = {
  owner:     { label: 'Owner',             tint: 'bg-brand-100    text-brand-700',    icon: Shield },
  parent:    { label: 'Parent',            tint: 'bg-mint-100     text-mint-700',     icon: Shield },
  editor:    { label: 'Parent',            tint: 'bg-mint-100     text-mint-700',     icon: Shield }, // legacy
  doctor:    { label: 'Doctor',            tint: 'bg-lavender-100 text-lavender-700', icon: Stethoscope },
  nurse:     { label: 'Nurse',             tint: 'bg-coral-100    text-coral-700',    icon: Heart },
  caregiver: { label: 'Caregiver',         tint: 'bg-peach-100    text-peach-700',    icon: Users },
  viewer:    { label: 'Viewer',            tint: 'bg-slate-100    text-ink',          icon: Eye },
};

const ROLE_DEFS: { role: Role; title: string; perms: string }[] = [
  { role: 'parent',    title: 'Parent / Guardian', perms: 'Full access to all data and settings.' },
  { role: 'doctor',    title: 'Doctor',            perms: 'View medical data, add notes, write logs.' },
  { role: 'nurse',     title: 'Nurse',             perms: 'View logs, add measurements and notes.' },
  { role: 'caregiver', title: 'Caregiver',         perms: 'View logs and basic data.' },
  { role: 'viewer',    title: 'Viewer',            perms: 'Read-only access to logs and reports.' },
];

function initials(s: string) {
  const p = s.trim().split(/\s+/);
  if (p.length >= 2) return (p[0]!.charAt(0) + p[1]!.charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

export default async function CaregiversPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  type Row = { baby_id: string; user_id: string; role: Role; created_at: string };
  const { data: rowsRaw } = await supabase
    .from('baby_users')
    .select('baby_id,user_id,role,created_at')
    .eq('baby_id', params.babyId)
    .order('created_at', { ascending: true });
  const rows = (rowsRaw ?? []) as Row[];

  // Resolve profile data for each caregiver (name + email)
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
        eyebrow="Team" eyebrowTint="mint" title={<>Caregivers <span className="inline-flex items-center gap-1 text-mint-600 ml-1"><Users className="h-5 w-5" /></span></>}
        subtitle={`Manage who can access ${baby.name}'s data and what they can do.`}
        right={
          <Link href="#" className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
            Caregiver Guide
          </Link>
        } />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT — 2/3: current + invite + roles */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current caregivers */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink-strong">Current caregivers</h2>
                <span className="rounded-full bg-mint-100 text-mint-700 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                  {rows.length} caregiver{rows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="hidden md:grid grid-cols-[minmax(0,1fr)_120px_160px_130px_110px_40px] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted bg-slate-50/50 border-b border-slate-100">
              <span>Caregiver</span>
              <span>Role</span>
              <span>Permissions</span>
              <span>Joined</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {rows.map(r => {
                const prof = profById.get(r.user_id);
                const name = prof?.display_name || (prof?.email ? prof.email.split('@')[0]! : r.user_id.slice(0, 8));
                const meta = ROLE_META[r.role];
                const isSelf = r.user_id === user?.id;
                return (
                  <li key={r.user_id} className="grid md:grid-cols-[minmax(0,1fr)_120px_160px_130px_110px_40px] md:items-center gap-4 px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-100 to-mint-100 text-brand-700 grid place-items-center text-xs font-bold shrink-0">
                        {initials(name)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-strong truncate">
                          {isSelf ? 'You' : name}{r.role === 'owner' && <span className="text-ink-muted font-normal"> (Owner)</span>}
                        </div>
                        <div className="text-xs text-ink-muted truncate">{prof?.email ?? '—'}</div>
                      </div>
                    </div>

                    <div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.tint}`}>
                        <meta.icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-ink-muted">
                      <PermIcon role={r.role} kind="edit" />
                      <PermIcon role={r.role} kind="view" />
                      <PermIcon role={r.role} kind="reports" />
                    </div>

                    <div className="text-xs text-ink">{fmtDate(r.created_at)}</div>

                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 text-mint-700 px-2 py-0.5 text-[11px] font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-mint-500" /> Active
                      </span>
                    </div>

                    <div>
                      <CaregiverRowActions babyId={params.babyId} userId={r.user_id}
                        currentRole={r.role} canManage={canManage} isSelf={isSelf} />
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-center text-xs text-ink-muted inline-flex items-center gap-1 justify-center w-full">
              <History className="h-3.5 w-3.5" />
              Every change is audited. Contact your owner for the full log.
            </div>
          </section>

          {/* Invite */}
          {canManage && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              <div className="grid lg:grid-cols-[1fr_auto] items-start gap-6 p-5">
                <div>
                  <h2 className="text-lg font-bold text-ink-strong">Invite a caregiver</h2>
                  <p className="text-xs text-ink-muted mt-0.5">They must already have a Babylytics account.</p>
                  <div className="mt-4">
                    <InviteForm babyId={params.babyId} />
                  </div>
                </div>
                <div className="hidden lg:block shrink-0 relative">
                  <div className="w-56 h-48 rounded-2xl bg-gradient-to-br from-mint-100 via-peach-50 to-coral-100 grid place-items-center">
                    <span className="text-6xl">💌</span>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* RIGHT — 1/3: About + role cards */}
        <div className="space-y-6">
          {/* About caregiver access */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong mb-3">About caregiver access</h3>
            <div className="space-y-4">
              <Pillar icon={ShieldCheck} tint="mint" title="Secure & private"
                body="All data is encrypted and scoped to this baby." />
              <Pillar icon={UserCog} tint="lavender" title="Role-based access"
                body="You control what each caregiver can see or do." />
              <Pillar icon={Edit3} tint="peach" title="Editable anytime"
                body="You can update or remove access at any time." />
            </div>
          </section>

          {/* Caregiver roles */}
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <h3 className="text-sm font-bold text-ink-strong">Caregiver roles</h3>
            <p className="text-xs text-ink-muted mt-0.5">Each role comes with different permissions.</p>
            <ul className="mt-4 space-y-2">
              {ROLE_DEFS.map(def => {
                const meta = ROLE_META[def.role];
                return (
                  <li key={def.role} className={`flex items-start gap-3 rounded-xl p-2.5 ${meta.tint.replace('text-', 'text-ink ')}`}>
                    <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${meta.tint}`}>
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-strong truncate">{def.title}</div>
                      <div className="text-xs text-ink-muted">{def.perms}</div>
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
          <div className="text-sm font-semibold text-ink-strong">Tips</div>
          <p className="text-xs text-ink-muted mt-0.5">Give access to trusted people only. You can review and update permissions at any time.</p>
        </div>
      </div>
    </PageShell>
  );
}

/* ────────────────────────────────────────────────────────────── */
/* Tiny permission badges used in the table.                     */
/* ────────────────────────────────────────────────────────────── */
function PermIcon({ role, kind }: { role: Role; kind: 'edit' | 'view' | 'reports' }) {
  const canEdit    = role === 'owner' || role === 'parent' || role === 'editor' || role === 'doctor' || role === 'nurse' || role === 'caregiver';
  const canReports = role !== 'viewer';
  const state = kind === 'edit' ? canEdit : kind === 'reports' ? canReports : true; // all can view
  const Icon  = kind === 'edit' ? Edit3 : kind === 'reports' ? BarChart3 : Eye;
  const title = kind === 'edit' ? 'Edit logs' : kind === 'reports' ? 'Reports' : 'View data';
  return (
    <span title={title}
      className={`h-7 w-7 rounded-lg grid place-items-center ${state ? 'bg-brand-50 text-brand-600' : 'bg-slate-50 text-slate-300'}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** Vertical pillar row in the "About caregiver access" sidebar. */
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

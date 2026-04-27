'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BabyAvatar } from '@/components/BabyAvatar';
import { Wordmark } from '@/components/Wordmark';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { ageInDays } from '@/lib/dates';
import { effectiveStage, fmtGestationalAge } from '@/lib/lifecycle';
import {
  LayoutDashboard, Clock, Milk, Droplet, Pill, Ruler, FileText, BarChart3, Users, UserCog,
  LogOut, Menu, X, ChevronLeft, Plus, Sparkles, ChevronsUpDown, Thermometer, Syringe, Moon,
  Stethoscope, CalendarClock, HeartPulse, ScanLine, Activity, Heart, Tv, FlaskConical,
  Smile, MessageCircle, ChevronDown, Settings, ShoppingCart,
} from 'lucide-react';
import { useT } from '@/lib/i18n/client';

type BabyRow = {
  id: string;
  name: string;
  dob: string | null;
  avatar_path: string | null;
  lifecycle_stage?: 'pregnancy'|'newborn'|'infant'|'toddler'|'child'|'archived' | null;
  edd?: string | null;
  lmp?: string | null;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [babies, setBabies] = useState<BabyRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [babySwitcherOpen, setBabySwitcherOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  // Per-category collapse state, persisted to localStorage so it survives
  // page navigation. Default: every category open.
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bx:sidebar-collapsed');
      if (saved === '1') setCollapsed(true);
      const cats = localStorage.getItem('bx:sidebar-cats');
      if (cats) setOpenCats(JSON.parse(cats));
    } catch { /* ignore */ }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase.from('babies')
      .select('id,name,dob,avatar_path,lifecycle_stage,edd,lmp')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const list = (data ?? []) as BabyRow[];
        setBabies(list);
        // Sign avatars client-side once loaded
        const urls: Record<string, string | null> = {};
        await Promise.all(list.map(async b => {
          urls[b.id] = await signAvatarUrl(supabase, b.avatar_path);
        }));
        setAvatars(urls);
      });
  }, [pathname]);

  useEffect(() => {
    try { localStorage.setItem('bx:sidebar-collapsed', collapsed ? '1' : '0'); }
    catch { /* ignore */ }
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('is-sidebar-collapsed', collapsed);
    }
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); setBabySwitcherOpen(false); }, [pathname]);

  function toggleCat(id: string) {
    setOpenCats(prev => {
      const next = { ...prev, [id]: prev[id] === false ? true : false };
      try { localStorage.setItem('bx:sidebar-cats', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  // Default open unless explicitly false.
  const isCatOpen = (id: string) => openCats[id] !== false;

  // Most pages live under /babies/[id]/* so the URL gives us the active baby.
  // But "global" pages (Preferences, Updates, Dashboard) leave that route, and
  // we still want the per-baby nav section to stay visible. We persist the
  // last-seen babyId in localStorage and fall back to it on those pages.
  const [stickyBabyId, setStickyBabyId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem('bx:last-baby');
      if (v) setStickyBabyId(v);
    } catch { /* ignore */ }
  }, []);

  const currentBabyId = useMemo(() => {
    const m = pathname?.match(/^\/babies\/([0-9a-f-]{8,})/i);
    if (m) return m[1] ?? null;
    // Outside a baby route — only fall back if the sticky id still corresponds
    // to a baby the user has access to. (Babies list is loaded above.)
    if (stickyBabyId && babies.some(b => b.id === stickyBabyId)) return stickyBabyId;
    return null;
  }, [pathname, stickyBabyId, babies]);

  // Whenever we ARE on a baby route, remember that id for next time.
  useEffect(() => {
    const m = pathname?.match(/^\/babies\/([0-9a-f-]{8,})/i);
    if (m && m[1]) {
      setStickyBabyId(m[1]);
      try { localStorage.setItem('bx:last-baby', m[1]); } catch { /* ignore */ }
    }
  }, [pathname]);

  // Fetch the caller's role for the current baby so we can hide nav items
  // that they can't access. Re-runs whenever the baby in the URL changes.
  useEffect(() => {
    if (!currentBabyId) { setRole(null); return; }
    const supabase = createClient();
    supabase.rpc('my_baby_role', { b: currentBabyId })
      .then(({ data }) => setRole((data as string | null) ?? null));
  }, [currentBabyId]);

  const isViewer = role === 'viewer';
  const isParent = role === 'owner' || role === 'parent' || role === 'editor';
  const canViewLogs = !!role && !isViewer;
  const canExport = isParent || role === 'doctor';

  const currentBaby = currentBabyId
    ? (babies.find(b => b.id === currentBabyId) ?? null)
    : null;
  const stage = currentBaby ? effectiveStage(currentBaby.lifecycle_stage ?? null, currentBaby.dob) : null;
  const isPregnancy = stage === 'pregnancy';

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const SidebarInner = (
    <div className="h-full flex flex-col relative">
      {/* Wordmark header */}
      <div className={cn('flex items-center h-16 border-b border-slate-200/70', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Link href="/dashboard" className="flex items-center" title="Babylytics">
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/Logo.png" alt="Babylytics" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <Wordmark size="md" showLogo={true} />
          )}
        </Link>
        <button
          className="ml-auto lg:hidden h-8 w-8 grid place-items-center rounded-md hover:bg-slate-100"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4 text-ink-muted" />
        </button>
      </div>

      {/* Floating collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="hidden lg:grid absolute top-5 -right-3 z-40 h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-ink-muted hover:text-brand-600 hover:border-brand-300 shadow-sm"
      >
        <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
      </button>

      {/* Baby profile card */}
      {currentBaby && !collapsed && (
        <div className="px-4 pt-4">
          <button
            onClick={() => setBabySwitcherOpen(o => !o)}
            className="w-full flex items-center gap-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3 hover:bg-slate-50 transition"
          >
            <BabyAvatar url={avatars[currentBaby.id] ?? null} size="md" />
            <div className="flex-1 min-w-0 text-left">
              <div className="font-semibold text-ink-strong truncate">{currentBaby.name}</div>
              <div className="text-xs text-ink-muted">{babyCardLabel(currentBaby)}</div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-ink-muted shrink-0" />
          </button>

          {babySwitcherOpen && (
            <div className="mt-2 rounded-2xl bg-white border border-slate-200/80 shadow-panel p-2 space-y-1">
              {babies.filter(b => b.id !== currentBabyId).map(b => (
                <Link key={b.id} href={`/babies/${b.id}`}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                  <BabyAvatar url={avatars[b.id] ?? null} size="sm" />
                  <div className="text-sm truncate">{b.name}</div>
                </Link>
              ))}
              <Link href="/babies/new"
                className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-coral-50 text-coral-600 text-sm font-medium">
                <span className="h-8 w-8 rounded-lg bg-coral-100 grid place-items-center"><Plus className="h-4 w-4" /></span>
                Add baby
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Nav sections — categories are expandable when not collapsed. */}
      <nav className={cn('flex-1 overflow-y-auto space-y-3', collapsed ? 'px-2 py-3' : 'px-3 py-4')}>
        <NavGroup label="HOME" collapsed={collapsed}>
          <NavItem href="/dashboard" icon={LayoutDashboard} label={t('nav.my_babies')}
            active={pathname === '/dashboard'} collapsed={collapsed} tint="brand" />
        </NavGroup>

        {currentBabyId && (
          <>
            {/* Always-visible Overview link */}
            <NavGroup label={isPregnancy ? 'PREGNANCY' : 'TRACK'} collapsed={collapsed}>
              <NavItem href={`/babies/${currentBabyId}`} icon={isPregnancy ? HeartPulse : Clock}
                label={t('nav.overview')} active={pathname === `/babies/${currentBabyId}`}
                collapsed={collapsed} tint={isPregnancy ? 'lavender' : 'brand'} />
            </NavGroup>

            {/* ─────── Pregnancy mode: prenatal categories ─────── */}
            {isPregnancy && canViewLogs && (
              <>
                <NavCategory id="preg_visits" label={t('nav.cat_care')} icon={Stethoscope} collapsed={collapsed}
                  open={isCatOpen('preg_visits')} onToggle={() => toggleCat('preg_visits')}>
                  <NavItem href={`/babies/${currentBabyId}/prenatal/visits`}       icon={Stethoscope} label="Prenatal visits" active={pathname?.startsWith(`/babies/${currentBabyId}/prenatal/visits`) ?? false} collapsed={collapsed} tint="lavender" />
                  <NavItem href={`/babies/${currentBabyId}/prenatal/ultrasounds`}  icon={ScanLine}    label="Ultrasounds"     active={pathname?.startsWith(`/babies/${currentBabyId}/prenatal/ultrasounds`) ?? false} collapsed={collapsed} tint="brand" />
                  <NavItem href={`/babies/${currentBabyId}/labs`}                  icon={FlaskConical} label={t('nav.labs_scans')} active={pathname?.startsWith(`/babies/${currentBabyId}/labs`) ?? false} collapsed={collapsed} tint="peach" />
                  <NavItem href={`/babies/${currentBabyId}/medications`}           icon={Pill}        label={t('nav.medications')} active={pathname?.startsWith(`/babies/${currentBabyId}/medications`) ?? false} collapsed={collapsed} tint="mint" />
                  {isParent && <NavItem href={`/babies/${currentBabyId}/doctors`}  icon={CalendarClock} label={t('nav.appointments')} active={pathname?.startsWith(`/babies/${currentBabyId}/doctors`) ?? false} collapsed={collapsed} tint="brand" />}
                </NavCategory>

                <NavCategory id="preg_vital" label={t('nav.cat_vital_signs')} icon={Heart} collapsed={collapsed}
                  open={isCatOpen('preg_vital')} onToggle={() => toggleCat('preg_vital')}>
                  <NavItem href={`/babies/${currentBabyId}/prenatal/kicks`}        icon={Activity}    label="Kick counter"    active={pathname?.startsWith(`/babies/${currentBabyId}/prenatal/kicks`) ?? false} collapsed={collapsed} tint="coral" />
                  <NavItem href={`/babies/${currentBabyId}/prenatal/maternal-vitals`} icon={Heart}    label="Maternal vitals" active={pathname?.startsWith(`/babies/${currentBabyId}/prenatal/maternal-vitals`) ?? false} collapsed={collapsed} tint="peach" />
                </NavCategory>

                <NavCategory id="preg_records" label={t('nav.cat_records')} icon={FileText} collapsed={collapsed}
                  open={isCatOpen('preg_records')} onToggle={() => toggleCat('preg_records')}>
                  <NavItem href={`/babies/${currentBabyId}/ocr`}             icon={FileText}  label={t('nav.files')} active={(pathname?.startsWith(`/babies/${currentBabyId}/ocr`) || pathname?.startsWith(`/babies/${currentBabyId}/files`) || pathname?.startsWith(`/babies/${currentBabyId}/upload`)) ?? false} collapsed={collapsed} tint="coral" />
                  <NavItem href={`/babies/${currentBabyId}/medical-profile`} icon={HeartPulse} label={t('nav.medical_profile')} active={pathname?.startsWith(`/babies/${currentBabyId}/medical-profile`) ?? false} collapsed={collapsed} tint="lavender" />
                  {canExport && <NavItem href={`/babies/${currentBabyId}/reports`} icon={BarChart3} label={t('nav.reports')} active={pathname?.startsWith(`/babies/${currentBabyId}/reports`) ?? false} collapsed={collapsed} tint="peach" />}
                  <NavItem href={`/babies/${currentBabyId}/shopping`}        icon={ShoppingCart} label={t('nav.shopping')} active={pathname?.startsWith(`/babies/${currentBabyId}/shopping`) ?? false} collapsed={collapsed} tint="mint" />
                </NavCategory>
              </>
            )}

            {/* ─────── Baby mode: categorised trackers ─────── */}
            {!isPregnancy && canViewLogs && (
              <>
                <NavCategory id="baby_vital" label={t('nav.cat_vital_signs')} icon={HeartPulse} collapsed={collapsed}
                  open={isCatOpen('baby_vital')} onToggle={() => toggleCat('baby_vital')}>
                  <NavItem href={`/babies/${currentBabyId}/feedings`}      icon={Milk}        label={t('nav.feedings')}     active={pathname?.startsWith(`/babies/${currentBabyId}/feedings`) ?? false} collapsed={collapsed} tint="coral" />
                  <NavItem href={`/babies/${currentBabyId}/stool`}         icon={Droplet}     label={t('nav.stool')}        active={pathname?.startsWith(`/babies/${currentBabyId}/stool`) ?? false}    collapsed={collapsed} tint="mint" />
                  <NavItem href={`/babies/${currentBabyId}/sleep`}         icon={Moon}        label={t('nav.sleep')}        active={pathname?.startsWith(`/babies/${currentBabyId}/sleep`) ?? false} collapsed={collapsed} tint="lavender" />
                  <NavItem href={`/babies/${currentBabyId}/temperature`}   icon={Thermometer} label={t('nav.temperature')}  active={pathname?.startsWith(`/babies/${currentBabyId}/temperature`) ?? false} collapsed={collapsed} tint="peach" />
                  <NavItem href={`/babies/${currentBabyId}/measurements`}  icon={Ruler}       label={t('nav.measurements')} active={pathname?.startsWith(`/babies/${currentBabyId}/measurements`) ?? false} collapsed={collapsed} tint="brand" />
                </NavCategory>

                <NavCategory id="baby_care" label={t('nav.cat_care')} icon={Stethoscope} collapsed={collapsed}
                  open={isCatOpen('baby_care')} onToggle={() => toggleCat('baby_care')}>
                  <NavItem href={`/babies/${currentBabyId}/medications`}   icon={Pill}        label={t('nav.medications')}  active={pathname?.startsWith(`/babies/${currentBabyId}/medications`) ?? false} collapsed={collapsed} tint="lavender" />
                  <NavItem href={`/babies/${currentBabyId}/vaccinations`}  icon={Syringe}     label={t('nav.vaccinations')} active={pathname?.startsWith(`/babies/${currentBabyId}/vaccinations`) ?? false} collapsed={collapsed} tint="lavender" />
                  <NavItem href={`/babies/${currentBabyId}/labs`}          icon={FlaskConical} label={t('nav.labs_scans')}  active={pathname?.startsWith(`/babies/${currentBabyId}/labs`) ?? false} collapsed={collapsed} tint="peach" />
                  {isParent && <NavItem href={`/babies/${currentBabyId}/doctors`} icon={CalendarClock} label={t('nav.appointments')} active={pathname?.startsWith(`/babies/${currentBabyId}/doctors`) ?? false} collapsed={collapsed} tint="brand" />}
                </NavCategory>

                <NavCategory id="baby_dev" label={t('nav.cat_development')} icon={Activity} collapsed={collapsed}
                  open={isCatOpen('baby_dev')} onToggle={() => toggleCat('baby_dev')}>
                  <NavItem href={`/babies/${currentBabyId}/activities`}    icon={Activity}      label={t('nav.activities')}   active={pathname?.startsWith(`/babies/${currentBabyId}/activities`) ?? false} collapsed={collapsed} tint="mint" />
                  <NavItem href={`/babies/${currentBabyId}/teething`}      icon={Smile}         label={t('nav.teething')}     active={pathname?.startsWith(`/babies/${currentBabyId}/teething`) ?? false} collapsed={collapsed} tint="peach" />
                  <NavItem href={`/babies/${currentBabyId}/speaking`}      icon={MessageCircle} label={t('nav.speaking')}     active={pathname?.startsWith(`/babies/${currentBabyId}/speaking`) ?? false} collapsed={collapsed} tint="brand" />
                  <NavItem href={`/babies/${currentBabyId}/screen-time`}   icon={Tv}            label={t('nav.screen_time')}  active={pathname?.startsWith(`/babies/${currentBabyId}/screen-time`) ?? false} collapsed={collapsed} tint="lavender" />
                </NavCategory>

                <NavCategory id="baby_records" label={t('nav.cat_records')} icon={FileText} collapsed={collapsed}
                  open={isCatOpen('baby_records')} onToggle={() => toggleCat('baby_records')}>
                  <NavItem href={`/babies/${currentBabyId}/ocr`}             icon={FileText}   label={t('nav.files')} active={(pathname?.startsWith(`/babies/${currentBabyId}/ocr`) || pathname?.startsWith(`/babies/${currentBabyId}/files`) || pathname?.startsWith(`/babies/${currentBabyId}/upload`)) ?? false} collapsed={collapsed} tint="coral" />
                  <NavItem href={`/babies/${currentBabyId}/medical-profile`} icon={HeartPulse} label={t('nav.medical_profile')} active={pathname?.startsWith(`/babies/${currentBabyId}/medical-profile`) ?? false} collapsed={collapsed} tint="lavender" />
                  {canExport && <NavItem href={`/babies/${currentBabyId}/reports`} icon={BarChart3} label={t('nav.reports')} active={pathname?.startsWith(`/babies/${currentBabyId}/reports`) ?? false} collapsed={collapsed} tint="peach" />}
                  <NavItem href={`/babies/${currentBabyId}/shopping`}        icon={ShoppingCart} label={t('nav.shopping')} active={pathname?.startsWith(`/babies/${currentBabyId}/shopping`) ?? false} collapsed={collapsed} tint="mint" />
                </NavCategory>
              </>
            )}

            {isParent && (
              <NavCategory id="settings_family" label={t('nav.cat_family')} icon={Users} collapsed={collapsed}
                open={isCatOpen('settings_family')} onToggle={() => toggleCat('settings_family')}>
                {isPregnancy && (
                  <NavItem href={`/babies/${currentBabyId}/prenatal/profile`} icon={Heart} label="Pregnancy profile" active={pathname?.startsWith(`/babies/${currentBabyId}/prenatal/profile`) ?? false} collapsed={collapsed} tint="coral" />
                )}
                <NavItem href={`/babies/${currentBabyId}/doctors`}    icon={Stethoscope} label={t('nav.doctors')}    active={pathname?.startsWith(`/babies/${currentBabyId}/doctors`) ?? false}    collapsed={collapsed} tint="lavender" />
                <NavItem href={`/babies/${currentBabyId}/caregivers`} icon={Users}       label={t('nav.caregivers')} active={pathname?.startsWith(`/babies/${currentBabyId}/caregivers`) ?? false} collapsed={collapsed} tint="mint" />
                <NavItem href={`/babies/${currentBabyId}/edit`}       icon={UserCog}     label="Profile"             active={pathname?.startsWith(`/babies/${currentBabyId}/edit`) ?? false}       collapsed={collapsed} tint="brand" />
                <NavItem href="/preferences"                          icon={Settings}    label={t('nav.preferences')} active={pathname?.startsWith('/preferences') ?? false} collapsed={collapsed} tint="brand" />
              </NavCategory>
            )}

            {/* Preferences is always reachable — even for non-parents on a baby. */}
            {!isParent && (
              <NavGroup label="" collapsed={collapsed}>
                <NavItem href="/preferences" icon={Settings} label={t('nav.preferences')}
                  active={pathname?.startsWith('/preferences') ?? false} collapsed={collapsed} tint="brand" />
              </NavGroup>
            )}
          </>
        )}

        {/* Preferences when no baby is selected (e.g. on /dashboard). */}
        {!currentBabyId && (
          <NavGroup label="" collapsed={collapsed}>
            <NavItem href="/preferences" icon={Settings} label={t('nav.preferences')}
              active={pathname?.startsWith('/preferences') ?? false} collapsed={collapsed} tint="brand" />
          </NavGroup>
        )}
      </nav>

      {/* Quick Log promo card — only for roles that can actually write logs. */}
      {currentBabyId && !collapsed && isParent && (
        <div className="px-4 pb-3">
          <Link href={`/babies/${currentBabyId}/feedings/new`}
            className="relative overflow-hidden flex items-center gap-3 rounded-2xl bg-gradient-to-r from-coral-100 to-peach-100 border border-coral-200 p-3 hover:shadow-panel transition">
            <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-coral-200 opacity-60 blur-2xl" />
            <div className="relative h-10 w-10 rounded-xl bg-white/90 shadow-sm grid place-items-center shrink-0">
              <Sparkles className="h-5 w-5 text-coral-500" />
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="font-semibold text-coral-700 text-sm">Quick Log</div>
              <div className="text-xs text-ink-muted">Log in one tap</div>
            </div>
            <div className="relative h-8 w-8 rounded-full bg-coral-500 text-white grid place-items-center shrink-0 shadow-sm">
              <Plus className="h-4 w-4" />
            </div>
          </Link>
        </div>
      )}

      {/* User footer */}
      <div className={cn('border-t border-slate-200/80 bg-white/60', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center shrink-0 text-xs font-bold">
              {(email ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-ink truncate">{email ?? 'Signed in'}</div>
              <button onClick={logout} className="text-xs text-ink-muted hover:text-coral-600 inline-flex items-center gap-1">
                <LogOut className="h-3 w-3" /> Log out
              </button>
            </div>
          </div>
        ) : (
          <button onClick={logout} className="w-full grid place-items-center h-10 rounded-lg hover:bg-slate-100 text-ink-muted" title="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 h-14 bg-gradient-to-r from-white via-brand-50/60 to-coral-50/60 border-b border-slate-200/70 px-3 flex items-center gap-2 backdrop-blur">
        <button
          className="h-10 w-10 grid place-items-center rounded-md hover:bg-white/70"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-ink" />
        </button>
        <Link href="/dashboard"><Wordmark size="sm" /></Link>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn('lg:hidden fixed inset-0 z-40', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      >
        <div
          className={cn('absolute inset-0 bg-black/40 sidebar-transition', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200/70 sidebar-transition',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {SidebarInner}
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex fixed inset-y-0 left-0 bg-white border-r border-slate-200/70 sidebar-transition z-30',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {SidebarInner}
      </aside>
    </>
  );
}

function prettyAge(dobIso: string | null): string {
  if (!dobIso) return '';
  const days = ageInDays(dobIso);
  if (days < 60) return `${days} days old`;
  const months = Math.floor(days / 30);
  const remainingDays = days - months * 30;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}, ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const remMonths = months - years * 12;
  return `${years} year${years === 1 ? '' : 's'}${remMonths ? `, ${remMonths} mo` : ''}`;
}

/** Stage-aware label for the sidebar baby card. */
function babyCardLabel(b: BabyRow): string {
  const stage = effectiveStage(b.lifecycle_stage ?? null, b.dob);
  if (stage === 'pregnancy') {
    return `Expecting · ${fmtGestationalAge(b.edd ?? null, b.lmp ?? null)}`;
  }
  return prettyAge(b.dob);
}

// ---- Subcomponents --------------------------------------------------------

function NavGroup({ label, children, collapsed }: { label: string; children: React.ReactNode; collapsed: boolean }) {
  return (
    <div>
      {collapsed ? (
        label ? <div className="mx-auto my-2 h-px w-8 bg-slate-200" aria-hidden /> : null
      ) : (
        label ? <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</div> : null
      )}
      <div className={cn(collapsed ? 'space-y-1' : 'space-y-0.5')}>{children}</div>
    </div>
  );
}

/**
 * Expandable category header. When the sidebar is collapsed (icon rail),
 * the header is hidden — children render flush like before, with a divider
 * between groups. When the sidebar is expanded, the user can click the
 * header chevron to collapse the group and tighten the rail.
 */
function NavCategory({
  id, label, icon: Icon, collapsed, open, onToggle, children,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (collapsed) {
    // Icon rail: just show the children with a thin divider above.
    return (
      <div>
        <div className="mx-auto my-2 h-px w-8 bg-slate-200" aria-hidden />
        <div className="space-y-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`navcat-${id}`}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100/70 transition group"
      >
        <span className="h-7 w-7 rounded-lg grid place-items-center text-ink-muted bg-white border border-slate-200 group-hover:border-brand-200 group-hover:text-brand-600 shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div id={`navcat-${id}`} className="mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
}

type Tint = 'brand' | 'mint' | 'coral' | 'peach' | 'lavender';

const ACTIVE_BAR: Record<Tint, string> = {
  brand: 'bg-brand-500',
  mint: 'bg-mint-500',
  coral: 'bg-coral-500',
  peach: 'bg-peach-500',
  lavender: 'bg-lavender-500',
};
const ACTIVE_BG: Record<Tint, string> = {
  brand: 'bg-brand-50 text-brand-700',
  mint: 'bg-mint-50 text-mint-700',
  coral: 'bg-coral-50 text-coral-700',
  peach: 'bg-peach-50 text-peach-700',
  lavender: 'bg-lavender-50 text-lavender-700',
};
const ACTIVE_ICON: Record<Tint, string> = {
  brand: 'text-brand-600',
  mint: 'text-mint-600',
  coral: 'text-coral-600',
  peach: 'text-peach-600',
  lavender: 'text-lavender-600',
};

function NavItem({
  href, icon: Icon, label, active, collapsed, tint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed: boolean;
  tint: Tint;
}) {
  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Link
          href={href}
          title={label} aria-label={label}
          className={cn(
            'grid place-items-center h-10 w-10 rounded-lg transition-colors',
            active ? ACTIVE_BG[tint] : 'text-ink hover:bg-slate-100',
          )}
        >
          <Icon className={cn('h-4 w-4', active ? ACTIVE_ICON[tint] : 'text-ink-muted')} />
        </Link>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        'relative flex items-center gap-3 rounded-xl pl-4 pr-3 py-2.5 text-sm transition-colors',
        active ? ACTIVE_BG[tint] : 'text-ink hover:bg-slate-100',
      )}
    >
      {active && <span className={cn('absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full', ACTIVE_BAR[tint])} />}
      <Icon className={cn('h-4 w-4 shrink-0', active ? ACTIVE_ICON[tint] : 'text-ink-muted')} />
      <span className="truncate font-medium">{label}</span>
    </Link>
  );
}

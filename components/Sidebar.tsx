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
import {
  LayoutDashboard, Clock, Milk, Droplet, Pill, Ruler, FileText, BarChart3, Users, UserCog,
  LogOut, Menu, X, ChevronLeft, Plus, Sparkles, ChevronsUpDown, Thermometer, Syringe, Moon,
} from 'lucide-react';

type BabyRow = { id: string; name: string; dob: string; avatar_path: string | null };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [babies, setBabies] = useState<BabyRow[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [babySwitcherOpen, setBabySwitcherOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bx:sidebar-collapsed');
      if (saved === '1') setCollapsed(true);
    } catch { /* ignore */ }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase.from('babies')
      .select('id,name,dob,avatar_path')
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

  const currentBabyId = useMemo(() => {
    const m = pathname?.match(/^\/babies\/([0-9a-f-]{8,})/i);
    return m ? m[1] : null;
  }, [pathname]);

  const currentBaby = currentBabyId
    ? (babies.find(b => b.id === currentBabyId) ?? null)
    : null;

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
              <div className="text-xs text-ink-muted">{prettyAge(currentBaby.dob)}</div>
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

      {/* Nav sections */}
      <nav className={cn('flex-1 overflow-y-auto space-y-5', collapsed ? 'px-2 py-3' : 'px-3 py-4')}>
        <NavGroup label="HOME" collapsed={collapsed}>
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/dashboard'} collapsed={collapsed} tint="brand" />
        </NavGroup>

        {currentBabyId && (
          <>
            <NavGroup label="TRACK" collapsed={collapsed}>
              <NavItem href={`/babies/${currentBabyId}`}               icon={Clock}     label="Overview"     active={pathname === `/babies/${currentBabyId}`}                       collapsed={collapsed} tint="brand" />
              <NavItem href={`/babies/${currentBabyId}/feedings`}      icon={Milk}      label="Feedings"     active={pathname?.startsWith(`/babies/${currentBabyId}/feedings`) ?? false} collapsed={collapsed} tint="coral" />
              <NavItem href={`/babies/${currentBabyId}/stool`}         icon={Droplet}   label="Stool"        active={pathname?.startsWith(`/babies/${currentBabyId}/stool`) ?? false}    collapsed={collapsed} tint="mint" />
              <NavItem href={`/babies/${currentBabyId}/medications`}   icon={Pill}      label="Medications"  active={pathname?.startsWith(`/babies/${currentBabyId}/medications`) ?? false} collapsed={collapsed} tint="lavender" />
              <NavItem href={`/babies/${currentBabyId}/measurements`}  icon={Ruler}     label="Measurements" active={pathname?.startsWith(`/babies/${currentBabyId}/measurements`) ?? false} collapsed={collapsed} tint="brand" />
              <NavItem href={`/babies/${currentBabyId}/temperature`}   icon={Thermometer} label="Temperature"  active={pathname?.startsWith(`/babies/${currentBabyId}/temperature`) ?? false} collapsed={collapsed} tint="peach" />
              <NavItem href={`/babies/${currentBabyId}/sleep`}         icon={Moon}      label="Sleep"        active={pathname?.startsWith(`/babies/${currentBabyId}/sleep`) ?? false} collapsed={collapsed} tint="lavender" />
              <NavItem href={`/babies/${currentBabyId}/vaccinations`}  icon={Syringe}   label="Vaccinations" active={pathname?.startsWith(`/babies/${currentBabyId}/vaccinations`) ?? false} collapsed={collapsed} tint="lavender" />
            </NavGroup>

            <NavGroup label="TOOLS" collapsed={collapsed}>
              <NavItem href={`/babies/${currentBabyId}/ocr`}     icon={FileText}  label="Smart Scan" active={(pathname?.startsWith(`/babies/${currentBabyId}/ocr`) || pathname?.startsWith(`/babies/${currentBabyId}/files`) || pathname?.startsWith(`/babies/${currentBabyId}/upload`)) ?? false} collapsed={collapsed} tint="coral" />
              <NavItem href={`/babies/${currentBabyId}/reports`} icon={BarChart3} label="Reports"    active={pathname?.startsWith(`/babies/${currentBabyId}/reports`) ?? false} collapsed={collapsed} tint="peach" />
            </NavGroup>

            <NavGroup label="SETTINGS" collapsed={collapsed}>
              <NavItem href={`/babies/${currentBabyId}/caregivers`} icon={Users}   label="Caregivers"    active={pathname?.startsWith(`/babies/${currentBabyId}/caregivers`) ?? false} collapsed={collapsed} tint="mint" />
              <NavItem href={`/babies/${currentBabyId}/edit`}       icon={UserCog} label="Profile"       active={pathname?.startsWith(`/babies/${currentBabyId}/edit`) ?? false}       collapsed={collapsed} tint="brand" />
            </NavGroup>
          </>
        )}
      </nav>

      {/* Quick Log promo card */}
      {currentBabyId && !collapsed && (
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

function prettyAge(dobIso: string): string {
  const days = ageInDays(dobIso);
  if (days < 60) return `${days} days old`;
  const months = Math.floor(days / 30);
  const remainingDays = days - months * 30;
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}, ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const remMonths = months - years * 12;
  return `${years} year${years === 1 ? '' : 's'}${remMonths ? `, ${remMonths} mo` : ''}`;
}

// ---- Subcomponents --------------------------------------------------------

function NavGroup({ label, children, collapsed }: { label: string; children: React.ReactNode; collapsed: boolean }) {
  return (
    <div>
      {collapsed ? (
        <div className="mx-auto my-2 h-px w-8 bg-slate-200" aria-hidden />
      ) : (
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-muted">{label}</div>
      )}
      <div className={cn(collapsed ? 'space-y-1' : 'space-y-0.5')}>{children}</div>
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Baby, Milk, Droplet, Ruler, Pill, FileText, Users, Pencil, Upload, LogOut,
  ChevronLeft, Menu, X, Plus, BarChart3,
} from 'lucide-react';

type BabySummary = { id: string; name: string };

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Collapse state persists to localStorage on the client.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [babies, setBabies] = useState<BabySummary[]>([]);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bx:sidebar-collapsed');
      if (saved === '1') setCollapsed(true);
    } catch { /* ignore */ }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    supabase.from('babies')
      .select('id,name')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBabies((data ?? []) as BabySummary[]));
  }, [pathname]);

  useEffect(() => {
    try { localStorage.setItem('bx:sidebar-collapsed', collapsed ? '1' : '0'); }
    catch { /* ignore */ }
    // Let the content area respond via CSS class on <body>.
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('is-sidebar-collapsed', collapsed);
    }
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Extract current baby id from URL, if any.
  const currentBabyId = useMemo(() => {
    const m = pathname?.match(/^\/babies\/([0-9a-f-]{8,})/i);
    return m ? m[1] : null;
  }, [pathname]);

  const currentBaby = babies.find(b => b.id === currentBabyId);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const SidebarInner = (
    <div className="h-full flex flex-col relative">
      {/* Header with logo */}
      <div className={cn('flex items-center h-16 border-b border-slate-200', collapsed ? 'justify-center px-2' : 'px-4 gap-3')}>
        <Link href="/dashboard" className={cn('flex items-center min-w-0', collapsed ? 'justify-center' : 'gap-2')} title="Babylytics">
          {!logoError
            ? // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/Logo.png"
                alt="Babylytics"
                className="h-9 w-9 shrink-0 rounded-md object-cover"
                onError={() => setLogoError(true)}
              />
            : <div className="h-9 w-9 shrink-0 rounded-md bg-brand-500 text-white grid place-items-center text-sm font-bold">B</div>}
          {!collapsed && <span className="font-semibold truncate text-ink-strong">Babylytics</span>}
        </Link>
        {/* Mobile close button (visible only when drawer is open on mobile) */}
        <button
          className="ml-auto lg:hidden h-8 w-8 grid place-items-center rounded-md hover:bg-slate-100"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4 text-ink-muted" />
        </button>
      </div>

      {/* Floating collapse toggle — hangs off the right edge, desktop only.
          Sits exactly on the sidebar border so it never collides with content. */}
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand' : 'Collapse'}
        className="hidden lg:grid absolute top-5 -right-3 z-40 h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-ink-muted hover:text-brand-600 hover:border-brand-300 shadow-sm"
      >
        <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform', collapsed && 'rotate-180')} />
      </button>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        <Section collapsed={collapsed} label="Home">
          <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" active={pathname === '/dashboard'} collapsed={collapsed} />
        </Section>

        {currentBaby && currentBabyId && (
          <>
            <Section collapsed={collapsed} label={currentBaby.name.toUpperCase()}>
              <NavItem href={`/babies/${currentBabyId}`}               icon={Baby}     label="Overview"     active={pathname === `/babies/${currentBabyId}`}               collapsed={collapsed} />
              <NavItem href={`/babies/${currentBabyId}/feedings`}      icon={Milk}     label="Feedings"     active={pathname?.startsWith(`/babies/${currentBabyId}/feedings`)} collapsed={collapsed} tint="peach" />
              <NavItem href={`/babies/${currentBabyId}/stool`}         icon={Droplet}  label="Stool"        active={pathname?.startsWith(`/babies/${currentBabyId}/stool`)}    collapsed={collapsed} tint="mint" />
              <NavItem href={`/babies/${currentBabyId}/measurements`}  icon={Ruler}    label="Measurements" active={pathname?.startsWith(`/babies/${currentBabyId}/measurements`)} collapsed={collapsed} />
              <NavItem href={`/babies/${currentBabyId}/medications`}   icon={Pill}     label="Medications"  active={pathname?.startsWith(`/babies/${currentBabyId}/medications`)}  collapsed={collapsed} tint="lavender" />
              <NavItem href={`/babies/${currentBabyId}/ocr`}           icon={FileText} label="OCR inbox"    active={pathname?.startsWith(`/babies/${currentBabyId}/ocr`) || pathname?.startsWith(`/babies/${currentBabyId}/files`)} collapsed={collapsed} />
              <NavItem href={`/babies/${currentBabyId}/reports`}       icon={BarChart3} label="Reports"     active={pathname?.startsWith(`/babies/${currentBabyId}/reports`)}      collapsed={collapsed} tint="brand" />
              <NavItem href={`/babies/${currentBabyId}/caregivers`}    icon={Users}    label="Caregivers"   active={pathname?.startsWith(`/babies/${currentBabyId}/caregivers`)}   collapsed={collapsed} />
              <NavItem href={`/babies/${currentBabyId}/edit`}          icon={Pencil}   label="Edit profile" active={pathname?.startsWith(`/babies/${currentBabyId}/edit`)}         collapsed={collapsed} />
            </Section>

            <Section collapsed={collapsed} label="Quick log">
              <QuickAction href={`/babies/${currentBabyId}/feedings/new`}     icon={Milk}    label="Log feed"        tint="peach"    collapsed={collapsed} />
              <QuickAction href={`/babies/${currentBabyId}/stool/new`}        icon={Droplet} label="Log stool"       tint="mint"     collapsed={collapsed} />
              <QuickAction href={`/babies/${currentBabyId}/medications/log`}  icon={Pill}    label="Log dose"        tint="lavender" collapsed={collapsed} />
              <QuickAction href={`/babies/${currentBabyId}/measurements/new`} icon={Ruler}   label="Log measurement" tint="brand"    collapsed={collapsed} />
              <QuickAction href={`/babies/${currentBabyId}/upload`}           icon={Upload}  label="Upload file"     tint="coral"    collapsed={collapsed} />
            </Section>
          </>
        )}

        {babies.length > 0 && (
          <Section collapsed={collapsed} label="Babies">
            {babies.map(b => (
              <NavItem
                key={b.id}
                href={`/babies/${b.id}`}
                icon={Baby}
                label={b.name}
                active={currentBabyId === b.id}
                collapsed={collapsed}
              />
            ))}
            <NavItem href="/babies/new" icon={Plus} label="Add baby" active={pathname === '/babies/new'} collapsed={collapsed} />
          </Section>
        )}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-slate-200', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && email && <div className="text-xs text-ink-muted truncate mb-2 px-1">{email}</div>}
        {collapsed ? (
          <div className="flex justify-center">
            <button
              onClick={logout}
              className="grid place-items-center h-10 w-10 rounded-lg hover:bg-slate-100 text-ink"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm w-full hover:bg-slate-100 text-ink"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-3 flex items-center gap-2">
        <button
          className="h-10 w-10 grid place-items-center rounded-md hover:bg-slate-100"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-ink" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          {!logoError
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src="/Logo.png" alt="" className="h-7 w-7 rounded-md object-cover" onError={() => setLogoError(true)} />
            : <div className="h-7 w-7 rounded-md bg-brand-500 text-white grid place-items-center text-sm font-bold">B</div>}
          <span className="font-semibold text-ink">Babylytics</span>
        </Link>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-40',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div
          className={cn('absolute inset-0 bg-black/40 sidebar-transition', mobileOpen ? 'opacity-100' : 'opacity-0')}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200 sidebar-transition',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {SidebarInner}
        </aside>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex fixed inset-y-0 left-0 bg-white border-r border-slate-200 sidebar-transition z-30',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {SidebarInner}
      </aside>
    </>
  );
}

// ---- Subcomponents --------------------------------------------------------

function Section({ label, children, collapsed }: { label: string; children: React.ReactNode; collapsed: boolean }) {
  return (
    <div>
      {collapsed ? (
        <div className="mx-auto my-2 h-px w-8 bg-slate-200" aria-hidden />
      ) : (
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</div>
      )}
      <div className={cn(collapsed ? 'space-y-1' : 'space-y-0.5')}>{children}</div>
    </div>
  );
}

type Tint = 'brand' | 'mint' | 'coral' | 'lavender' | 'peach';

const tintActive: Record<Tint, string> = {
  brand:    'bg-brand-50 text-brand-700',
  mint:     'bg-mint-50 text-mint-700',
  coral:    'bg-coral-50 text-coral-700',
  lavender: 'bg-lavender-50 text-lavender-700',
  peach:    'bg-peach-50 text-peach-700',
};

const tintIcon: Record<Tint, string> = {
  brand:    'text-brand-500',
  mint:     'text-mint-600',
  coral:    'text-coral-600',
  lavender: 'text-lavender-600',
  peach:    'text-peach-600',
};

function NavItem({
  href, icon: Icon, label, active, collapsed, tint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  collapsed: boolean;
  tint?: Tint;
}) {
  const effectiveTint: Tint = tint ?? 'brand';

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Link
          href={href}
          title={label}
          aria-label={label}
          className={cn(
            'grid place-items-center h-10 w-10 rounded-lg transition-colors',
            active ? tintActive[effectiveTint] : 'text-ink hover:bg-slate-100',
          )}
        >
          <Icon className={cn('h-4 w-4', active ? tintIcon[effectiveTint] : 'text-ink-muted')} />
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
        active ? tintActive[effectiveTint] : 'text-ink hover:bg-slate-100',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? tintIcon[effectiveTint] : 'text-ink-muted')} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function QuickAction({
  href, icon: Icon, label, collapsed, tint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  tint: Tint;
}) {
  const bgMap: Record<Tint, string> = {
    brand:    'bg-brand-500 hover:bg-brand-600',
    mint:     'bg-mint-500 hover:bg-mint-600',
    coral:    'bg-coral-500 hover:bg-coral-600',
    lavender: 'bg-lavender-500 hover:bg-lavender-600',
    peach:    'bg-peach-500 hover:bg-peach-600',
  };

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <Link
          href={href}
          title={label}
          aria-label={label}
          className={cn(
            'grid place-items-center h-10 w-10 rounded-lg text-white shadow-sm transition-colors',
            bgMap[tint],
          )}
        >
          <Icon className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-white shadow-sm transition-colors',
        bgMap[tint],
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// Small helper for ink-muted if not present in Tailwind — we rely on arbitrary values via config tokens below.

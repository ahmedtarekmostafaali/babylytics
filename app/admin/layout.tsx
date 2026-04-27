import Link from 'next/link';
import { assertAdmin } from '@/lib/admin-guard';
import { LayoutDashboard, Users, Activity, MessageSquare, ShieldCheck } from 'lucide-react';

// Server-rendered admin shell. Forwards every /admin/* page through the
// platform-admin guard (404s for everyone else) and renders a small sub-nav
// at the top. Intentionally English-only — internal tool.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await assertAdmin();
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-20">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-brand-500 to-lavender-500 text-white grid place-items-center shadow-card">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Babylytics</div>
            <h1 className="text-2xl font-bold text-ink-strong tracking-tight">Admin</h1>
          </div>
        </div>
      </header>

      <nav className="mb-6 inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 shadow-card p-1 flex-wrap">
        <SubNavLink href="/admin"           icon={LayoutDashboard} label="Overview" />
        <SubNavLink href="/admin/users"     icon={Users}           label="Users" />
        <SubNavLink href="/admin/engagement" icon={Activity}       label="Engagement" />
        <SubNavLink href="/admin/feedback"  icon={MessageSquare}   label="Feedback" />
      </nav>

      {children}
    </div>
  );
}

// SubNavLink is a server component — no active state highlighting (Next would
// need usePathname, which is client-side). The pages themselves carry their
// own H2 so users always know where they are.
function SubNavLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link href={href}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-ink hover:bg-slate-50 hover:text-ink-strong transition">
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

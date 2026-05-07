'use client';

// MobileBottomNav — Wave 43. Always-visible bottom bar on mobile that
// gives one-tap access to the 5 primary destinations: Profiles, Forum,
// Quick Log (centered + emphasized), What's new, Account. Hidden on
// lg+ where the sidebar covers everything.
//
// Safe-area-inset aware so it sits above the iOS home indicator + the
// Android navigation bar without overlap. The `pb-[env(safe-area-inset
// -bottom)]` calc handles both.
//
// The Quick Log centered button doesn't navigate — it opens an
// inline bottom sheet with quick-log shortcuts tuned to the active
// profile's stage. Until that's wired, it routes to the active
// baby's overview where the existing log buttons live.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MessagesSquare, Plus, Megaphone, UserCog, MessageCircle } from 'lucide-react';

/** The bar is rendered from the root layout for ALL signed-in users.
 *  We pass the optional currentBabyId so Quick Log can link into the
 *  active profile when there is one. */
export function MobileBottomNav({
  currentBabyId,
  unreadCount = 0,
}: {
  currentBabyId?: string | null;
  unreadCount?: number;
}) {
  const pathname = usePathname() ?? '';
  // Hide on auth + onboarding flows — these are full-screen wizards.
  if (pathname.startsWith('/login') || pathname.startsWith('/register')
      || pathname === '/' || pathname.startsWith('/legal')) {
    return null;
  }

  const quickLogHref = currentBabyId
    ? `/babies/${currentBabyId}`
    : '/dashboard';

  // Wave 45A: when on a baby page, derive the active baby ID from the
  // pathname so we can show a Chat shortcut in slot 4 (Chat is per-
  // baby and was buried in the sidebar's Family category before).
  // When NOT on a baby page, slot 4 falls back to Updates.
  const babyMatch = pathname.match(/^\/babies\/([^\/]+)/);
  const activeBabyId = babyMatch?.[1] ?? currentBabyId ?? null;

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around relative">
        <Item href="/dashboard"   icon={LayoutDashboard} label="Home"
              active={pathname === '/dashboard' || pathname.startsWith('/babies')} />
        <Item href="/forum"       icon={MessagesSquare}  label="Forum"
              active={pathname.startsWith('/forum')} />
        {/* Centered Quick Log — visually elevated. */}
        <li className="-mt-5 flex-1 flex items-start justify-center">
          <Link href={quickLogHref}
            className="h-14 w-14 rounded-full bg-gradient-to-br from-coral-500 to-coral-600 text-white grid place-items-center shadow-panel hover:scale-105 transition"
            aria-label="Quick log">
            <Plus className="h-6 w-6" />
          </Link>
        </li>
        {/* Wave 45A: slot 4 — Chat when on a baby page, Updates otherwise. */}
        {activeBabyId ? (
          <Item href={`/babies/${activeBabyId}/chat`} icon={MessageCircle} label="Chat"
                active={pathname.includes(`/babies/${activeBabyId}/chat`)} />
        ) : (
          <Item href="/updates" icon={Megaphone} label="Updates"
                active={pathname.startsWith('/updates')}
                badge={unreadCount > 0 ? Math.min(unreadCount, 99) : null} />
        )}
        <Item href="/preferences" icon={UserCog} label="Account"
              active={pathname.startsWith('/preferences')} />
      </ul>
    </nav>
  );
}

function Item({
  href, icon: Icon, label, active, badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  badge?: number | null;
}) {
  return (
    <li className="flex-1">
      <Link href={href}
        className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[10px] font-semibold transition ${
          active ? 'text-coral-600' : 'text-ink-muted hover:text-ink-strong'
        }`}>
        <Icon className="h-5 w-5" aria-hidden />
        <span>{label}</span>
        {badge != null && (
          <span className="absolute top-1 right-[20%] min-w-[18px] h-[18px] rounded-full bg-coral-500 text-white text-[9px] font-bold grid place-items-center px-1">
            {badge}
          </span>
        )}
      </Link>
    </li>
  );
}

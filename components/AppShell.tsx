'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { HeartConfetti } from '@/components/HeartConfetti';
import { LegalFooter } from '@/components/LegalFooter';
import { MobileBottomNav } from '@/components/MobileBottomNav';

// Paths that render WITHOUT the authenticated sidebar (landing, auth screens).
const PUBLIC_PATHS = ['/', '/login', '/register', '/privacy', '/terms', '/disclaimer'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1">{children}</div>
        <LegalFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Brand-coloured hearts layer behind everything else */}
      <HeartConfetti />
      <Sidebar />
      {/* main.with-sidebar gets its left padding from a CSS rule in globals.css
          that listens to body.is-sidebar-collapsed toggled by the Sidebar.
          Wave 43: pb-24 on mobile reserves space under the new bottom nav
          + safe-area padding for iOS home indicator / Android nav bar. */}
      <main className="with-sidebar min-h-screen relative z-10 flex-1 pb-20 lg:pb-0">
        {children}
      </main>
      <div className="with-sidebar relative z-10 hidden lg:block">
        <LegalFooter />
      </div>
      {/* Wave 43: mobile bottom navigation. Hidden on lg+ where the
          sidebar covers everything. */}
      <MobileBottomNav />
    </div>
  );
}

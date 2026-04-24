'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { HeartConfetti } from '@/components/HeartConfetti';
import { LegalFooter } from '@/components/LegalFooter';

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
          that listens to body.is-sidebar-collapsed toggled by the Sidebar. */}
      <main className="with-sidebar min-h-screen relative z-10 flex-1">
        {children}
      </main>
      <div className="with-sidebar relative z-10">
        <LegalFooter />
      </div>
    </div>
  );
}

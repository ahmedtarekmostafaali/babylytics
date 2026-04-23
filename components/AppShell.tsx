'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

// Paths that render WITHOUT the authenticated sidebar (landing, auth screens).
const PUBLIC_PATHS = ['/', '/login', '/register'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      {/* main.with-sidebar gets its left padding from a CSS rule in globals.css
          that listens to body.is-sidebar-collapsed toggled by the Sidebar. */}
      <main className="with-sidebar min-h-screen">
        {children}
      </main>
    </div>
  );
}

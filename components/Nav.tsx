'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n/client';

export function Nav({ email }: { email?: string | null }) {
  const router = useRouter();
  const t = useT();
  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" dir="ltr" className="font-bold tracking-tight">Babylytics</Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-700">
          <Link href="/dashboard" className="hover:text-brand-600">{t('topnav.dashboard')}</Link>
          <Link href="/babies"    className="hover:text-brand-600">{t('topnav.babies')}</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          {email && <span className="hidden sm:inline text-slate-500">{email}</span>}
          <Button variant="secondary" size="sm" onClick={logout}>{t('topnav.log_out')}</Button>
        </div>
      </div>
    </header>
  );
}

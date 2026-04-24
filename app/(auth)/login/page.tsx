'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { AuthSidePanel } from '@/components/AuthSidePanel';
import { Wordmark } from '@/components/Wordmark';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
      <h1 className="text-3xl font-bold tracking-tight text-ink-strong">Welcome back</h1>
      <p className="mt-2 text-ink">Hello, glad to see you again.</p>

      <form className="mt-8 space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" required value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        {err && <p className="text-sm text-coral-600">{err}</p>}
        <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>{loading ? 'Signing in…' : 'Log in'}</Button>
      </form>

      <p className="mt-6 text-sm text-ink-muted text-center">
        No account?{' '}
        <Link href="/register" className="text-coral-600 font-medium hover:underline">Sign up free</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex">
      <AuthSidePanel
        title="Track today. Nurture tomorrow."
        subtitle="Clinical-grade baby tracking with handwritten-note OCR. Welcome back — your data is right where you left it."
      />
      <div className="flex-1 grid place-items-center px-4 py-12 bg-white">
        <Suspense fallback={<div className="text-sm text-ink-muted">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}

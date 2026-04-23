'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

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
    <Card className="w-full max-w-sm">
      <CardHeader><CardTitle className="text-base">Log in to Babylytics</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Log in'}</Button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          No account? <Link href="/register" className="text-brand-600 hover:underline">Register</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <Suspense fallback={<Card className="w-full max-w-sm"><CardContent className="py-8 text-center text-sm text-slate-500">Loading…</CardContent></Card>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (!data.session) {
      setMsg('Account created. Check your email to confirm, then log in.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle className="text-base">Create your Babylytics account</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" required value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
              <p className="text-xs text-slate-500 mt-1">At least 8 characters.</p>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
          </form>
          <p className="mt-4 text-sm text-slate-600">
            Have an account? <Link href="/login" className="text-brand-600 hover:underline">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

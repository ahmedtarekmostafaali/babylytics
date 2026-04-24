'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { AuthSidePanel } from '@/components/AuthSidePanel';
import { Wordmark } from '@/components/Wordmark';

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
    <main className="min-h-screen flex">
      <AuthSidePanel
        title="Start your baby's journey."
        subtitle="Log feedings, stools, medications and growth. Upload handwritten notes — we digitize and file them away."
      />
      <div className="flex-1 grid place-items-center px-4 py-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-strong">Create your account</h1>
          <p className="mt-2 text-ink">Just a few quick things to get started.</p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <div>
              <Label htmlFor="name">Your name</Label>
              <Input id="name" required placeholder="Ahmed" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {err && <p className="text-sm text-coral-600">{err}</p>}
            {msg && <p className="text-sm text-mint-700">{msg}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
          </form>

          <p className="mt-6 text-sm text-ink-muted text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

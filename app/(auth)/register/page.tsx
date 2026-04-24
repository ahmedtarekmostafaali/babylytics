'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Wordmark } from '@/components/Wordmark';
import { Check } from 'lucide-react';

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
      email, password,
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
      {/* Left: warm beige/coral panel */}
      <section className="hidden lg:flex w-5/12 relative overflow-hidden bg-gradient-to-br from-peach-100 via-beige/50 to-coral-100">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 500 900" preserveAspectRatio="none" aria-hidden>
          <circle cx="400" cy="200" r="120" fill="#FFF" opacity="0.45" />
          <circle cx="80"  cy="700" r="160" fill="#FFF" opacity="0.4" />
          <circle cx="350" cy="780" r="60"  fill="#FFF" opacity="0.5" />
        </svg>
        <div className="relative p-12 flex flex-col justify-between w-full">
          <Link href="/" className="inline-block"><Wordmark size="md" /></Link>

          <div className="space-y-6">
            <h2 className="text-4xl font-bold leading-tight text-ink-strong">
              Start your baby&apos;s journey with us.
            </h2>
            <p className="text-ink max-w-sm">
              Log feedings, stools, medications and growth. Upload handwritten notes — we digitize and file them away for every pediatrician visit.
            </p>
            <ul className="space-y-2 text-ink text-sm">
              <PerkRow>Free forever · no credit card</PerkRow>
              <PerkRow>English + Arabic handwritten-note OCR</PerkRow>
              <PerkRow>Owner / editor / viewer caregiver roles</PerkRow>
              <PerkRow>Printable clinical reports</PerkRow>
            </ul>
          </div>

          <div className="text-xs text-ink-muted">Trusted by parents and loved by babies.</div>
        </div>
      </section>

      {/* Right: form */}
      <section className="flex-1 grid place-items-center px-4 py-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Wordmark size="md" /></div>
          <h1 className="text-4xl font-bold tracking-tight text-ink-strong">Create your account</h1>
          <p className="mt-2 text-ink">Just a few quick things to get started.</p>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <Field label="Your name">
              <input required placeholder="Ahmed" value={displayName} onChange={e => setDisplayName(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <Field label="Email">
              <input type="email" required placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            <Field label="Password">
              <input type="password" required minLength={8} placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl bg-white border border-slate-200 px-4 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
            </Field>
            {err && <p className="text-sm text-coral-600">{err}</p>}
            {msg && <p className="text-sm text-mint-700">{msg}</p>}
            <button type="submit" disabled={loading}
              className="w-full h-12 rounded-2xl bg-coral-500 hover:bg-coral-600 text-white font-semibold shadow-sm disabled:opacity-60">
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-muted text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-600 font-semibold hover:underline">Log in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1">{label}</label>
      {children}
    </div>
  );
}

function PerkRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 h-5 w-5 rounded-full bg-mint-500 text-white grid place-items-center shrink-0">
        <Check className="h-3 w-3" />
      </span>
      {children}
    </li>
  );
}

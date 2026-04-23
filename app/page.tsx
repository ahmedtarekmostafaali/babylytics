import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-screen grid place-items-center px-6 py-16">
      <div className="max-w-2xl text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-500 text-white grid place-items-center text-2xl font-bold mb-6">B</div>
        <h1 className="text-4xl font-bold tracking-tight text-ink-strong">Babylytics</h1>
        <p className="mt-4 text-lg text-ink">
          A clinical-grade tracker for feedings, stools, medications, growth and medical records — with OCR review for handwritten daily reports in English and Arabic.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/login"    className="rounded-md bg-brand-500 px-5 py-2.5 text-white hover:bg-brand-600 transition">Log in</Link>
          <Link href="/register" className="rounded-md border border-slate-300 px-5 py-2.5 bg-white hover:bg-slate-50 transition">Create account</Link>
        </div>
        <ul className="mt-10 space-y-2 text-sm text-ink text-left mx-auto max-w-md">
          <li>• Owner / editor / viewer caregiver roles with row-level security.</li>
          <li>• Claude vision OCR for English, Arabic, and mixed handwritten notes.</li>
          <li>• Every OCR result is reviewed before it touches your data.</li>
          <li>• Per-field audit log on everything.</li>
        </ul>
      </div>
    </main>
  );
}

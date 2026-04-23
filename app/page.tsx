import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Babylytics</h1>
      <p className="mt-4 text-lg text-slate-600">
        A clinical-grade tracker for feedings, stools, medications, growth and
        medical records — with OCR review for handwritten daily reports.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login"    className="rounded-md bg-brand-500 px-4 py-2 text-white hover:bg-brand-600">Log in</Link>
        <Link href="/register" className="rounded-md border border-slate-300 px-4 py-2 hover:bg-white">Create account</Link>
      </div>
      <ul className="mt-10 space-y-2 text-slate-700">
        <li>• Owner / editor / viewer caregiver roles (RLS enforced).</li>
        <li>• Claude vision OCR for English, Arabic, and mixed handwritten notes.</li>
        <li>• Every OCR result is reviewed before it touches your data.</li>
        <li>• Per-field audit log on everything.</li>
      </ul>
    </main>
  );
}

'use client';

// ForumThreadCompose — collapsible "Start a thread" form at the top of
// the category thread list. Anonymous toggle inline. Clears + redirects
// to the new thread on success.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Plus, Loader2, EyeOff, Eye } from 'lucide-react';

export function ForumThreadCompose({
  categorySlug, lang = 'en',
}: {
  categorySlug: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || body.trim().length < 10) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('post_forum_thread', {
      p_category_slug: categorySlug,
      p_title: title.trim(),
      p_body:  body.trim(),
      p_anonymous: anon,
    });
    setBusy(false);
    if (error || !data) {
      setErr(error?.message ?? (isAr ? 'تعذر النشر' : 'Could not post'));
      return;
    }
    setTitle(''); setBody(''); setAnon(false); setOpen(false);
    startTransition(() => {
      router.push(`/forum/${categorySlug}/${data}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50 p-4 text-left flex items-center gap-3 text-ink-muted hover:text-ink-strong transition">
        <span className="h-9 w-9 rounded-full bg-coral-100 text-coral-600 grid place-items-center shrink-0">
          <Plus className="h-4 w-4" />
        </span>
        <span className="text-sm font-semibold">
          {isAr ? 'ابدئي موضوعًا جديدًا' : 'Start a new thread'}
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white shadow-card p-4 space-y-3">
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
        placeholder={isAr ? 'العنوان (٣ أحرف على الأقل)' : 'Title (at least 3 characters)'}
        required maxLength={200}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base font-semibold text-ink-strong focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />

      <textarea value={body} onChange={e => setBody(e.target.value)}
        placeholder={isAr ? 'اكتبي ما تريدين مشاركته…' : 'What do you want to share?'}
        required minLength={10} maxLength={8000} rows={5}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />

      {err && <p className="text-xs text-coral-600">{err}</p>}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-coral-500 focus:ring-coral-500" />
          {anon
            ? <span className="inline-flex items-center gap-1 text-ink-strong"><EyeOff className="h-3.5 w-3.5" /> {isAr ? 'مجهول' : 'Anonymous'}</span>
            : <span className="inline-flex items-center gap-1 text-ink-muted"><Eye className="h-3.5 w-3.5" /> {isAr ? 'باسمي' : 'My name'}</span>}
        </label>

        <div className="flex items-center gap-2 ms-auto">
          <button type="button" onClick={() => { setOpen(false); setErr(null); }}
            className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button type="submit" disabled={busy || title.trim().length < 3 || body.trim().length < 10}
            className="inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2 text-sm disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isAr ? 'انشري' : 'Post'}
          </button>
        </div>
      </div>
    </form>
  );
}

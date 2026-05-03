'use client';

// ForumReplyCompose — sticky-ish reply box at the bottom of a thread.
// Anonymous toggle inline. Refreshes the page on success so the new
// reply renders without manual reload.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, EyeOff, Eye } from 'lucide-react';

export function ForumReplyCompose({
  threadId, lang = 'en',
}: {
  threadId: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const [body, setBody] = useState('');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('post_forum_reply', {
      p_thread_id: threadId,
      p_body: body.trim(),
      p_anonymous: anon,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setBody('');
    router.refresh();
  }

  return (
    <form onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white shadow-card p-4 space-y-3">
      <textarea value={body} onChange={e => setBody(e.target.value)}
        placeholder={isAr ? 'اكتبي ردك…' : 'Write a reply…'}
        required minLength={1} maxLength={4000} rows={4}
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
        <button type="submit" disabled={busy || !body.trim()}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2 text-sm disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isAr ? 'رد' : 'Reply'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { fmtRelative } from '@/lib/dates';

type TargetTable =
  | 'feedings' | 'stool_logs' | 'medications' | 'medication_logs' | 'measurements'
  | 'temperature_logs' | 'vaccinations' | 'sleep_logs' | 'medical_files' | 'extracted_text' | 'babies';

type Row = {
  id: string;
  author: string;
  body: string;
  created_at: string;
  scope_date: string | null;
};

/**
 * Inline thread attached to any domain row. Reads via (target_table, target_id)
 * and writes via the `comments` table — everything RLS-gated by baby_users.
 *
 * When `scopeDate` is provided (YYYY-MM-DD), the thread is filtered to that
 * date — used by the daily report so comments belong to the day being viewed.
 * New comments inherit the same scope_date automatically.
 */
export function Comments({
  babyId, target, targetId, title = 'Comments', scopeDate, canPost = true,
}: {
  babyId: string;
  target: TargetTable;
  targetId: string;
  title?: string;
  /** YYYY-MM-DD — if set, reads + writes are filtered/tagged with this date. */
  scopeDate?: string;
  /** If false, hides the compose form (viewer/nurse). Server RLS enforces too. */
  canPost?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [me, setMe] = useState<{ id: string; email: string | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user ? { id: data.user.id, email: data.user.email ?? null } : null);
    });
    let q = supabase
      .from('comments')
      .select('id,author,body,created_at,scope_date')
      .eq('target_table', target)
      .eq('target_id', targetId)
      .is('deleted_at', null);
    if (scopeDate) {
      // Show comments tagged with this specific date plus any legacy comments
      // that were posted before scope_date existed (scope_date = NULL).
      q = q.or(`scope_date.eq.${scopeDate},scope_date.is.null`);
    }
    q.order('created_at', { ascending: true })
      .then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, [target, targetId, scopeDate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || posting) return;
    setPosting(true); setErr(null);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setPosting(false); setErr('Not signed in.'); return; }
    const { data, error } = await supabase
      .from('comments')
      .insert({
        baby_id: babyId, target_table: target, target_id: targetId,
        body: body.trim(), author: auth.user.id,
        scope_date: scopeDate ?? null,
      })
      .select('id,author,body,created_at,scope_date')
      .single();
    setPosting(false);
    if (error) { setErr(error.message); return; }
    setRows(r => [...r, data as Row]);
    setBody('');
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this comment?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) { setErr(error.message); return; }
    setRows(r => r.filter(x => x.id !== id));
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-ink-strong">{title}</h3>
        {!loading && <span className="text-xs text-ink-muted">· {rows.length}</span>}
      </div>

      <div className="p-5 space-y-4">
        {loading && <p className="text-sm text-ink-muted">Loading…</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-ink-muted">No comments yet — leave a note for the other caregivers.</p>
        )}
        {rows.map(c => {
          const isMine = me?.id === c.author;
          return (
            <div key={c.id} className="flex items-start gap-3">
              <span className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold shrink-0">
                {isMine ? (me?.email ?? '?').charAt(0).toUpperCase() : c.author.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-ink-strong">{isMine ? 'You' : shortId(c.author)}</span>
                  <span className="text-ink-muted">{fmtRelative(c.created_at)}</span>
                  {isMine && (
                    <button onClick={() => remove(c.id)} className="ml-auto text-ink-muted hover:text-coral-600" aria-label="Delete comment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-1 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-ink whitespace-pre-wrap">
                  {c.body}
                </div>
              </div>
            </div>
          );
        })}

        {canPost ? (
          <form onSubmit={submit} className="flex items-start gap-2 pt-2">
            <span className="h-8 w-8 rounded-full bg-coral-100 text-coral-700 grid place-items-center text-xs font-bold shrink-0">
              {(me?.email ?? 'Y').charAt(0).toUpperCase()}
            </span>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Leave a note for other caregivers…"
              rows={2}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="inline-flex items-center gap-1 rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-3 py-2 text-sm font-semibold"
            >
              <Send className="h-4 w-4" />
              Post
            </button>
          </form>
        ) : (
          <div className="pt-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-ink-muted">
            Read-only — only owners, parents, and doctors can post comments.
          </div>
        )}
        {err && <p className="text-xs text-coral-600">{err}</p>}
      </div>
    </div>
  );
}

function shortId(id: string): string {
  return id.slice(0, 8) + '…';
}

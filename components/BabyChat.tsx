'use client';

// BabyChat — group chat scoped to a profile. Everyone with has_baby_access
// can read and post. Realtime: subscribes to baby_messages inserts so new
// posts appear without a refresh; soft-delete via RPC for own rows
// (parents can delete any row, enforced server-side).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Trash2, Loader2, MessageCircle } from 'lucide-react';
import { fmtRelative, fmtDateTime } from '@/lib/dates';

export interface ChatMessage {
  id: string;
  baby_id: string;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface ChatMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string | null;
}

export function BabyChat({
  babyId, currentUserId, initialMessages, members, isParent,
}: {
  babyId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
  /** Display names + roles for each baby_user. */
  members: ChatMember[];
  /** Parent/owner — can delete any message (not just their own). */
  isParent: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Member lookup by user_id for the message header.
  const memberById = useMemo(() => {
    const m = new Map<string, ChatMember>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Realtime subscription. New inserts are appended; soft-deletes filter out.
  // We use postgres_changes filtered by baby_id so we don't receive every
  // baby's chat traffic.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`baby-chat-${babyId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'baby_messages', filter: `baby_id=eq.${babyId}` },
        payload => {
          const msg = payload.new as ChatMessage;
          if (!msg.deleted_at) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'baby_messages', filter: `baby_id=eq.${babyId}` },
        payload => {
          const msg = payload.new as ChatMessage;
          setMessages(prev => prev.flatMap(m => {
            if (m.id !== msg.id) return [m];
            return msg.deleted_at ? [] : [msg];
          }));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [babyId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true); setErr(null);
    const supabase = createClient();
    const { data: id, error } = await supabase.rpc('send_baby_message', {
      p_baby: babyId, p_body: body,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    setDraft('');
    // Optimistic insert — realtime will dedupe by id when the server echo
    // arrives. This makes the UI feel instant on slow connections.
    if (id) {
      setMessages(prev => prev.some(m => m.id === id) ? prev : [...prev, {
        id: id as string, baby_id: babyId, user_id: currentUserId,
        body, created_at: new Date().toISOString(),
        edited_at: null, deleted_at: null,
      }]);
    }
  }

  async function remove(messageId: string) {
    if (!window.confirm('Delete this message?')) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('soft_delete_baby_message', { p_message_id: messageId });
    if (error) { setErr(error.message); return; }
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function nameFor(userId: string): string {
    const m = memberById.get(userId);
    if (!m) return userId.slice(0, 6);
    if (m.display_name && m.display_name.trim()) return m.display_name.trim();
    if (m.email) return m.email.split('@')[0]!;
    return userId.slice(0, 6);
  }

  function initialsFor(userId: string): string {
    const n = nameFor(userId);
    const parts = n.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2) || n.slice(0, 2).toUpperCase();
  }

  // Tint the avatar by role so doctor/parent/nurse are visually distinct.
  function tintFor(userId: string): string {
    const role = memberById.get(userId)?.role;
    switch (role) {
      case 'owner':
      case 'parent':
      case 'editor':   return 'bg-mint-100 text-mint-700';
      case 'doctor':   return 'bg-lavender-100 text-lavender-700';
      case 'nurse':    return 'bg-coral-100 text-coral-700';
      case 'pharmacy': return 'bg-mint-100 text-mint-700';
      case 'viewer':   return 'bg-slate-100 text-ink';
      default:         return 'bg-brand-100 text-brand-700';
    }
  }

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden flex flex-col h-[600px]">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-mint-50 to-lavender-50">
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-mint-100 text-mint-600">
          <MessageCircle className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-ink-strong leading-tight">Chat</h2>
          <p className="text-[11px] text-ink-muted leading-tight">
            Everyone with access to this profile sees these messages.
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          {members.length} {members.length === 1 ? 'member' : 'members'}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-ink-muted text-center px-4">
            <div>
              <div className="mx-auto h-12 w-12 rounded-full bg-mint-100 text-mint-600 grid place-items-center mb-2">
                <MessageCircle className="h-6 w-6" />
              </div>
              No messages yet — be the first to write.
            </div>
          </div>
        ) : (
          messages.map(m => {
            const mine = m.user_id === currentUserId;
            const canDelete = mine || isParent;
            return (
              <div key={m.id} className={`flex items-start gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                <span className={`h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${tintFor(m.user_id)}`}>
                  {initialsFor(m.user_id)}
                </span>
                <div className={`max-w-[80%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-baseline gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-semibold text-ink-strong">{nameFor(m.user_id)}</span>
                    <span className="text-[10px] text-ink-muted" title={fmtDateTime(m.created_at)}>
                      {fmtRelative(m.created_at)}
                    </span>
                  </div>
                  <div className={`mt-1 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    mine
                      ? 'bg-gradient-to-br from-mint-500 to-mint-600 text-white rounded-tr-sm'
                      : 'bg-slate-100 text-ink-strong rounded-tl-sm'
                  }`}>
                    {m.body}
                  </div>
                  {canDelete && (
                    <button type="button" onClick={() => remove(m.id)}
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-muted hover:text-coral-600">
                      <Trash2 className="h-3 w-3" /> delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/40 p-3">
        {err && <p className="text-xs text-coral-600 mb-2">{err}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Write a message… (Enter sends, Shift+Enter for newline)"
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm resize-none focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30 max-h-32"
            style={{ minHeight: 44 }}
          />
          <button type="button" onClick={send} disabled={sending || !draft.trim()}
            className="h-11 w-11 rounded-full bg-gradient-to-br from-mint-500 to-mint-600 text-white grid place-items-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}

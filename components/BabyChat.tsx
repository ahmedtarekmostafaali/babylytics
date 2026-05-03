'use client';

// BabyChat — group chat scoped to a profile. Everyone with has_baby_access
// can read and post. Realtime: subscribes to baby_messages inserts so new
// posts appear without a refresh; soft-delete via RPC for own rows
// (parents can delete any row, enforced server-side).

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Send, Trash2, Loader2, MessageCircle, AtSign } from 'lucide-react';
import { fmtRelative, fmtDateTime } from '@/lib/dates';
import {
  getMentionContext, filterMembers, applyMention, tokenizeBody, mentionLabel,
} from '@/lib/mentions';

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
  // Wave 9: @mention picker state. Open whenever the caret sits inside an
  // @<query> token; closes on selection / blur / non-matching keystroke.
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [mentionCtx, setMentionCtx] = useState<{ query: string; start: number; end: number } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const mentionMatches = useMemo(
    () => mentionCtx ? filterMembers(members, mentionCtx.query, currentUserId).slice(0, 6) : [],
    [mentionCtx, members, currentUserId],
  );

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
    // Mention picker keyboard handling first — Up/Down navigate, Enter
    // picks the highlighted member instead of sending the message.
    if (mentionCtx && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => (i + 1) % mentionMatches.length); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === 'Escape')    { e.preventDefault(); setMentionCtx(null); return; }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const member = mentionMatches[mentionIdx]!;
        const result = applyMention(draft, mentionCtx, member);
        setDraft(result.body);
        setMentionCtx(null);
        // Restore caret position after React re-render.
        requestAnimationFrame(() => {
          const t = taRef.current;
          if (t) { t.selectionStart = t.selectionEnd = result.caret; t.focus(); }
        });
        return;
      }
    }
    // Enter sends, Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function onDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setDraft(v);
    const caret = e.target.selectionStart ?? v.length;
    const ctx = getMentionContext(v, caret);
    setMentionCtx(ctx);
    setMentionIdx(0);
  }

  function pickMention(member: typeof members[number]) {
    if (!mentionCtx) return;
    const result = applyMention(draft, mentionCtx, member);
    setDraft(result.body);
    setMentionCtx(null);
    requestAnimationFrame(() => {
      const t = taRef.current;
      if (t) { t.selectionStart = t.selectionEnd = result.caret; t.focus(); }
    });
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
                    {tokenizeBody(m.body).map((tok, i) =>
                      tok.kind === 'mention' ? (
                        <span key={i} className={mine
                          ? 'font-semibold underline underline-offset-2'
                          : 'font-semibold text-mint-700 bg-mint-50 rounded px-1'}>
                          {tok.text}
                        </span>
                      ) : <span key={i}>{tok.text}</span>
                    )}
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

      <div className="border-t border-slate-100 bg-slate-50/40 p-3 relative">
        {err && <p className="text-xs text-coral-600 mb-2">{err}</p>}

        {/* Mention picker — anchored above the textarea. Click or
            keyboard (↑/↓ + Enter/Tab) to insert. */}
        {mentionCtx && mentionMatches.length > 0 && (
          <div className="absolute left-3 right-3 bottom-full mb-2 rounded-2xl border border-slate-200 bg-white shadow-panel overflow-hidden z-20">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-b border-slate-100 flex items-center gap-1.5">
              <AtSign className="h-3 w-3" /> Mention someone
            </div>
            {mentionMatches.map((m, i) => (
              <button
                key={m.user_id} type="button"
                onMouseDown={e => { e.preventDefault(); pickMention(m); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm ${
                  i === mentionIdx ? 'bg-mint-50' : 'hover:bg-slate-50'
                }`}>
                <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${tintFor(m.user_id)}`}>
                  {initialsFor(m.user_id)}
                </span>
                <span className="flex-1 min-w-0 truncate">{mentionLabel(m)}</span>
                {m.role && <span className="text-[10px] text-ink-muted">{m.role}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            value={draft}
            onChange={onDraftChange}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setMentionCtx(null), 100)}
            rows={1}
            placeholder="Write a message… (type @ to mention, Enter sends)"
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

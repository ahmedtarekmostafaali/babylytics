'use client';

// ChatHub — left pane = thread list (Group + each direct thread), right
// pane = the selected thread's messages. URL param ?thread=ID drives
// selection. ?thread=group selects the baby_messages group chat.
//
// Direct threads: realtime via chat_thread_messages subscription.
// Group: realtime via the existing baby_messages subscription (handled in
// the embedded BabyChat component).
//
// Mobile: when a thread is selected, the list collapses and the chat fills
// the screen with a back-arrow that clears the param.

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Send, Trash2, Loader2, MessageCircle, Users, ArrowLeft, Plus,
} from 'lucide-react';
import { fmtRelative, fmtDateTime } from '@/lib/dates';
import { BabyChat, type ChatMessage as GroupMessage, type ChatMember } from '@/components/BabyChat';

export interface ThreadSummary {
  id: string;
  kind: 'direct' | 'consult';
  other_user_id: string;
  other_name: string | null;
  other_role: string | null;
  last_message_at: string;
  unread: boolean;
}

export interface ThreadMessage {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export function ChatHub({
  babyId, currentUserId, isParent, members, threads,
  initialGroupMessages, initialThreadMessages, selectedThreadId,
}: {
  babyId: string;
  currentUserId: string;
  isParent: boolean;
  /** Everyone with baby_users access on this profile, with display names. */
  members: ChatMember[];
  /** Direct threads the current user participates in (for this baby). */
  threads: ThreadSummary[];
  /** Group chat scrollback (pre-fetched server-side). */
  initialGroupMessages: GroupMessage[];
  /** If a direct thread is selected, its scrollback. Null when group is selected. */
  initialThreadMessages: ThreadMessage[] | null;
  /** Selected thread id from the URL. 'group' or undefined → group chat. */
  selectedThreadId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Bucketed thread list — group always at top, direct threads sorted by
  // last_message_at desc.
  const sortedDirect = useMemo(
    () => [...threads].sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()),
    [threads],
  );

  const isGroupSelected = !selectedThreadId || selectedThreadId === 'group';
  const selectedThread = !isGroupSelected
    ? threads.find(t => t.id === selectedThreadId) ?? null
    : null;

  // Members not yet in a direct thread with me — surface as "Start direct
  // message" candidates. Excludes self.
  const dmCandidates = useMemo(() => {
    const inThread = new Set(threads.map(t => t.other_user_id));
    return members.filter(m => m.user_id !== currentUserId && !inThread.has(m.user_id));
  }, [members, threads, currentUserId]);

  function selectThread(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('thread', id); else params.delete('thread');
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  async function startDirectWith(otherUserId: string) {
    const supabase = createClient();
    const { data: threadId, error } = await supabase.rpc('start_or_get_direct_thread', {
      p_baby: babyId, p_other_user: otherUserId,
    });
    if (error || !threadId) return;
    selectThread(threadId as string);
    // Force a server refresh so the new thread shows in the list.
    router.refresh();
  }

  function nameFor(userId: string): string {
    const m = members.find(x => x.user_id === userId);
    if (!m) return userId.slice(0, 6);
    if (m.display_name?.trim()) return m.display_name.trim();
    if (m.email) return m.email.split('@')[0]!;
    return userId.slice(0, 6);
  }

  function tintFor(role: string | null): string {
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

  function initialsFor(name: string): string {
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2)
        || name.slice(0, 2).toUpperCase();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] min-h-[600px]">
      {/* LEFT — thread list. Hidden on mobile when a thread is selected
          to give the chat full width. */}
      <aside className={`${selectedThreadId ? 'hidden lg:block' : 'block'} space-y-2`}>
        <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h3 className="text-xs font-bold text-ink-strong uppercase tracking-wider">Conversations</h3>
          </div>

          {/* Group chat row */}
          <button
            type="button" onClick={() => selectThread('group')}
            className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${
              isGroupSelected ? 'bg-mint-50/60 border-l-2 border-mint-500' : ''
            }`}>
            <span className="h-9 w-9 rounded-full bg-mint-100 text-mint-600 grid place-items-center shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink-strong text-sm truncate">Group chat</div>
              <div className="text-[11px] text-ink-muted truncate">
                Everyone with access · {members.length} {members.length === 1 ? 'member' : 'members'}
              </div>
            </div>
          </button>

          {/* Direct threads */}
          {sortedDirect.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-t border-slate-100">
                Direct messages
              </div>
              {sortedDirect.map(t => {
                const active = t.id === selectedThreadId;
                const name = t.other_name?.trim() || nameFor(t.other_user_id);
                return (
                  <button
                    key={t.id} type="button" onClick={() => selectThread(t.id)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition ${
                      active ? 'bg-lavender-50/60 border-l-2 border-lavender-500' : ''
                    }`}>
                    <span className={`h-9 w-9 rounded-full grid place-items-center shrink-0 text-xs font-bold ${tintFor(t.other_role)}`}>
                      {initialsFor(name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-ink-strong text-sm truncate flex items-center gap-2">
                        {name}
                        {t.unread && <span className="h-2 w-2 rounded-full bg-coral-500 shrink-0" />}
                      </div>
                      <div className="text-[11px] text-ink-muted truncate">
                        {t.other_role ?? 'caregiver'} · {fmtRelative(t.last_message_at)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {/* Start a new DM */}
          {dmCandidates.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted border-t border-slate-100">
                Start a direct message
              </div>
              {dmCandidates.map(c => {
                const name = c.display_name?.trim() || c.email?.split('@')[0] || c.user_id.slice(0, 6);
                return (
                  <button
                    key={c.user_id} type="button" onClick={() => startDirectWith(c.user_id)}
                    disabled={pending}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition">
                    <span className={`h-8 w-8 rounded-full grid place-items-center shrink-0 text-[10px] font-bold ${tintFor(c.role)}`}>
                      {initialsFor(name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{name}</div>
                      <div className="text-[11px] text-ink-muted truncate">{c.role ?? 'caregiver'}</div>
                    </div>
                    <Plus className="h-4 w-4 text-ink-muted shrink-0" />
                  </button>
                );
              })}
            </>
          )}
        </section>
      </aside>

      {/* RIGHT — selected chat panel */}
      <div className={`${selectedThreadId ? 'block' : 'hidden lg:block'}`}>
        {/* Mobile back-to-list */}
        {selectedThreadId && (
          <button type="button" onClick={() => selectThread(null)}
            className="lg:hidden mb-2 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink-strong">
            <ArrowLeft className="h-4 w-4" /> Back to conversations
          </button>
        )}

        {isGroupSelected ? (
          <BabyChat
            babyId={babyId}
            currentUserId={currentUserId}
            initialMessages={initialGroupMessages}
            members={members}
            isParent={isParent}
          />
        ) : selectedThread ? (
          <ThreadChatPanel
            threadId={selectedThread.id}
            otherUserId={selectedThread.other_user_id}
            otherName={selectedThread.other_name?.trim() || nameFor(selectedThread.other_user_id)}
            otherRole={selectedThread.other_role}
            currentUserId={currentUserId}
            initialMessages={initialThreadMessages ?? []}
            members={members}
            isParent={isParent}
          />
        ) : (
          <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-12 text-center text-sm text-ink-muted">
            Pick a conversation on the left to start chatting.
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThreadChatPanel — the right-side chat for a direct thread. Mirrors BabyChat
// but talks to chat_thread_messages instead of baby_messages.
// ─────────────────────────────────────────────────────────────────────────────
function ThreadChatPanel({
  threadId, otherUserId, otherName, otherRole, currentUserId, initialMessages, members, isParent,
}: {
  threadId: string;
  otherUserId: string;
  otherName: string;
  otherRole: string | null;
  currentUserId: string;
  initialMessages: ThreadMessage[];
  members: ChatMember[];
  isParent: boolean;
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const memberById = useMemo(() => {
    const m = new Map<string, ChatMember>();
    for (const x of members) m.set(x.user_id, x);
    return m;
  }, [members]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Mark the thread read when we open / receive new messages.
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc('mark_thread_read', { p_thread: threadId }).then(() => {});
  }, [threadId, messages.length]);

  // Realtime subscription scoped to this thread.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`chat-thread-${threadId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_thread_messages', filter: `thread_id=eq.${threadId}` },
        payload => {
          const msg = payload.new as ThreadMessage;
          if (!msg.deleted_at) setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        })
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_thread_messages', filter: `thread_id=eq.${threadId}` },
        payload => {
          const msg = payload.new as ThreadMessage;
          setMessages(prev => prev.flatMap(m => {
            if (m.id !== msg.id) return [m];
            return msg.deleted_at ? [] : [msg];
          }));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true); setErr(null);
    const supabase = createClient();
    const { data: id, error } = await supabase.rpc('send_thread_message', {
      p_thread: threadId, p_body: body,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    setDraft('');
    if (id) {
      setMessages(prev => prev.some(m => m.id === id) ? prev : [...prev, {
        id: id as string, thread_id: threadId, user_id: currentUserId,
        body, created_at: new Date().toISOString(),
        edited_at: null, deleted_at: null,
      }]);
    }
  }

  async function remove(messageId: string) {
    if (!window.confirm('Delete this message?')) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('soft_delete_thread_message', { p_message_id: messageId });
    if (error) { setErr(error.message); return; }
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function nameFor(userId: string): string {
    const m = memberById.get(userId);
    if (!m) return userId.slice(0, 6);
    if (m.display_name?.trim()) return m.display_name.trim();
    if (m.email) return m.email.split('@')[0]!;
    return userId.slice(0, 6);
  }

  function initialsFor(userId: string): string {
    const n = nameFor(userId);
    const parts = n.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase().slice(0, 2) || n.slice(0, 2).toUpperCase();
  }

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
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-lavender-50 to-brand-50">
        <span className={`h-9 w-9 rounded-full grid place-items-center text-xs font-bold shrink-0 ${tintFor(otherUserId)}`}>
          {initialsFor(otherUserId)}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-ink-strong leading-tight truncate">{otherName}</h2>
          <p className="text-[11px] text-ink-muted leading-tight">
            Direct message · {otherRole ?? 'caregiver'} · only you two
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-ink-muted text-center px-4">
            <div>
              <div className="mx-auto h-12 w-12 rounded-full bg-lavender-100 text-lavender-600 grid place-items-center mb-2">
                <MessageCircle className="h-6 w-6" />
              </div>
              No messages yet — say hi.
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
                      ? 'bg-gradient-to-br from-lavender-500 to-brand-500 text-white rounded-tr-sm'
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
            placeholder={`Message ${otherName}…`}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm resize-none focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30 max-h-32"
            style={{ minHeight: 44 }}
          />
          <button type="button" onClick={send} disabled={sending || !draft.trim()}
            className="h-11 w-11 rounded-full bg-gradient-to-br from-lavender-500 to-brand-500 text-white grid place-items-center hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </section>
  );
}

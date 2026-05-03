import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { type ChatMessage, type ChatMember } from '@/components/BabyChat';
import { ChatHub, type ThreadSummary, type ThreadMessage } from '@/components/ChatHub';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat' };

export default async function BabyChatPage({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { thread?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: baby } = await supabase.from('babies')
    .select('id,name')
    .eq('id', params.babyId).is('deleted_at', null).single();
  if (!baby) notFound();

  const selectedThread = searchParams.thread === 'group' ? null
                       : searchParams.thread ?? null;

  // Parallel load: members + group messages + my direct threads on this
  // baby. If a specific thread is selected, also load its messages +
  // participants.
  const [{ data: groupRows }, { data: members }, { data: myThreads }] = await Promise.all([
    supabase.from('baby_messages')
      .select('id,baby_id,user_id,body,created_at,edited_at,deleted_at')
      .eq('baby_id', params.babyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('baby_users')
      .select('user_id, role')
      .eq('baby_id', params.babyId),
    // Direct threads I'm a participant of, on this baby. Fetched as the
    // join via chat_thread_participants → chat_threads filtered by baby_id.
    // Realtime updates via the hub component's subscription.
    supabase.from('chat_thread_participants')
      .select('thread_id, last_read_at, chat_threads!inner(id, baby_id, kind, last_message_at)')
      .eq('user_id', user.id),
  ]);

  const groupMessages = ((groupRows ?? []) as ChatMessage[]).reverse();

  // Resolve display names + emails for everyone whose user_id appears.
  const allMemberIds = new Set<string>([user.id, ...((members ?? []).map(m => m.user_id))]);
  const { data: profiles } = allMemberIds.size
    ? await supabase.from('profiles').select('id,display_name,email').in('id', Array.from(allMemberIds))
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
  const profById = new Map((profiles ?? []).map(p => [p.id, p]));

  const chatMembers: ChatMember[] = (members ?? []).map(m => {
    const p = profById.get(m.user_id);
    return {
      user_id: m.user_id,
      display_name: p?.display_name ?? null,
      email: p?.email ?? null,
      role: (m.role as string | null) ?? null,
    };
  });

  // Filter direct threads to those whose chat_threads.baby_id matches this
  // baby. Postgrest returns the joined row at .chat_threads.
  type RawParticipantRow = {
    thread_id: string;
    last_read_at: string;
    chat_threads: { id: string; baby_id: string; kind: 'direct' | 'consult'; last_message_at: string } | null;
  };
  const myThreadRows = ((myThreads ?? []) as unknown as RawParticipantRow[])
    .filter(r => r.chat_threads?.baby_id === params.babyId);

  // For each thread, find the OTHER participant (not me) and their unread
  // status (any message after my last_read_at).
  const threadIds = myThreadRows.map(r => r.thread_id);
  const [{ data: allParticipants }, { data: lastMsgs }] = await Promise.all([
    threadIds.length
      ? supabase.from('chat_thread_participants').select('thread_id, user_id').in('thread_id', threadIds)
      : { data: [] as { thread_id: string; user_id: string }[] },
    threadIds.length
      ? supabase.from('chat_thread_messages')
          .select('thread_id, created_at')
          .in('thread_id', threadIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      : { data: [] as { thread_id: string; created_at: string }[] },
  ]);
  const lastMsgByThread = new Map<string, string>();
  for (const m of (lastMsgs ?? [])) {
    if (!lastMsgByThread.has(m.thread_id)) lastMsgByThread.set(m.thread_id, m.created_at);
  }
  const participantsByThread = new Map<string, string[]>();
  for (const p of (allParticipants ?? [])) {
    const arr = participantsByThread.get(p.thread_id) ?? [];
    arr.push(p.user_id);
    participantsByThread.set(p.thread_id, arr);
  }

  const threadSummaries: ThreadSummary[] = myThreadRows.map(r => {
    const others = (participantsByThread.get(r.thread_id) ?? []).filter(uid => uid !== user.id);
    const otherUserId = others[0] ?? '';
    const otherProf = profById.get(otherUserId);
    const otherMember = chatMembers.find(m => m.user_id === otherUserId);
    const lastMsg = lastMsgByThread.get(r.thread_id) ?? r.chat_threads!.last_message_at;
    const unread = lastMsg ? new Date(lastMsg) > new Date(r.last_read_at) : false;
    return {
      id: r.thread_id,
      kind: r.chat_threads!.kind,
      other_user_id: otherUserId,
      other_name: otherProf?.display_name?.trim() || (otherProf?.email ? otherProf.email.split('@')[0]! : null),
      other_role: otherMember?.role ?? null,
      last_message_at: lastMsg,
      unread,
    };
  });

  // If a direct thread is selected, load its scrollback.
  let initialThreadMessages: ThreadMessage[] | null = null;
  if (selectedThread) {
    const { data: tmRows } = await supabase.from('chat_thread_messages')
      .select('id,thread_id,user_id,body,created_at,edited_at,deleted_at')
      .eq('thread_id', selectedThread)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    initialThreadMessages = ((tmRows ?? []) as ThreadMessage[]).reverse();
  }

  const myRole = (members ?? []).find(m => m.user_id === user.id)?.role as string | undefined;
  const isParent = myRole === 'owner' || myRole === 'parent' || myRole === 'editor';

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('nav.cat_family').toUpperCase()} eyebrowTint="mint"
        title={t('chat.title')}
        subtitle={t('chat.subtitle_group_dms', { name: baby.name })} />
      <ChatHub
        babyId={params.babyId}
        currentUserId={user.id}
        isParent={isParent}
        members={chatMembers}
        threads={threadSummaries}
        initialGroupMessages={groupMessages}
        initialThreadMessages={initialThreadMessages}
        selectedThreadId={selectedThread}
      />
    </PageShell>
  );
}

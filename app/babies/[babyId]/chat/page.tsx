import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { BabyChat, type ChatMessage, type ChatMember } from '@/components/BabyChat';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Chat' };

export default async function BabyChatPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  // Baby + access guard. The baby_messages SELECT policy already requires
  // has_baby_access, but we hard-fail early so we don't render an empty
  // chat for someone who shouldn't be here.
  const { data: baby } = await supabase.from('babies')
    .select('id,name,lifecycle_stage')
    .eq('id', params.babyId).is('deleted_at', null).single();
  if (!baby) notFound();

  // Pull the most recent 200 messages. Ordering by created_at ASC so the
  // BabyChat component can append realtime inserts to the bottom without
  // re-sorting. 200 is enough for typical group-chat scrollback; older
  // messages can be paginated in a future wave if needed.
  const [{ data: msgRows }, { data: members }] = await Promise.all([
    supabase.from('baby_messages')
      .select('id,baby_id,user_id,body,created_at,edited_at,deleted_at')
      .eq('baby_id', params.babyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    // Members + their profile names for the avatar/header. Joined client-
    // side because we already have RLS on both tables and the join keeps
    // the sql/052 view simpler.
    supabase.from('baby_users')
      .select('user_id, role')
      .eq('baby_id', params.babyId),
  ]);

  const messages = ((msgRows ?? []) as ChatMessage[]).reverse(); // ASC for render

  // Resolve display names for each member.
  const memberIds = (members ?? []).map(m => m.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from('profiles').select('id,display_name,email').in('id', memberIds)
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

  // Determine isParent for delete-anyone permission — RLS still enforces
  // server-side, this is just for UI affordance.
  const myRole = (members ?? []).find(m => m.user_id === user.id)?.role as string | undefined;
  const isParent = myRole === 'owner' || myRole === 'parent' || myRole === 'editor';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow={t('nav.cat_family').toUpperCase()} eyebrowTint="mint"
        title="Chat"
        subtitle={`Group chat for everyone with access to ${baby.name}.`} />
      <BabyChat
        babyId={params.babyId}
        currentUserId={user.id}
        initialMessages={messages}
        members={chatMembers}
        isParent={isParent}
      />
    </PageShell>
  );
}

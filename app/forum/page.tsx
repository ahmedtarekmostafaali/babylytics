import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { Heart, Baby as BabyIcon, MessageCircle, Sparkles } from 'lucide-react';
import { ForumUnreadBanner, type UnreadForumReply } from '@/components/ForumUnreadBanner';
import { ForumSearchBar } from '@/components/ForumSearchBar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Forum' };

const KIND_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  cycle:     { icon: Heart,         tint: 'bg-coral-100 text-coral-700' },
  pregnancy: { icon: Sparkles,      tint: 'bg-lavender-100 text-lavender-700' },
  baby:      { icon: BabyIcon,      tint: 'bg-mint-100 text-mint-700' },
  general:   { icon: MessageCircle, tint: 'bg-brand-100 text-brand-700' },
};

const KIND_LABEL: Record<string, { en: string; ar: string }> = {
  cycle:     { en: 'My cycle',  ar: 'الدورة' },
  pregnancy: { en: 'Pregnancy', ar: 'الحمل' },
  baby:      { en: 'Baby',      ar: 'الطفل' },
  general:   { en: 'Open',      ar: 'مفتوح' },
};

export default async function ForumIndex() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const { data: cats } = await supabase
    .from('forum_categories')
    .select('id,slug,kind,title_en,title_ar,description_en,description_ar,sort_order')
    .order('sort_order', { ascending: true });

  // Wave 19c: load unread forum_reply notifications for the banner.
  // Resolve each thread's category slug so the banner can deep-link.
  const { data: unreadRows } = await supabase.rpc('my_user_notifications');
  type UN = { id: string; kind: string; payload: { thread_id?: string; thread_title?: string; is_op?: boolean }; read_at: string | null; created_at: string };
  const unread = ((unreadRows ?? []) as UN[]).filter(n => n.kind === 'forum_reply' && !n.read_at);
  const unreadThreadIds = Array.from(new Set(unread.map(n => n.payload.thread_id).filter(Boolean) as string[]));
  const { data: unreadThreads } = unreadThreadIds.length
    ? await supabase.from('forum_threads').select('id,category_id').in('id', unreadThreadIds)
    : { data: [] as { id: string; category_id: string }[] };
  const unreadCatIds = Array.from(new Set((unreadThreads ?? []).map(t => t.category_id)));
  const { data: unreadCats } = unreadCatIds.length
    ? await supabase.from('forum_categories').select('id,slug').in('id', unreadCatIds)
    : { data: [] as { id: string; slug: string }[] };
  const slugByThreadId = new Map<string, string>();
  for (const t of (unreadThreads ?? [])) {
    const c = (unreadCats ?? []).find(x => x.id === t.category_id);
    if (c) slugByThreadId.set(t.id, c.slug);
  }
  const unreadItems: UnreadForumReply[] = unread
    .filter(n => n.payload.thread_id && slugByThreadId.has(n.payload.thread_id))
    .map(n => ({
      id:           n.id,
      thread_id:    n.payload.thread_id!,
      thread_title: n.payload.thread_title ?? '(untitled)',
      thread_slug:  slugByThreadId.get(n.payload.thread_id!)!,
      is_op:        Boolean(n.payload.is_op),
      created_at:   n.created_at,
    }));

  // Per-category latest activity — single query then group client-side.
  // Limited to top-recent across all categories (cheap, since the threads
  // table has an index on (category_id, last_reply_at desc)).
  const ids = (cats ?? []).map(c => c.id);
  const { data: recentByCat } = ids.length
    ? await supabase
        .from('forum_threads')
        .select('id,category_id,title,last_reply_at,reply_count')
        .in('category_id', ids)
        .is('deleted_at', null)
        .order('last_reply_at', { ascending: false })
        .limit(80)
    : { data: [] as { id: string; category_id: string; title: string; last_reply_at: string; reply_count: number }[] };

  const latestByCat = new Map<string, { title: string; last_reply_at: string }>();
  const countsByCat = new Map<string, number>();
  for (const t of (recentByCat ?? [])) {
    if (!latestByCat.has(t.category_id)) {
      latestByCat.set(t.category_id, { title: t.title, last_reply_at: t.last_reply_at });
    }
    countsByCat.set(t.category_id, (countsByCat.get(t.category_id) ?? 0) + 1);
  }

  // Group categories by kind for the section headers.
  type Cat = NonNullable<typeof cats>[number];
  const byKind = new Map<string, Cat[]>();
  for (const c of (cats ?? [])) {
    const arr = byKind.get(c.kind) ?? [];
    arr.push(c);
    byKind.set(c.kind, arr);
  }
  const kindOrder = ['cycle', 'pregnancy', 'baby', 'general'];

  return (
    <PageShell max="5xl">
      <PageHeader
        backHref="/dashboard"
        backLabel={isAr ? 'ملفاتي' : 'My profiles'}
        eyebrow={isAr ? 'مجتمع' : 'COMMUNITY'} eyebrowTint="brand"
        title={isAr ? 'المنتدى' : 'Forum'}
        subtitle={isAr
          ? 'تحدثي مع غيرك من النساء في نفس مرحلتك. كل منشور لكِ تختارين هل يظهر باسمك أم باسم مستعار.'
          : 'Talk to other women going through the same stage. Every post is yours to share with your name or a pseudonym.'}
      />

      {/* Wave 29: global search bar. */}
      <ForumSearchBar lang={userPrefs.language} />

      {/* Wave 19c: unread reply notifications. Hidden when caught up. */}
      <ForumUnreadBanner items={unreadItems} lang={userPrefs.language} />

      {kindOrder.map(kind => {
        const list = byKind.get(kind) ?? [];
        if (list.length === 0) return null;
        const meta = KIND_META[kind] ?? KIND_META.general;
        const Icon = meta.icon;
        const label = KIND_LABEL[kind] ?? { en: kind, ar: kind };
        return (
          <section key={kind} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`h-8 w-8 rounded-lg grid place-items-center ${meta.tint}`}>
                <Icon className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-ink-strong">
                {isAr ? label.ar : label.en}
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map(c => {
                const recent = latestByCat.get(c.id);
                const cnt = countsByCat.get(c.id) ?? 0;
                return (
                  <Link key={c.id} href={`/forum/${c.slug}`}
                    className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:shadow-card transition p-4 block">
                    <div className="font-semibold text-ink-strong text-sm">{isAr ? c.title_ar : c.title_en}</div>
                    {(isAr ? c.description_ar : c.description_en) && (
                      <div className="text-xs text-ink-muted mt-1 leading-relaxed">
                        {isAr ? c.description_ar : c.description_en}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
                      {recent ? (
                        <span className="truncate">
                          {isAr ? 'الأحدث' : 'Latest'}: <span className="text-ink">{recent.title}</span>
                        </span>
                      ) : (
                        <span>{isAr ? 'لا توجد مواضيع بعد' : 'No threads yet'}</span>
                      )}
                      {cnt > 0 && (
                        <span className="rounded-full bg-slate-100 text-ink-muted text-[10px] font-semibold px-2 py-0.5 shrink-0">
                          {cnt}+ {isAr ? 'نشط' : 'recent'}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="text-[11px] text-ink-muted text-center px-4 pt-2">
        {isAr
          ? 'هذا فضاء مجتمعي وليس استشارة طبية. للحالات الحرجة، تواصلي مع طبيبك مباشرة.'
          : 'This is a community space, not medical advice. For anything urgent, message your doctor directly.'}
      </p>
    </PageShell>
  );
}

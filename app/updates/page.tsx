// What's new — the parent-visible changelog. Public to any signed-in user.
//
// Pulls every row from public.app_updates, groups by category (new feature /
// bug fix / enhancement) and renders inside a single page that can be linked
// from the dashboard's notification list. Date-only display (no time). Inserts
// to public.app_updates auto-broadcast a notification via migration 029's
// trigger, so users see the bell badge whenever a new entry lands.

import { createClient } from '@/lib/supabase/server';
import { Sparkles, Bug, Wrench, Calendar } from 'lucide-react';
import { fmtDate } from '@/lib/dates';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: "What's new" };

type Category = 'new_feature' | 'bug_fix' | 'enhancement';

type Row = {
  id: string;
  title: string;
  body: string | null;
  category: Category;
  published_at: string;     // YYYY-MM-DD
  created_at: string;
};

// Visual + label keys per category. Order in the page matches this list.
const CATEGORIES: {
  key: Category;
  tkey: string;
  ring: string;
  pill: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'new_feature', tkey: 'updates.cat_new_feature', ring: 'border-mint-200    bg-mint-50/40',    pill: 'bg-mint-100    text-mint-700',    Icon: Sparkles },
  { key: 'bug_fix',     tkey: 'updates.cat_bug_fix',     ring: 'border-coral-200   bg-coral-50/40',   pill: 'bg-coral-100   text-coral-700',   Icon: Bug      },
  { key: 'enhancement', tkey: 'updates.cat_enhancement', ring: 'border-lavender-200 bg-lavender-50/40', pill: 'bg-lavender-100 text-lavender-700', Icon: Wrench   },
];

export default async function UpdatesPage() {
  const supabase = createClient();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: rows } = await supabase
    .from('app_updates')
    .select('id,title,body,category,published_at,created_at')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  const all = (rows ?? []) as Row[];
  const byCat: Record<Category, Row[]> = {
    new_feature: [],
    bug_fix:     [],
    enhancement: [],
  };
  for (const r of all) {
    if (r.category in byCat) byCat[r.category].push(r);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-mint-700 inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> {t('updates.eyebrow')}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-strong">{t('updates.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('updates.subtitle')}</p>
      </div>

      {all.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-ink-muted">
          {t('updates.empty')}
        </div>
      ) : (
        <div className="space-y-8">
          {CATEGORIES.map(c => {
            const list = byCat[c.key];
            if (list.length === 0) return null;
            return <CategoryBlock key={c.key} list={list} cat={c} t={t} />;
          })}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({
  list, cat, t,
}: {
  list: Row[];
  cat: typeof CATEGORIES[number];
  t: TFunc;
}) {
  const { Icon } = cat;
  return (
    <section className={`rounded-2xl border ${cat.ring} p-5`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`h-8 w-8 rounded-xl grid place-items-center ${cat.pill}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold text-ink-strong">{t(cat.tkey)}</h2>
        <span className={`ml-auto rounded-full text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 ${cat.pill}`}>
          {list.length}
        </span>
      </div>
      <ul className="space-y-3">
        {list.map(r => (
          <li key={r.id} className="rounded-xl bg-white border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-semibold text-ink-strong">{r.title}</div>
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-ink-muted whitespace-nowrap">
                <Calendar className="h-3 w-3" /> {fmtDate(r.published_at)}
              </span>
            </div>
            {r.body && <p className="mt-1.5 text-sm text-ink leading-relaxed whitespace-pre-wrap">{r.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { ShoppingItemRow } from '@/components/ShoppingItemRow';
import { ShoppingCart, Plus, Baby, Heart } from 'lucide-react';
import { effectiveStage, type LifecycleStage } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shopping list' };

type Row = {
  id: string;
  name: string;
  category: string | null;
  quantity: string | null;
  priority: 'low'|'normal'|'high';
  notes: string | null;
  is_done: boolean;
  done_at: string | null;
  created_at: string;
};

const SCOPE_LABEL: Record<'baby'|'pregnancy', string> = {
  baby: 'Baby essentials',
  pregnancy: 'Pregnancy & mom',
};

export default async function ShoppingList({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { scope?: 'baby'|'pregnancy' };
}) {
  const supabase = createClient();
  const perms = await assertRole(params.babyId, { requireLogs: true });

  // Pull baby stage so we can default to the most relevant tab.
  const { data: baby } = await supabase.from('babies')
    .select('name,dob,lifecycle_stage')
    .eq('id', params.babyId).single();
  const stage = baby ? effectiveStage(baby.lifecycle_stage as LifecycleStage | null, baby.dob as string | null) : null;
  const isPregnancy = stage === 'pregnancy';

  const scope = searchParams.scope ?? (isPregnancy ? 'pregnancy' : 'baby');

  const { data: rowsData } = await supabase.from('shopping_list_items')
    .select('id,name,category,quantity,priority,notes,is_done,done_at,created_at')
    .eq('baby_id', params.babyId).eq('scope', scope).is('deleted_at', null)
    .order('is_done', { ascending: true })       // unfinished first
    .order('priority', { ascending: false })     // high → low among unfinished
    .order('created_at', { ascending: false });
  const rows = (rowsData ?? []) as Row[];

  const open = rows.filter(r => !r.is_done);
  const done = rows.filter(r => r.is_done);

  // Group open items by priority for clarity
  const byPriority: { high: Row[]; normal: Row[]; low: Row[] } = { high: [], normal: [], low: [] };
  for (const r of open) byPriority[r.priority].push(r);

  // Group by category for an alternate view (if category set)
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Records" eyebrowTint="mint"
        title="Shopping list"
        subtitle={`${open.length} open · ${done.length} purchased`}
        right={
          perms.canWriteLogs && (
            <Link href={`/babies/${params.babyId}/shopping/new?scope=${scope}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-mint-500 to-brand-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Add item
            </Link>
          )
        } />

      {/* Scope tabs */}
      <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 self-start">
        <ScopeTab active={scope === 'baby'} href={`/babies/${params.babyId}/shopping?scope=baby`}
          icon={Baby} label={SCOPE_LABEL.baby} />
        <ScopeTab active={scope === 'pregnancy'} href={`/babies/${params.babyId}/shopping?scope=pregnancy`}
          icon={Heart} label={SCOPE_LABEL.pregnancy} />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-ink-muted">
          <ShoppingCart className="h-8 w-8 mx-auto text-ink-muted/60 mb-2" />
          Nothing on the list yet.
          {perms.canWriteLogs && (
            <Link href={`/babies/${params.babyId}/shopping/new?scope=${scope}`}
              className="block mt-3 text-mint-700 font-semibold underline">
              Add your first item
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Open items, grouped by priority */}
          {open.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">To buy</div>
              </div>
              {byPriority.high.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {byPriority.high.map(r => <ShoppingItemRow key={r.id} item={r} babyId={params.babyId} scope={scope} canWrite={perms.canWriteLogs} />)}
                </ul>
              )}
              {byPriority.normal.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {byPriority.normal.map(r => <ShoppingItemRow key={r.id} item={r} babyId={params.babyId} scope={scope} canWrite={perms.canWriteLogs} />)}
                </ul>
              )}
              {byPriority.low.length > 0 && (
                <ul className="divide-y divide-slate-100">
                  {byPriority.low.map(r => <ShoppingItemRow key={r.id} item={r} babyId={params.babyId} scope={scope} canWrite={perms.canWriteLogs} />)}
                </ul>
              )}
            </section>
          )}

          {/* Purchased items */}
          {done.length > 0 && (
            <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Purchased</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {done.map(r => <ShoppingItemRow key={r.id} item={r} babyId={params.babyId} scope={scope} canWrite={perms.canWriteLogs} />)}
              </ul>
            </section>
          )}
        </div>
      )}

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope={`shopping_list_${scope}`} title="Page comments" />
    </PageShell>
  );
}

function ScopeTab({ active, href, icon: Icon, label }: {
  active: boolean;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink-strong'
      }`}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </Link>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { FlaskConical, Plus, ArrowRight, Filter } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Labs' };

const PANEL_KINDS = [
  { value: 'all',     label: 'All' },
  { value: 'blood',   label: 'Blood' },
  { value: 'urine',   label: 'Urine' },
  { value: 'stool',   label: 'Stool' },
  { value: 'culture', label: 'Culture' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'genetic', label: 'Genetic' },
  { value: 'other',   label: 'Other' },
] as const;

type Panel = {
  id: string; panel_kind: string; panel_name: string;
  result_at: string; sample_at: string | null;
  lab_name: string | null; summary: string | null; abnormal: boolean;
  is_prenatal: boolean | null;
};

export default async function LabsList({ params, searchParams }: {
  params: { babyId: string };
  searchParams: { kind?: string };
}) {
  const supabase = createClient();
  const { isParent } = await assertRole(params.babyId, { requireLogs: true });

  const filter = (searchParams.kind ?? 'all') as typeof PANEL_KINDS[number]['value'];

  let query = supabase.from('lab_panels')
    .select('id,panel_kind,panel_name,result_at,sample_at,lab_name,summary,abnormal,is_prenatal')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('result_at', { ascending: false });
  if (filter !== 'all') query = query.eq('panel_kind', filter);

  const { data: rows } = await query;
  const panels = (rows ?? []) as Panel[];

  // Counts for filter chips (read all panels regardless of filter for tab counts)
  const { data: allRows } = await supabase.from('lab_panels')
    .select('panel_kind,abnormal')
    .eq('baby_id', params.babyId).is('deleted_at', null);
  const all = (allRows ?? []) as { panel_kind: string; abnormal: boolean }[];
  const countByKind: Record<string, number> = { all: all.length };
  for (const r of all) countByKind[r.panel_kind] = (countByKind[r.panel_kind] ?? 0) + 1;
  const abnormalCount = all.filter(r => r.abnormal).length;

  return (
    <PageShell max="4xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Track" eyebrowTint="peach" title="Labs & analysis"
        subtitle="Blood, urine, stool, cultures, imaging — all in one place. Recorded results stay shareable via Medical Profile."
        right={isParent ? (
          <Link href={`/babies/${params.babyId}/medical-profile/labs/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-peach-500 hover:bg-peach-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> Add lab result
          </Link>
        ) : undefined} />

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-ink-muted px-1">
          <Filter className="h-3 w-3" /> Filter
        </span>
        {PANEL_KINDS.map(k => {
          const active = filter === k.value;
          const count = countByKind[k.value] ?? 0;
          return (
            <Link key={k.value}
              href={k.value === 'all' ? `/babies/${params.babyId}/labs` : `/babies/${params.babyId}/labs?kind=${k.value}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                active ? 'bg-peach-500 text-white shadow-sm' : 'bg-peach-50 text-peach-700 hover:bg-peach-100'
              }`}>
              {k.label} {count > 0 && <span className={`text-[10px] ${active ? 'text-white/80' : 'text-peach-500'}`}>{count}</span>}
            </Link>
          );
        })}
        {abnormalCount > 0 && (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-coral-50 text-coral-700">
            ⚠ {abnormalCount} abnormal
          </span>
        )}
      </div>

      {panels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
          <FlaskConical className="h-8 w-8 mx-auto text-ink-muted/60" />
          <p className="text-sm text-ink-muted mt-3">
            {filter === 'all' ? 'No lab results recorded yet.' : `No ${filter} panels recorded yet.`}
          </p>
          {isParent && (
            <Link href={`/babies/${params.babyId}/medical-profile/labs/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-peach-500 hover:bg-peach-600 text-white text-sm font-semibold px-4 py-2">
              <Plus className="h-4 w-4" /> Add first lab result
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {panels.map(p => (
            <li key={p.id}>
              <Link href={`/babies/${params.babyId}/medical-profile/labs/${p.id}`}
                className={`block rounded-2xl border p-4 hover:shadow-card transition ${
                  p.abnormal ? 'border-peach-300 bg-peach-50/40' : 'border-slate-200 bg-white'
                }`}>
                <div className="flex items-start gap-3">
                  <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${
                    p.abnormal ? 'bg-coral-100 text-coral-700' : 'bg-peach-100 text-peach-700'
                  }`}>
                    <FlaskConical className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-ink-strong">{p.panel_name}</div>
                      <span className="text-[11px] uppercase tracking-wider text-peach-700 bg-peach-50 px-2 py-0.5 rounded-full">{p.panel_kind}</span>
                      {p.abnormal && <span className="text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-100 px-1.5 py-0.5 rounded">Abnormal</span>}
                      {p.is_prenatal && <span className="text-[10px] font-bold uppercase tracking-wider text-lavender-700 bg-lavender-100 px-1.5 py-0.5 rounded">Prenatal</span>}
                      <span className="ml-auto text-[11px] text-ink-muted">{fmtRelative(p.result_at)}</span>
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {fmtDate(p.result_at)}{p.lab_name ? ` · ${p.lab_name}` : ''}
                    </div>
                    {p.summary && <p className="mt-1.5 text-xs text-ink line-clamp-2">{p.summary}</p>}
                  </div>
                  <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 mt-3" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="labs_list" title="Page comments" />
    </PageShell>
  );
}

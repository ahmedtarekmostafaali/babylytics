import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { LogRangeTabs } from '@/components/LogRangeTabs';
import { LogRowDelete } from '@/components/LogRowDelete';
import { BulkDelete } from '@/components/BulkDelete';
import { Comments } from '@/components/Comments';
import {
  parseRangeParam, fmtDate, fmtTime, fmtDateTime,
  todayLocalDate, yesterdayLocalDate, localDayKey,
} from '@/lib/dates';
import { MessageCircle, Plus, Edit3, ArrowRight, Clock, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Speaking' };

type Row = {
  id: string;
  observed_at: string;
  word_or_phrase: string | null;
  category: string;
  language: string | null;
  is_first_use: boolean;
  context: string | null;
  notes: string | null;
  created_at: string;
};

const CAT_LABEL: Record<string, string> = {
  coo:      'Coo / vowel',
  babble:   'Babble',
  word:     'Word',
  phrase:   'Phrase',
  sentence: 'Sentence',
  other:    'Other',
};

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function SpeakingList({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const perms = await assertRole(params.babyId, { requireLogs: true });

  const { data: rowsData } = await supabase.from('speaking_logs')
    .select('id,observed_at,word_or_phrase,category,language,is_first_use,context,notes,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('observed_at', range.start).lte('observed_at', range.end)
    .order('observed_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.observed_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.observed_at), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  const firsts = rows.filter(r => r.is_first_use).length;

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Overview"
        eyebrow="Track" eyebrowTint="brand"
        title="Speaking"
        subtitle={`Coos, babbles, words, sentences. ${firsts > 0 ? `${firsts} first-use moments captured.` : 'Capture every milestone.'}`}
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="speaking_logs" timeColumn="observed_at"
                visibleIds={rows.map(r => r.id)} kindLabel="speaking logs" />
              <Link href={`/babies/${params.babyId}/speaking/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-mint-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Log speech
              </Link>
            </div>
          ) : (
            <span className="text-xs text-ink-muted rounded-full bg-slate-100 px-3 py-1">Read-only</span>
          )
        } />

      <div className="flex items-center gap-3 flex-wrap">
        <LogRangeTabs current={range.key === 'custom' ? 'custom' : (range.key as '24h'|'7d'|'30d'|'90d')} />
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)] gap-6">
        {/* LIST */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
          {groups.length === 0 && (
            <div className="p-10 text-center text-sm text-ink-muted">
              No speaking events in this window.
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(r => {
                  const active = selected?.id === r.id;
                  const subline = [r.language, r.context].filter(Boolean).join(' · ') || r.notes || '';
                  return (
                    <li key={r.id}>
                      <Link href={`/babies/${params.babyId}/speaking?range=${range.key}&id=${r.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-brand-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(r.observed_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-brand-100 text-brand-600">
                          <MessageCircle className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate flex items-center gap-1">
                            {r.word_or_phrase ? `"${r.word_or_phrase}"` : CAT_LABEL[r.category] ?? r.category}
                            {r.is_first_use && <Sparkles className="h-3.5 w-3.5 text-coral-500 shrink-0" />}
                          </div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-brand-700 whitespace-nowrap">{CAT_LABEL[r.category] ?? r.category}</span>
                          <ArrowRight className="h-4 w-4 text-ink-muted" />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {rows.length >= 500 && (
            <div className="px-5 py-3 text-center border-t border-slate-100 bg-slate-50/60">
              <span className="text-xs text-brand-700 font-semibold">Showing most recent 500 entries. Narrow the range to see more.</span>
            </div>
          )}
        </div>

        {/* DETAIL */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <section className="rounded-2xl bg-white border border-slate-200 shadow-card">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-ink-strong">Speaking details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/speaking/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="speaking_logs" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                Pick an item from the list to see details.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-brand-100 text-brand-600">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-ink-strong text-lg leading-tight flex items-center gap-1">
                      {selected.word_or_phrase ? `"${selected.word_or_phrase}"` : CAT_LABEL[selected.category]}
                      {selected.is_first_use && <Sparkles className="h-4 w-4 text-coral-500" />}
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(selected.observed_at)}
                    </div>
                  </div>
                  {selected.is_first_use && (
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-coral-50 text-coral-700">
                      First time!
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Category</div>
                    <div className="text-base font-bold text-ink-strong leading-tight">{CAT_LABEL[selected.category]}</div>
                  </div>
                  {selected.language && (
                    <div className="rounded-xl bg-mint-50 border border-mint-100 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-mint-700 font-semibold">Language</div>
                      <div className="text-base font-bold text-ink-strong leading-tight uppercase">{selected.language}</div>
                    </div>
                  )}
                </div>

                {selected.context && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Context</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.context}</p>
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Notes</div>
                    <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Logged on</div>
                  <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="speaking_list" title="Page comments" />
    </PageShell>
  );
}

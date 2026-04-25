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
import { ScanLine, Plus, Edit3, ArrowRight, Clock, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ultrasounds' };

type Row = {
  id: string;
  scanned_at: string;
  gestational_week: number | null;
  gestational_day: number | null;
  efw_g: number | null;
  fhr_bpm: number | null;
  sex_predicted: string | null;
  summary: string | null;
  anomalies: string | null;
  created_at: string;
};

function groupHeading(iso: string): string {
  const today = todayLocalDate();
  const y = yesterdayLocalDate();
  const k = localDayKey(iso);
  if (k === today) return `Today, ${fmtDate(iso)}`;
  if (k === y)     return `Yesterday, ${fmtDate(iso)}`;
  return fmtDate(iso);
}

export default async function UltrasoundsList({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { range?: string; start?: string; end?: string; id?: string };
}) {
  const supabase = createClient();
  const range = parseRangeParam(searchParams);
  const perms = await assertRole(params.babyId, {});

  const { data: rowsData } = await supabase.from('ultrasounds')
    .select('id,scanned_at,gestational_week,gestational_day,efw_g,fhr_bpm,sex_predicted,summary,anomalies,created_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .gte('scanned_at', range.start).lte('scanned_at', range.end)
    .order('scanned_at', { ascending: false }).limit(500);
  const rows = (rowsData ?? []) as Row[];

  // Group rows by day
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = localDayKey(r.scanned_at);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const groups = Array.from(buckets.entries()).map(([k, list]) => ({
    k, heading: groupHeading(list[0]!.scanned_at), list,
  }));

  const selected = searchParams.id ? rows.find(r => r.id === searchParams.id) : rows[0];

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Prenatal" eyebrowTint="brand"
        title="Ultrasounds"
        subtitle="All recorded ultrasound scans."
        right={
          perms.canWriteLogs ? (
            <div className="flex items-center gap-2">
              <BulkDelete babyId={params.babyId} table="ultrasounds" timeColumn="scanned_at"
                visibleIds={rows.map(r => r.id)} kindLabel="ultrasounds" />
              <Link href={`/babies/${params.babyId}/prenatal/ultrasounds/new`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-lavender-500 hover:brightness-105 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> Add scan
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
              No ultrasounds in this window.
            </div>
          )}

          {groups.map(g => (
            <section key={g.k}>
              <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{g.heading}</div>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.list.map(u => {
                  const active = selected?.id === u.id;
                  const ga = u.gestational_week != null ? `${u.gestational_week}w${u.gestational_day != null ? ` ${u.gestational_day}d` : ''}` : null;
                  const bits: string[] = [];
                  if (u.efw_g != null) bits.push(`EFW ${u.efw_g}g`);
                  if (u.fhr_bpm != null) bits.push(`${u.fhr_bpm} bpm`);
                  if (u.sex_predicted && u.sex_predicted !== 'undetermined') bits.push(u.sex_predicted);
                  const subline = bits.join(' · ') || u.summary || '';
                  return (
                    <li key={u.id}>
                      <Link href={`/babies/${params.babyId}/prenatal/ultrasounds?range=${range.key}&id=${u.id}`}
                        className={`grid grid-cols-[76px_44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 transition ${active ? 'bg-brand-50/60' : ''}`}>
                        <div className="text-right">
                          <div className="text-sm font-bold text-ink-strong leading-tight">
                            {fmtTime(u.scanned_at)}
                          </div>
                        </div>
                        <span className="h-10 w-10 rounded-xl grid place-items-center shrink-0 bg-brand-100 text-brand-600">
                          <ScanLine className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-ink-strong truncate">Ultrasound</div>
                          {subline && <div className="text-xs text-ink-muted truncate">{subline}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {ga && <span className="text-sm font-semibold text-ink-strong whitespace-nowrap">{ga}</span>}
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
              <h3 className="text-sm font-bold text-ink-strong">Scan details</h3>
              {selected && perms.canWriteLogs && (
                <div className="flex items-center gap-1.5">
                  <Link href={`/babies/${params.babyId}/prenatal/ultrasounds/${selected.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    <Edit3 className="h-3 w-3" /> Edit
                  </Link>
                  <LogRowDelete table="ultrasounds" id={selected.id} />
                </div>
              )}
            </div>

            {!selected ? (
              <div className="p-8 text-center text-sm text-ink-muted">
                Pick an item from the list to see details.
              </div>
            ) : (
              <div className="p-5 space-y-4">
                {(() => {
                  const ga = selected.gestational_week != null ? `${selected.gestational_week}w${selected.gestational_day != null ? ` ${selected.gestational_day}d` : ''}` : null;
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="h-11 w-11 rounded-xl grid place-items-center shrink-0 bg-brand-100 text-brand-600">
                          <ScanLine className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-ink-strong">Ultrasound scan</div>
                          <div className="text-xs text-ink-muted flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmtDateTime(selected.scanned_at)}
                          </div>
                        </div>
                        {ga && (
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-brand-50 text-brand-700">
                            {ga}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {selected.efw_g != null && (
                          <div className="rounded-xl bg-brand-50 border border-brand-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-brand-700 font-semibold">Estimated weight</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{selected.efw_g}<span className="text-xs text-ink-muted ml-1 font-normal">g</span></div>
                          </div>
                        )}
                        {selected.fhr_bpm != null && (
                          <div className="rounded-xl bg-coral-50 border border-coral-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold">Fetal HR</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight">{selected.fhr_bpm}<span className="text-xs text-ink-muted ml-1 font-normal">bpm</span></div>
                          </div>
                        )}
                        {selected.sex_predicted && selected.sex_predicted !== 'undetermined' && (
                          <div className="rounded-xl bg-lavender-50 border border-lavender-100 px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-lavender-700 font-semibold">Sex</div>
                            <div className="text-xl font-bold text-ink-strong leading-tight capitalize">{selected.sex_predicted}</div>
                          </div>
                        )}
                      </div>

                      {selected.summary && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Summary</div>
                          <p className="text-sm text-ink mt-0.5 whitespace-pre-wrap">{selected.summary}</p>
                        </div>
                      )}

                      {selected.anomalies && (
                        <div className="rounded-xl bg-coral-50 border border-coral-200 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-coral-700 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Anomalies
                          </div>
                          <p className="text-sm text-coral-900 mt-0.5 whitespace-pre-wrap">{selected.anomalies}</p>
                        </div>
                      )}

                      <div className="border-t border-slate-100 pt-3">
                        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Logged on</div>
                        <div className="text-sm text-ink">{fmtDateTime(selected.created_at)}</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        </div>
      </div>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_ultrasounds_list" title="Page comments" />
    </PageShell>
  );
}

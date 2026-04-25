import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { ScanLine, Plus, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Ultrasounds' };

type Row = {
  id: string; scanned_at: string; gestational_week: number | null; gestational_day: number | null;
  efw_g: number | null; fhr_bpm: number | null; sex_predicted: string | null;
  summary: string | null; anomalies: string | null;
};

export default async function UltrasoundsList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { isParent } = await assertRole(params.babyId, {});

  const { data: rows } = await supabase.from('ultrasounds').select('*')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('scanned_at', { ascending: false });
  const list = (rows ?? []) as Row[];

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Prenatal" eyebrowTint="brand" title="Ultrasounds"
        right={isParent ? (
          <Link href={`/babies/${params.babyId}/prenatal/ultrasounds/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> Add scan
          </Link>
        ) : undefined} />

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
          <ScanLine className="h-8 w-8 mx-auto text-ink-muted/60" />
          <p className="text-sm text-ink-muted mt-3">No ultrasounds yet.</p>
          {isParent && (
            <Link href={`/babies/${params.babyId}/prenatal/ultrasounds/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2">
              <Plus className="h-4 w-4" /> Add first scan
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map(u => {
            const ga = u.gestational_week != null ? `${u.gestational_week}w${u.gestational_day != null ? ` ${u.gestational_day}d` : ''}` : null;
            return (
              <li key={u.id}>
                <Link href={`/babies/${params.babyId}/prenatal/ultrasounds/${u.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-card transition">
                  <div className="flex items-start gap-3">
                    <span className="h-9 w-9 rounded-xl bg-brand-100 text-brand-700 grid place-items-center shrink-0">
                      <ScanLine className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-ink-strong">{fmtDate(u.scanned_at)}</div>
                        {ga && <span className="text-[11px] uppercase tracking-wider text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">{ga}</span>}
                        {u.sex_predicted && u.sex_predicted !== 'undetermined' && (
                          <span className="text-[11px] uppercase tracking-wider text-coral-700 bg-coral-50 px-2 py-0.5 rounded-full">{u.sex_predicted}</span>
                        )}
                        <span className="ml-auto text-[11px] text-ink-muted">{fmtRelative(u.scanned_at)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-ink">
                        {u.efw_g != null && <span>⚖ EFW {u.efw_g} g</span>}
                        {u.fhr_bpm != null && <span>♥ {u.fhr_bpm} bpm</span>}
                      </div>
                      {u.summary && <p className="mt-1.5 text-xs text-ink-muted line-clamp-2">{u.summary}</p>}
                      {u.anomalies && <p className="mt-1 text-xs text-coral-700 line-clamp-2">⚠ {u.anomalies}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 mt-3" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

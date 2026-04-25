import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { Stethoscope, Plus, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prenatal visits' };

type VisitRow = {
  id: string; visited_at: string; gestational_week: number | null; gestational_day: number | null;
  maternal_weight_kg: number | null; bp_systolic: number | null; bp_diastolic: number | null;
  fetal_heart_rate_bpm: number | null; fundal_height_cm: number | null;
  doctor_id: string | null; notes: string | null;
};

export default async function VisitsList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { isParent } = await assertRole(params.babyId, {});

  const [{ data: rows }, { data: doctors }] = await Promise.all([
    supabase.from('prenatal_visits').select('*')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('visited_at', { ascending: false }),
    supabase.from('doctors').select('id,name')
      .eq('baby_id', params.babyId).is('deleted_at', null),
  ]);
  const visits = (rows ?? []) as VisitRow[];
  const docMap: Record<string, string> = Object.fromEntries(((doctors ?? []) as { id: string; name: string }[]).map(d => [d.id, d.name]));

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Prenatal" eyebrowTint="lavender" title="Prenatal visits"
        right={isParent ? (
          <Link href={`/babies/${params.babyId}/prenatal/visits/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> Log visit
          </Link>
        ) : undefined} />

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-10 text-center">
          <Stethoscope className="h-8 w-8 mx-auto text-ink-muted/60" />
          <p className="text-sm text-ink-muted mt-3">No prenatal visits yet.</p>
          {isParent && (
            <Link href={`/babies/${params.babyId}/prenatal/visits/new`}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-sm font-semibold px-4 py-2">
              <Plus className="h-4 w-4" /> Log first visit
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visits.map(v => {
            const ga = v.gestational_week != null ? `${v.gestational_week}w${v.gestational_day != null ? ` ${v.gestational_day}d` : ''}` : null;
            const bp = v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null;
            return (
              <li key={v.id}>
                <Link href={`/babies/${params.babyId}/prenatal/visits/${v.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-card transition">
                  <div className="flex items-start gap-3">
                    <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
                      <Stethoscope className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-semibold text-ink-strong">{fmtDate(v.visited_at)}</div>
                        {ga && <span className="text-[11px] uppercase tracking-wider text-lavender-700 bg-lavender-50 px-2 py-0.5 rounded-full">{ga}</span>}
                        {v.doctor_id && docMap[v.doctor_id] && <span className="text-xs text-ink-muted">· {docMap[v.doctor_id]}</span>}
                        <span className="ml-auto text-[11px] text-ink-muted">{fmtRelative(v.visited_at)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-ink">
                        {v.maternal_weight_kg != null && <span>⚖ {v.maternal_weight_kg.toFixed(1)} kg</span>}
                        {bp                         && <span>🩺 {bp}</span>}
                        {v.fetal_heart_rate_bpm != null && <span>♥ {v.fetal_heart_rate_bpm} bpm</span>}
                        {v.fundal_height_cm != null && <span>📏 {v.fundal_height_cm} cm</span>}
                      </div>
                      {v.notes && <p className="mt-1.5 text-xs text-ink-muted line-clamp-2">{v.notes}</p>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 mt-3" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_visits_list" title="Page comments" />
    </PageShell>
  );
}

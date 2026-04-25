import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { KickCounter } from '@/components/forms/KickCounter';
import { fmtDateTime, fmtRelative } from '@/lib/dates';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Kick counter' };

type KickRow = {
  id: string; counted_at: string; duration_min: number; movements: number; notes: string | null;
};

export default async function KicksPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { isParent } = await assertRole(params.babyId, {});

  const { data: rows } = await supabase.from('fetal_movements')
    .select('id,counted_at,duration_min,movements,notes')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('counted_at', { ascending: false }).limit(30);
  const sessions = (rows ?? []) as KickRow[];

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Prenatal" eyebrowTint="coral" title="Kick counter"
        subtitle="Settle in, watch baby move, tap the big button each time you feel a kick. After 28 weeks, aim for ≥10 kicks within 2 hours." />

      {isParent && <KickCounter babyId={params.babyId} />}

      {/* Session history */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider px-1">Recent sessions</h3>
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center text-sm text-ink-muted">
            No kick sessions logged yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {sessions.map(s => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
                  <Activity className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-strong">
                    {s.movements} kicks · {s.duration_min} min
                  </div>
                  <div className="text-[11px] text-ink-muted">{fmtDateTime(s.counted_at)} · {fmtRelative(s.counted_at)}</div>
                  {s.notes && <div className="text-xs text-ink mt-0.5 line-clamp-1">{s.notes}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_kicks_list" title="Page comments" />
    </PageShell>
  );
}

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Comments } from '@/components/Comments';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { bpCategory } from '@/lib/lifecycle';
import { Heart, Activity, Plus, Stethoscope } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Maternal vitals' };

type Row = {
  id: string; visited_at: string; gestational_week: number | null;
  maternal_weight_kg: number | null; bp_systolic: number | null; bp_diastolic: number | null;
};

export default async function MaternalVitals({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { isParent } = await assertRole(params.babyId, {});

  const { data: rows } = await supabase.from('prenatal_visits')
    .select('id,visited_at,gestational_week,maternal_weight_kg,bp_systolic,bp_diastolic')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('visited_at', { ascending: false }).limit(60);
  const list = (rows ?? []) as Row[];

  // Pull weight + bp series for a small chart-ish overview
  const withWeight = list.filter(r => r.maternal_weight_kg != null).reverse();
  const withBp = list.filter(r => r.bp_systolic != null && r.bp_diastolic != null);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="Pregnancy"
        eyebrow="Prenatal" eyebrowTint="peach" title="Maternal vitals"
        subtitle="Weight and blood pressure trends. Add new readings via prenatal visit logs."
        right={isParent ? (
          <Link href={`/babies/${params.babyId}/prenatal/visits/new`}
            className="inline-flex items-center gap-1.5 rounded-full bg-peach-500 hover:bg-peach-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
            <Plus className="h-4 w-4" /> New reading
          </Link>
        ) : undefined} />

      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard title="Weight" icon={Heart} tint="coral">
          {withWeight.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No weight readings yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {withWeight.slice(-12).reverse().map(r => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-muted">{fmtDate(r.visited_at)}{r.gestational_week != null ? ` · ${r.gestational_week}w` : ''}</span>
                  <span className="font-semibold text-ink-strong tabular-nums">{r.maternal_weight_kg!.toFixed(1)} kg</span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Blood pressure" icon={Activity} tint="brand">
          {withBp.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No BP readings yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {withBp.slice(0, 12).map(r => {
                const cat = bpCategory(r.bp_systolic, r.bp_diastolic);
                const tint = cat === 'hypertensive' ? 'text-coral-700'
                          : cat === 'elevated'     ? 'text-peach-700'
                          : 'text-mint-700';
                return (
                  <li key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink-muted">{fmtDate(r.visited_at)}{r.gestational_week != null ? ` · ${r.gestational_week}w` : ''}</span>
                    <span className={`font-semibold tabular-nums ${tint}`}>{r.bp_systolic}/{r.bp_diastolic}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <p className="text-xs text-ink-muted px-1">
        New readings are added by logging a <Link href={`/babies/${params.babyId}/prenatal/visits/new`} className="text-brand-600 hover:underline inline-flex items-center gap-1"><Stethoscope className="h-3 w-3" /> prenatal visit</Link>. Self-readings — leave the doctor field blank.
      </p>
      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        pageScope="prenatal_maternal_vitals_list" title="Page comments" />
    </PageShell>
  );
}

function SectionCard({ title, icon: Icon, tint, children }: {
  title: string; icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'brand'|'peach'|'lavender'|'mint';
  children: React.ReactNode;
}) {
  const map = {
    coral:    'bg-coral-100 text-coral-600',
    brand:    'bg-brand-100 text-brand-600',
    peach:    'bg-peach-100 text-peach-600',
    lavender: 'bg-lavender-100 text-lavender-600',
    mint:     'bg-mint-100 text-mint-600',
  }[tint];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-7 w-7 rounded-lg grid place-items-center ${map}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-ink-strong uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </section>
  );
}

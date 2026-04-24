import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/role-guard';
import { TemperatureForm } from '@/components/forms/TemperatureForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { fmtDateTime } from '@/lib/dates';
import { Thermometer } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log temperature' };

export default async function NewTemperature({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireWrite: true });
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: recent } = await supabase
    .from('temperature_logs')
    .select('id,measured_at,temperature_c,method')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('measured_at', { ascending: false }).limit(5);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      <div className="mb-6">
        <Link href={`/babies/${params.babyId}`}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm text-ink hover:bg-slate-50 shadow-sm">
          ← Back to dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-ink-strong">
            Log temperature <span role="img" aria-label="thermometer">🌡️</span>
          </h1>
          <p className="mt-2 text-ink">Any time you feel baby might be warm — or just for peace of mind.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          <TemperatureForm babyId={params.babyId} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-ink-muted uppercase tracking-wider mb-2">Normal ranges</div>
              <ul className="text-sm space-y-1">
                <li className="flex items-center justify-between"><span>Axillary</span><span className="text-ink-muted">36.5–37.5 °C</span></li>
                <li className="flex items-center justify-between"><span>Oral</span><span className="text-ink-muted">36.5–37.5 °C</span></li>
                <li className="flex items-center justify-between"><span>Rectal</span><span className="text-ink-muted">36.6–38.0 °C</span></li>
                <li className="flex items-center justify-between"><span>Ear/forehead</span><span className="text-ink-muted">35.8–38.0 °C</span></li>
              </ul>
              <div className="mt-3 rounded-xl bg-coral-50 px-3 py-2 text-xs text-coral-700">
                Fever: ≥ 38 °C rectal or ≥ 37.5 °C axillary. Call your pediatrician if baby is &lt; 3 months old.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-sm font-semibold text-ink-strong mb-3">Recent readings</div>
              {(recent ?? []).length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
              <ul className="space-y-2">
                {recent?.map(r => (
                  <li key={r.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-coral-100 text-coral-600 grid place-items-center shrink-0">
                      <Thermometer className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-semibold text-ink-strong">{Number(r.temperature_c).toFixed(1)} °C</div>
                      <div className="text-xs text-ink-muted truncate">{r.method}</div>
                    </div>
                    <span className="text-xs text-ink-muted">{fmtDateTime(r.measured_at).split(' · ')[1] ?? ''}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

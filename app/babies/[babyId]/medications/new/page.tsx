import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MedicationForm } from '@/components/forms/MedicationForm';
import { Card, CardContent } from '@/components/ui/Card';
import { fmtDate, fmtDateTime } from '@/lib/dates';
import { Pill, Lightbulb, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Add medication' };

export default async function NewMedication({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: recent } = await supabase
    .from('medications')
    .select('id,name,dosage,route,frequency_hours,starts_at,ends_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(5);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
      <div className="mb-6">
        <Link href={`/babies/${params.babyId}/medications`}
          className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-sm text-ink hover:bg-slate-50 shadow-sm">
          ← Back to medications
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-lavender-700">New prescription</div>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-ink-strong">
            Add medication <span role="img" aria-label="pill">💊</span>
          </h1>
          <p className="mt-2 text-ink">Name, dosage, frequency, start/end — every field becomes a reminder later.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          <MedicationForm babyId={params.babyId} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-xs text-ink-muted uppercase tracking-wider mb-2">
                <Lightbulb className="h-4 w-4 text-peach-500" /> Tips
              </div>
              <ul className="text-sm space-y-2">
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>Always include the <strong>unit</strong> with the dosage (e.g. <em>5 ml</em>, not just <em>5</em>).</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>Frequency presets cover most prescriptions — pick <em>Custom</em> only for unusual intervals.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-lavender-500 mt-0.5 shrink-0" />
                  <span>Set an end date when possible — reminders stop automatically when the course is done.</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-sm font-semibold text-ink-strong mb-3">Other prescriptions</div>
              {(recent ?? []).length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
              <ul className="space-y-2">
                {recent?.map(m => {
                  const active = !m.ends_at || new Date(m.ends_at).getTime() > Date.now();
                  return (
                    <li key={m.id} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                        <Pill className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-sm">
                        <div className="font-semibold text-ink-strong truncate">{m.name}{m.dosage ? ` · ${m.dosage}` : ''}</div>
                        <div className="text-xs text-ink-muted truncate">
                          every {m.frequency_hours ?? '—'}h · started {fmtDate(m.starts_at)}
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-mint-100 text-mint-700' : 'bg-slate-100 text-ink-muted'}`}>
                        {active ? 'Active' : 'Ended'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {recent && recent.length > 0 && (
                <p className="mt-3 text-xs text-ink-muted">Last added {fmtDateTime(recent[0]!.starts_at)}.</p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

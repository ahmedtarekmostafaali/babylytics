import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SleepForm } from '@/components/forms/SleepForm';
import { Card, CardContent } from '@/components/ui/Card';
import { fmtDateTime } from '@/lib/dates';
import { Moon } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Log sleep' };

function fmtDuration(min: number | null | undefined) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default async function NewSleep({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: recent } = await supabase
    .from('sleep_logs')
    .select('id,start_at,end_at,duration_min,location,quality')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('start_at', { ascending: false }).limit(5);

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
            Log sleep <span role="img" aria-label="moon">🌙</span>
          </h1>
          <p className="mt-2 text-ink">Start a live timer, or log a session you already finished.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
          <SleepForm babyId={params.babyId} />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardContent className="py-4">
              <div className="text-xs text-ink-muted uppercase tracking-wider mb-2">Typical daily sleep</div>
              <ul className="text-sm space-y-1">
                <li className="flex items-center justify-between"><span>0–3 months</span><span className="text-ink-muted">14–17h</span></li>
                <li className="flex items-center justify-between"><span>4–11 months</span><span className="text-ink-muted">12–15h</span></li>
                <li className="flex items-center justify-between"><span>1–2 years</span><span className="text-ink-muted">11–14h</span></li>
                <li className="flex items-center justify-between"><span>3–5 years</span><span className="text-ink-muted">10–13h</span></li>
              </ul>
              <div className="mt-3 rounded-xl bg-lavender-50 px-3 py-2 text-xs text-lavender-700">
                Pro tip: babies who sleep well in the day often sleep better at night too.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="text-sm font-semibold text-ink-strong mb-3">Recent sessions</div>
              {(recent ?? []).length === 0 && <p className="text-sm text-ink-muted">None yet.</p>}
              <ul className="space-y-2">
                {recent?.map(r => (
                  <li key={r.id} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                      <Moon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm">
                      <div className="font-semibold text-ink-strong">{fmtDuration(r.duration_min)}</div>
                      <div className="text-xs text-ink-muted truncate">{r.location} · {fmtDateTime(r.start_at).split(' · ')[1] ?? ''}</div>
                    </div>
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

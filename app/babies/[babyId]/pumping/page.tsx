import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { fmtDateTime, fmtRelative } from '@/lib/dates';
import { PumpingForm } from '@/components/forms/PumpingForm';
import { PumpingRowActions } from '@/components/PumpingRowActions';
import { Droplet } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pumping log' };

interface Row {
  id:           string;
  started_at:   string;
  ended_at:     string | null;
  duration_min: number | null;
  side:         'left' | 'right' | 'both';
  volume_ml:    number | null;
  location:     'home' | 'work' | 'car' | 'other' | null;
  notes:        string | null;
}

export default async function PumpingLogPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: baby } = await supabase.from('babies')
    .select('id,name,lifecycle_stage')
    .eq('id', params.babyId).single();
  if (!baby) notFound();

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const { data: rows } = await supabase.rpc('list_pumping_logs', { p_baby: params.babyId, p_limit: 100 });
  const logs = (rows ?? []) as Row[];

  // Quick rolling stats: today + last 7 days totals.
  const now    = Date.now();
  const dayMs  = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const todayMs = startOfToday.getTime();
  let todayMl = 0, weekMl = 0, todayMin = 0, weekMin = 0;
  for (const r of logs) {
    const t = new Date(r.started_at).getTime();
    if (t >= todayMs && r.volume_ml)        todayMl += r.volume_ml;
    if (t >= todayMs && r.duration_min)     todayMin += r.duration_min;
    if (t >= now - 7 * dayMs && r.volume_ml)    weekMl += r.volume_ml;
    if (t >= now - 7 * dayMs && r.duration_min) weekMin += r.duration_min;
  }

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow={isAr ? 'ما بعد الولادة' : 'POSTPARTUM'}
        eyebrowTint="coral"
        title={isAr ? 'سجل شفط الحليب' : 'Pumping log'}
        subtitle={isAr
          ? 'احفظي جلسات الشفط بالكمية والمدة. مفيد لمتابعة الإنتاج اليومي + التخزين.'
          : 'Track pumping sessions with volume + duration. Useful for daily output + freezer-stash visibility.'} />

      {/* Quick stats */}
      {logs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label={isAr ? 'اليوم (مل)'  : 'Today (ml)'}     value={todayMl} />
          <Stat label={isAr ? 'اليوم (د)'   : 'Today (min)'}    value={todayMin} />
          <Stat label={isAr ? 'الأسبوع (مل)' : 'This week (ml)'} value={weekMl} />
          <Stat label={isAr ? 'الأسبوع (د)' : 'This week (min)'} value={weekMin} />
        </div>
      )}

      <PumpingForm babyId={params.babyId} lang={userPrefs.language} />

      {/* Timeline */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted px-1">
          {isAr ? `كل الجلسات (${logs.length})` : `All sessions (${logs.length})`}
        </h3>
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
            <Droplet className="h-6 w-6 mx-auto mb-2 text-ink-muted" />
            {isAr ? 'لا توجد جلسات بعد. ابدئي بالنموذج بالأعلى.' : 'No sessions yet. Start with the form above.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
            {logs.map(r => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${
                    r.ended_at ? 'bg-mint-100 text-mint-700' : 'bg-coral-100 text-coral-700 animate-pulse'
                  }`}>
                    <Droplet className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-strong">
                      {r.volume_ml ? `${r.volume_ml} ml` : (isAr ? 'بدون كمية' : 'No volume')}
                      {r.duration_min ? ` · ${r.duration_min} min` : (r.ended_at ? '' : (isAr ? ' · جارية' : ' · running'))}
                      <span className="ms-2 text-[10px] uppercase tracking-wider rounded-full bg-slate-100 text-ink-muted px-1.5 py-0.5">
                        {r.side === 'both' ? (isAr ? 'الاثنين' : 'Both') :
                         r.side === 'left' ? (isAr ? 'يسار' : 'Left') :
                                             (isAr ? 'يمين' : 'Right')}
                      </span>
                      {r.location && r.location !== 'home' && (
                        <span className="ms-1 text-[10px] uppercase tracking-wider rounded-full bg-slate-100 text-ink-muted px-1.5 py-0.5">
                          {isAr
                            ? (r.location === 'work' ? 'عمل' : r.location === 'car' ? 'سيارة' : 'أخرى')
                            : r.location}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      <span title={fmtDateTime(r.started_at)}>{fmtRelative(r.started_at)}</span>
                    </div>
                    {r.notes && (
                      <p className="mt-1 text-xs text-ink leading-relaxed whitespace-pre-wrap break-words">{r.notes}</p>
                    )}
                  </div>
                  <PumpingRowActions id={r.id} isOpen={!r.ended_at} lang={userPrefs.language} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className="mt-1 text-xl font-bold text-ink-strong tabular-nums">{value}</div>
    </div>
  );
}

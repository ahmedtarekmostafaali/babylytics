import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';
import { fmtDate } from '@/lib/dates';
import { Calendar, Heart, Plus, Sparkles, Edit3 } from 'lucide-react';
import { MarkAsPregnantDialog } from '@/components/MarkAsPregnantDialog';
import { ConsultationComingSoon } from '@/components/ConsultationComingSoon';
import { SuggestionsCard } from '@/components/SuggestionsCard';
import { cyclePhaseFor } from '@/lib/suggestions';
import { loadUserPrefs } from '@/lib/user-prefs';
import { CycleModeCard, type CycleMode } from '@/components/CycleModeCard';
import { CycleRedFlagsCard, type CycleRedFlag } from '@/components/CycleRedFlagsCard';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My cycle' };

type CalRow = {
  d: string;        // YYYY-MM-DD
  phase: 'period'|'follicular'|'fertile'|'ovulation'|'luteal'|'unknown';
  fertility: 'none'|'low'|'medium'|'high'|'peak';
};
type Cycle = {
  id: string; period_start: string; period_end: string | null;
  cycle_length: number | null; flow_intensity: string | null;
  symptoms: string[] | null; notes: string | null;
};

const PHASE_TINT: Record<CalRow['phase'], string> = {
  period:      'bg-coral-200    text-coral-900    border-coral-300',
  fertile:     'bg-mint-200     text-mint-900     border-mint-300',
  ovulation:   'bg-mint-500     text-white        border-mint-600',
  follicular:  'bg-slate-100    text-ink          border-slate-200',
  luteal:      'bg-lavender-100 text-lavender-800 border-lavender-200',
  unknown:     'bg-white        text-ink-muted    border-slate-200',
};
const FERTILITY_LABEL: Record<CalRow['fertility'], string> = {
  none:    '',
  low:     'low',
  medium:  'med',
  high:    'high',
  peak:    'peak',
};

function isoMonth(d: Date): string { return d.toISOString().slice(0, 7); }
function startOfMonth(s: string): Date { const [y,m] = s.split('-').map(Number); return new Date(Date.UTC(y, (m ?? 1) - 1, 1)); }
function addMonths(s: string, delta: number): string {
  const d = startOfMonth(s); d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export default async function PlannerPage({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { month?: string };
}) {
  const supabase = createClient();
  await assertRole(params.babyId, { requireLogs: true });

  const { data: baby } = await supabase.from('babies')
    .select('id,name,lifecycle_stage,cycle_mode')
    .eq('id', params.babyId).single();
  if (!baby) notFound();
  const cycleMode = ((baby as { cycle_mode?: CycleMode | null }).cycle_mode ?? null);

  // Default to current month in user's locale (server is UTC; close enough).
  const month = (searchParams.month && /^\d{4}-\d{2}$/.test(searchParams.month))
    ? searchParams.month
    : isoMonth(new Date());
  const monthStart = month + '-01';

  const [{ data: calData, error: calErr }, { data: cycleData }, userPrefs, { data: redFlagsRaw }] = await Promise.all([
    supabase.rpc('cycle_calendar', { p_baby: params.babyId, p_month: monthStart }),
    supabase.from('menstrual_cycles')
      .select('id,period_start,period_end,cycle_length,flow_intensity,symptoms,notes')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('period_start', { ascending: false })
      .limit(12),
    loadUserPrefs(supabase),
    // Wave 12: anomaly detection from your own historical cycles. Returns
    // empty when there's no signal to act on (which is the common case).
    supabase.rpc('cycle_red_flags', { p_baby: params.babyId }),
  ]);
  const redFlags = (redFlagsRaw ?? []) as CycleRedFlag[];
  const calendar = (calData ?? []) as CalRow[];
  const cycles   = (cycleData ?? []) as Cycle[];

  // Wave 5: derive current cycle phase + days-since-period for the
  // SuggestionsCard. Only meaningful once at least one cycle is logged.
  const lastForPhase = cycles[0];
  let cycleMarker: number | null = null;
  let cyclePhase: ReturnType<typeof cyclePhaseFor> | undefined;
  if (lastForPhase) {
    const start = new Date(lastForPhase.period_start + 'T00:00:00Z');
    const now = Date.now();
    const days = Math.max(0, Math.floor((now - start.getTime()) / 86400000));
    cycleMarker = days;
    cyclePhase = cyclePhaseFor(days, lastForPhase.cycle_length ?? 28);
  }

  // Project the next period: most recent cycle.start + cycle_length.
  const last = cycles[0];
  let nextPeriod: string | null = null;
  let nextOvulation: string | null = null;
  if (last) {
    const len = last.cycle_length ?? 28;
    const start = new Date(last.period_start + 'T00:00:00Z');
    const next = new Date(start.getTime() + len * 86400000);
    nextPeriod   = next.toISOString().slice(0, 10);
    const ov = new Date(start.getTime() + (len - 14) * 86400000);
    nextOvulation = ov.toISOString().slice(0, 10);
  }

  // Calendar grid alignment: build a 6×7 grid starting on the first Sunday
  // of the visible week. We pad with leading/trailing days from adj months
  // (rendered grey, not clickable).
  const monthDate = startOfMonth(monthStart);
  const monthEnd  = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0));
  const firstDow  = monthDate.getUTCDay(); // 0=Sun
  const cells: { date: string | null; row?: CalRow }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ date: null });
  for (let d = 1; d <= monthEnd.getUTCDate(); d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ date: iso, row: calendar.find(r => r.d === iso) });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <PageShell max="5xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Track"
        eyebrowTint="coral"
        title="My cycle"
        subtitle="Period, ovulation, fertile window, symptoms — for planning, postpartum, or just personal."
        right={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link href={`/babies/${params.babyId}/planner/cycles/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-coral-500 to-coral-600 text-white text-sm font-semibold px-4 py-2 shadow-sm">
              <Plus className="h-4 w-4" /> Log period
            </Link>
            {/* Wave 15: Apple Health import — open the import wizard. */}
            <Link href={`/babies/${params.babyId}/import/apple-health`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-ink text-sm font-semibold px-4 py-2 shadow-sm">
              <Download className="h-4 w-4" /> Import from Apple Health
            </Link>
            {/* "I'm pregnant!" → transitions stage to 'pregnancy', preserving
                cycle history. Only meaningful when the profile is still in
                planning mode, which is the only place this page is reachable. */}
            <MarkAsPregnantDialog babyId={params.babyId} />
          </div>
        }
      />

      {/* Wave 12: cycle mode picker + red flags. Mode picker is always
          visible (small, tap-to-edit). Red flags only render when there's
          something detected from the user's own historical patterns. */}
      <CycleModeCard babyId={params.babyId} initialMode={cycleMode} />
      <CycleRedFlagsCard flags={redFlags} babyId={params.babyId} />

      {/* Top insight strip */}
      <section className="grid sm:grid-cols-3 gap-3">
        <Tile icon={Calendar} tint="coral"
          label="Last period"
          value={last ? fmtDate(last.period_start) : '—'}
          sub={last?.cycle_length ? `${last.cycle_length}-day cycle` : 'log to start'} />
        <Tile icon={Heart} tint="mint"
          label="Next ovulation"
          value={nextOvulation ? fmtDate(nextOvulation) : '—'}
          sub={nextOvulation ? "Peak fertility window opens 5 days before" : 'needs 1 cycle log'} />
        <Tile icon={Sparkles} tint="lavender"
          label="Next period due"
          value={nextPeriod ? fmtDate(nextPeriod) : '—'}
          sub={nextPeriod ? 'projected from your cycle length' : ''} />
      </section>

      {/* Month nav + calendar */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <Link href={`/babies/${params.babyId}/planner?month=${addMonths(month, -1)}`}
            className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2 py-1 text-xs font-semibold text-ink">← Prev</Link>
          <h2 className="text-sm font-bold text-ink-strong">
            {new Date(monthStart + 'T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </h2>
          <Link href={`/babies/${params.babyId}/planner?month=${addMonths(month, 1)}`}
            className="rounded-lg border border-slate-200 hover:bg-slate-50 px-2 py-1 text-xs font-semibold text-ink">Next →</Link>
        </div>

        {calErr && (
          <div className="mx-5 my-3 rounded-xl bg-coral-50 border border-coral-200 px-3 py-2 text-xs text-coral-800">
            Couldn't load the calendar: {calErr.message}
          </div>
        )}

        <div className="px-5 py-4">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 text-[10px] font-bold uppercase tracking-wider text-ink-muted mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d} className="text-center">{d}</div>)}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((c, i) => {
              if (!c.date) return <div key={i} className="aspect-square rounded-xl bg-slate-50/40 border border-slate-100/60" />;
              const r = c.row;
              const tint = r ? PHASE_TINT[r.phase] : PHASE_TINT.unknown;
              const isToday = c.date === todayIso;
              return (
                <div key={i}
                  className={`aspect-square rounded-xl border ${tint} relative p-1 flex flex-col`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isToday ? 'underline underline-offset-2' : ''}`}>{c.date.slice(-2)}</span>
                    {r?.fertility === 'peak' && r.phase !== 'period' && <Heart className="h-3 w-3" />}
                  </div>
                  {r && r.fertility !== 'none' && r.phase !== 'period' && (
                    <div className="text-[9px] uppercase tracking-wider mt-auto opacity-80">{FERTILITY_LABEL[r.fertility]}</div>
                  )}
                  {r?.phase === 'period' && (
                    <div className="text-[9px] uppercase tracking-wider mt-auto opacity-80">period</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
            <Legend tint={PHASE_TINT.period}     label="Period" />
            <Legend tint={PHASE_TINT.follicular} label="Follicular" />
            <Legend tint={PHASE_TINT.fertile}    label="Fertile" />
            <Legend tint={PHASE_TINT.ovulation}  label="Ovulation (peak)" />
            <Legend tint={PHASE_TINT.luteal}     label="Luteal" />
          </div>
        </div>
      </section>

      {/* Wave 5 — "Ideas for today" — three cycle-phase-aware self-care
          suggestions (iron in menstrual, cardio in follicular, etc.). Only
          renders once at least one cycle is logged so we know the phase. */}
      <SuggestionsCard
        babyId={params.babyId}
        stage="cycle"
        marker={cycleMarker}
        phase={cyclePhase}
        mode={cycleMode}
        lang={userPrefs.language}
      />

      {/* Doctor consultation upsell — placeholder for now. Same component
          shown across pregnancy + baby overviews so users see the roadmap. */}
      <ConsultationComingSoon stage="cycle" />

      {/* Recent cycle log */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-strong">Recent cycles</h2>
          <Link href={`/babies/${params.babyId}/planner/cycles/new`}
            className="text-xs font-semibold text-coral-700 hover:underline">+ Log period</Link>
        </div>
        {cycles.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-muted">
            No cycles logged yet — add your last period to unlock the calendar.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cycles.map(c => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center text-xs font-bold shrink-0">
                  {new Date(c.period_start + 'T00:00:00Z').getUTCDate()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-strong">
                    {fmtDate(c.period_start)}
                    {c.period_end && <span className="text-ink-muted font-normal"> → {fmtDate(c.period_end)}</span>}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {c.cycle_length ?? 28}-day cycle · {c.flow_intensity ?? 'medium'} flow
                    {c.symptoms && c.symptoms.length > 0 && <> · {c.symptoms.join(', ')}</>}
                  </div>
                </div>
                <Link href={`/babies/${params.babyId}/planner/cycles/${c.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                  <Edit3 className="h-3 w-3" /> Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function Tile({ icon: Icon, tint, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'mint'|'lavender';
  label: string; value: React.ReactNode; sub?: string;
}) {
  const map = {
    coral:    'bg-coral-100 text-coral-600',
    mint:     'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600',
  }[tint];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
      <div className="flex items-center gap-2">
        <span className={`h-8 w-8 rounded-xl grid place-items-center shrink-0 ${map}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
      </div>
      <div className="mt-2 text-xl font-bold text-ink-strong tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-ink-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function Legend({ tint, label }: { tint: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-4 w-4 rounded-md border ${tint}`} />
      <span className="text-ink">{label}</span>
    </span>
  );
}

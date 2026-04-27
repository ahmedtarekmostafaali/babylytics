import { createClient } from '@/lib/supabase/server';
import { Sparkline } from '@/components/Sparkline';
import { Activity, Users, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

type DauRow    = { day: string; dau: number };
type SignupRow = { day: string; signups: number };
type TrackerRow = { tracker: string; events_7d: number; events_30d: number };

export default async function AdminEngagement({
  searchParams,
}: {
  searchParams: { range?: '7d' | '30d' | '90d' };
}) {
  const supabase = createClient();
  const range = (searchParams.range ?? '30d') as '7d'|'30d'|'90d';
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;

  const [{ data: dau }, { data: signups }, { data: trackers }] = await Promise.all([
    supabase.rpc('admin_dau_series',    { p_days: days }),
    supabase.rpc('admin_signup_series', { p_days: days }),
    supabase.rpc('admin_top_trackers'),
  ]);

  const dauRows     = (dau ?? []) as DauRow[];
  const signupRows  = (signups ?? []) as SignupRow[];
  const trackerRows = (trackers ?? []) as TrackerRow[];

  const dauValues    = dauRows.map(r => Number(r.dau || 0));
  const signupValues = signupRows.map(r => Number(r.signups || 0));

  const totalSignups = signupValues.reduce((a, b) => a + b, 0);
  const peakDau      = dauValues.length ? Math.max(...dauValues) : 0;
  const avgDau       = dauValues.length ? Math.round(dauValues.reduce((a, b) => a + b, 0) / dauValues.length) : 0;
  const todayDau     = dauValues[dauValues.length - 1] ?? 0;
  // Simple WoW change (last 7d vs prior 7d) regardless of selected range —
  // gives a stable engagement direction signal even on short windows.
  const last7  = dauValues.slice(-7).reduce((a, b) => a + b, 0);
  const prev7  = dauValues.slice(-14, -7).reduce((a, b) => a + b, 0);
  const wow    = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;

  const trackerMax30 = Math.max(1, ...trackerRows.map(r => Number(r.events_30d ?? 0)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-strong">Engagement</h2>
          <p className="text-xs text-ink-muted">How parents are actually using the app.</p>
        </div>
        <RangeTabs current={range} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={Activity}   tint="brand"    label="DAU today"     value={todayDau} />
        <Tile icon={Users}      tint="lavender" label={`Avg DAU · ${range}`} value={avgDau} />
        <Tile icon={TrendingUp} tint={wow != null && wow >= 0 ? 'mint' : 'coral'}
              label="DAU WoW"
              value={wow == null ? '—' : `${wow >= 0 ? '+' : ''}${wow}%`}
              sub={`${last7} vs ${prev7} active`} />
        <Tile icon={Activity}   tint="peach"    label="Peak DAU"      value={peakDau} />
      </div>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-ink-strong">Daily active users</h3>
            <p className="text-xs text-ink-muted">Distinct parents who logged any tracker entry that day.</p>
          </div>
        </div>
        {dauValues.some(v => v > 0) ? (
          <Sparkline data={dauValues} color="#B9A7D8" width={900} height={100} strokeWidth={2.5} />
        ) : (
          <EmptyChart message={`No tracker activity in the last ${days} days.`} />
        )}
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-ink-strong">Sign-ups</h3>
            <p className="text-xs text-ink-muted">{totalSignups} new accounts in the last {days} days.</p>
          </div>
        </div>
        {signupValues.some(v => v > 0) ? (
          <Sparkline data={signupValues} color="#7BAEDC" width={900} height={100} strokeWidth={2.5} />
        ) : (
          <EmptyChart message={`No new sign-ups in the last ${days} days.`} />
        )}
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <h3 className="text-sm font-bold text-ink-strong mb-4">Tracker usage · last 30d</h3>
        <ul className="space-y-3">
          {trackerRows.map(r => {
            const pct = Math.round((Number(r.events_30d ?? 0) / trackerMax30) * 100);
            return (
              <li key={r.tracker}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-ink-strong capitalize">{r.tracker}</span>
                  <span className="tabular-nums text-ink-muted">
                    {Number(r.events_30d ?? 0).toLocaleString()} <span className="text-[10px]">· {Number(r.events_7d ?? 0).toLocaleString()} this week</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-400 to-lavender-500"
                    style={{ width: `${Math.max(2, pct)}%` }} />
                </div>
              </li>
            );
          })}
          {trackerRows.length === 0 && <li className="text-sm text-ink-muted">No tracker data yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function RangeTabs({ current }: { current: '7d'|'30d'|'90d' }) {
  const ranges: ('7d'|'30d'|'90d')[] = ['7d', '30d', '90d'];
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 shadow-sm p-1">
      {ranges.map(r => (
        <a key={r} href={`/admin/engagement?range=${r}`}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${current === r ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink hover:bg-slate-50'}`}>
          {r}
        </a>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-24 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 grid place-items-center text-xs text-ink-muted">
      {message}
    </div>
  );
}

function Tile({ icon: Icon, tint, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'brand'|'coral'|'mint'|'peach'|'lavender';
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  const map = {
    brand:    'bg-brand-100 text-brand-600',
    coral:    'bg-coral-100 text-coral-600',
    mint:     'bg-mint-100 text-mint-600',
    peach:    'bg-peach-100 text-peach-600',
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
      <div className="mt-2 text-2xl font-bold text-ink-strong leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink-muted">{sub}</div>}
    </div>
  );
}

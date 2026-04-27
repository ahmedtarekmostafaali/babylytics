import { createClient } from '@/lib/supabase/server';
import { Sparkline } from '@/components/Sparkline';
import {
  Users, Baby, HeartPulse, UserPlus, Activity, MessageSquare, Languages,
  TrendingUp, Inbox,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Kpis = {
  total_users: number; total_babies: number; total_pregnancies: number;
  signups_24h: number; signups_7d: number; signups_30d: number;
  active_7d: number; active_30d: number;
  lang_ar: number; lang_en: number;
  feedback_total: number; feedback_open: number;
  as_of: string;
};

export default async function AdminOverview() {
  const supabase = createClient();

  // Fire all four RPCs in parallel — every check is server-side via the
  // SECURITY DEFINER admin gate, so no RLS dance is needed here.
  const [{ data: kpiData }, { data: signups }, { data: dau }, { data: trackers }] = await Promise.all([
    supabase.rpc('admin_kpis'),
    supabase.rpc('admin_signup_series', { p_days: 30 }),
    supabase.rpc('admin_dau_series',    { p_days: 30 }),
    supabase.rpc('admin_top_trackers'),
  ]);

  const k = (kpiData ?? {}) as Partial<Kpis>;
  const signupSeries = (signups ?? []) as { day: string; signups: number }[];
  const dauSeries    = (dau ?? []) as { day: string; dau: number }[];
  const trackerRows  = (trackers ?? []) as { tracker: string; events_7d: number; events_30d: number }[];
  const totalLang = (k.lang_ar ?? 0) + (k.lang_en ?? 0);
  const arPct = totalLang ? Math.round(((k.lang_ar ?? 0) / totalLang) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={Users}      tint="brand"    label="Total parents"   value={k.total_users ?? 0} />
        <Tile icon={Baby}       tint="coral"    label="Babies tracked"  value={k.total_babies ?? 0} />
        <Tile icon={HeartPulse} tint="lavender" label="Active pregnancies" value={k.total_pregnancies ?? 0} />
        <Tile icon={UserPlus}   tint="mint"     label="Sign-ups (24h)"  value={k.signups_24h ?? 0}
          sub={`${k.signups_7d ?? 0} this week · ${k.signups_30d ?? 0} this month`} />
        <Tile icon={Activity}   tint="peach"    label="Active (7d)"     value={k.active_7d ?? 0}
          sub={`${k.active_30d ?? 0} active in last 30 days`} />
        <Tile icon={Languages}  tint="lavender" label="Arabic preference" value={`${arPct}%`}
          sub={`${k.lang_ar ?? 0} AR · ${k.lang_en ?? 0} EN`} />
        <Tile icon={Inbox}      tint="coral"    label="Open feedback"   value={k.feedback_open ?? 0}
          sub={`${k.feedback_total ?? 0} total submissions`} />
        <Tile icon={TrendingUp} tint="mint"     label="Signup conv."    value={k.total_users ? `${Math.round(((k.total_babies ?? 0) / k.total_users) * 100)}%` : '—'}
          sub={`${k.total_babies ?? 0} babies / ${k.total_users ?? 0} parents`} />
      </div>

      {/* Sign-ups chart */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-ink-strong">New sign-ups · last 30 days</h2>
            <p className="text-xs text-ink-muted">Daily count of new accounts created.</p>
          </div>
          <div className="text-2xl font-bold text-ink-strong">{signupSeries.reduce((a, r) => a + Number(r.signups || 0), 0)}</div>
        </div>
        <Sparkline
          data={signupSeries.map(r => Number(r.signups || 0))}
          color="#7BAEDC" width={900} height={80} strokeWidth={2.5}
        />
        <div className="mt-2 grid grid-cols-7 sm:grid-cols-15 text-[10px] text-ink-muted">
          {signupSeries.length > 0 && (
            <>
              <span>{signupSeries[0]?.day?.slice(5)}</span>
              <span className="col-start-7 sm:col-start-15 text-right">{signupSeries[signupSeries.length - 1]?.day?.slice(5)}</span>
            </>
          )}
        </div>
      </section>

      {/* Daily active users chart */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-ink-strong">Daily active users · last 30 days</h2>
            <p className="text-xs text-ink-muted">A user is "active" on a day if they logged any tracker entry.</p>
          </div>
          <div className="text-2xl font-bold text-ink-strong">{dauSeries[dauSeries.length - 1]?.dau ?? 0}<span className="text-xs text-ink-muted ml-2">today</span></div>
        </div>
        <Sparkline
          data={dauSeries.map(r => Number(r.dau || 0))}
          color="#B9A7D8" width={900} height={80} strokeWidth={2.5}
        />
      </section>

      {/* Top trackers */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <h2 className="text-sm font-bold text-ink-strong mb-3">Top trackers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted border-b border-slate-100">
                <th className="py-2 pr-3">Tracker</th>
                <th className="py-2 pr-3 text-right">Events · last 7d</th>
                <th className="py-2 text-right">Events · last 30d</th>
              </tr>
            </thead>
            <tbody>
              {trackerRows.map(r => (
                <tr key={r.tracker} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-3 font-semibold text-ink-strong capitalize">{r.tracker}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{Number(r.events_7d ?? 0).toLocaleString()}</td>
                  <td className="py-2 text-right tabular-nums">{Number(r.events_30d ?? 0).toLocaleString()}</td>
                </tr>
              ))}
              {trackerRows.length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-ink-muted text-sm">No tracker data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[10px] text-ink-muted">
        Snapshot computed at {k.as_of ? new Date(k.as_of).toLocaleString() : 'now'}. Cross-user reads happen via SECURITY DEFINER RPCs guarded by the platform-admin role.
      </p>
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

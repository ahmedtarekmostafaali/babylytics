import { createClient } from '@/lib/supabase/server';
import { Sparkline } from '@/components/Sparkline';
import {
  Users, Baby, HeartPulse, UserPlus, Activity, MessageSquare, Languages,
  TrendingUp, Inbox, Sparkles, Heart, Droplet, Bell, Flag, LogIn, Eye,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Kpis = {
  total_users: number; total_babies: number; total_pregnancies: number;
  total_planning?: number; total_baby_stage?: number;
  signups_24h: number; signups_7d: number; signups_30d: number;
  active_7d: number; active_30d: number;
  lang_ar: number; lang_en: number;
  feedback_total: number; feedback_open: number;
  // Wave 42B additions
  last_seen_today?: number; login_today?: number;
  forum_threads?: number; forum_replies?: number;
  forum_threads_7d?: number; forum_replies_7d?: number;
  forum_reactions?: number; forum_subscriptions?: number;
  ai_calls_today?: number; ai_calls_7d?: number; ai_calls_30d?: number;
  mh_screenings_total?: number; mh_screenings_7d?: number; mh_severe_flag_count?: number;
  pumping_logs_total?: number; pumping_logs_7d?: number;
  forum_reports_open?: number;
  as_of: string;
};

export default async function AdminOverview() {
  const supabase = createClient();

  // Fire all RPCs in parallel — every check is server-side via the
  // SECURITY DEFINER admin gate, so no RLS dance is needed here.
  const [
    { data: kpiData }, { data: signups }, { data: dau }, { data: trackers },
    // Wave 46 additions
    { data: funnel }, { data: aiBreak }, { data: countries },
    { data: retention }, { data: transitions },
  ] = await Promise.all([
    supabase.rpc('admin_kpis'),
    supabase.rpc('admin_signup_series', { p_days: 30 }),
    supabase.rpc('admin_dau_series',    { p_days: 30 }),
    supabase.rpc('admin_top_trackers'),
    supabase.rpc('admin_funnel'),
    supabase.rpc('admin_ai_breakdown',  { p_days: 30 }),
    supabase.rpc('admin_country_breakdown'),
    supabase.rpc('admin_retention'),
    supabase.rpc('admin_stage_transitions'),
  ]);

  const k = (kpiData ?? {}) as Partial<Kpis>;
  const signupSeries = (signups ?? []) as { day: string; signups: number }[];
  const dauSeries    = (dau ?? []) as { day: string; dau: number }[];
  const trackerRows  = (trackers ?? []) as { tracker: string; events_7d: number; events_30d: number }[];

  const totalLang = (k.lang_ar ?? 0) + (k.lang_en ?? 0);
  const arPct = totalLang ? Math.round(((k.lang_ar ?? 0) / totalLang) * 100) : 0;

  // Wave 46 typed reads
  const f  = (funnel  ?? {}) as { total_signups?: number; with_profile?: number; with_log?: number; with_caregiver?: number; with_ai_call?: number };
  const ai = (aiBreak ?? {}) as {
    today?: number; last_7d?: number; last_30d?: number;
    by_mode?: Record<string, number>;
    by_stage?: Record<string, number>;
    series?: { day: string; n: number }[];
  };
  const countryRows = (countries ?? []) as { country: string; n: number }[];
  const ret = (retention ?? {}) as { cohort_size?: number; d1_retained?: number; d7_retained?: number; d30_retained?: number };
  const trans = (transitions ?? {}) as { preg_30d?: number; preg_90d?: number; born_30d?: number; born_90d?: number };

  function pct(num: number | undefined, den: number | undefined): string {
    if (!num || !den) return '—';
    return Math.round((num / den) * 100) + '%';
  }

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

      {/* Wave 42B: today's session activity (from bump_user_activity). */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink-strong">Today's session activity</h2>
            <p className="text-xs text-ink-muted">Read from <code>profiles.last_seen_at</code> + <code>last_login_at</code> (Wave 42B fix: bumped from layout, not just /dashboard).</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile icon={Eye}   tint="brand" label="Active today (any page)" value={k.last_seen_today ?? 0} />
          <Tile icon={LogIn} tint="mint"  label="Sessions started today" value={k.login_today ?? 0}
            sub="≥ 30-min gap from previous activity" />
        </div>
      </section>

      {/* Wave 42B: feature usage from recent waves. */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <h2 className="text-sm font-bold text-ink-strong mb-3">Feature usage · recent waves</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile icon={MessageSquare} tint="brand" label="Forum threads" value={k.forum_threads ?? 0}
            sub={`${k.forum_threads_7d ?? 0} new this week`} />
          <Tile icon={MessageSquare} tint="lavender" label="Forum replies" value={k.forum_replies ?? 0}
            sub={`${k.forum_replies_7d ?? 0} new this week`} />
          <Tile icon={Heart}         tint="coral" label="Forum reactions" value={k.forum_reactions ?? 0}
            sub={`${k.forum_subscriptions ?? 0} subscriptions`} />
          <Tile icon={Flag}          tint="peach" label="Open reports" value={k.forum_reports_open ?? 0}
            sub="forum moderation queue" />

          <Tile icon={Sparkles}      tint="lavender" label="AI calls today" value={k.ai_calls_today ?? 0}
            sub={`${k.ai_calls_7d ?? 0} · 7d / ${k.ai_calls_30d ?? 0} · 30d`} />
          <Tile icon={Heart}         tint="coral" label="Mental health screenings" value={k.mh_screenings_total ?? 0}
            sub={`${k.mh_screenings_7d ?? 0} new this week`} />
          <Tile icon={Bell}          tint="coral" label="MH severity flag" value={k.mh_severe_flag_count ?? 0}
            sub="high or urgent (counts only, never per-user)" />
          <Tile icon={Droplet}       tint="mint"  label="Pumping logs" value={k.pumping_logs_total ?? 0}
            sub={`${k.pumping_logs_7d ?? 0} this week`} />

          <Tile icon={Baby}          tint="coral"    label="Babies (post-birth)" value={k.total_baby_stage ?? 0}
            sub={`${k.total_planning ?? 0} planning · ${k.total_pregnancies ?? 0} pregnant`} />
        </div>
      </section>

      {/* Wave 46A: adoption funnel. */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-ink-strong">Adoption funnel</h2>
          <p className="text-xs text-ink-muted">Conversion through the core onboarding moments. Distinct users at each step.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <FunnelTile label="Sign-ups"            value={f.total_signups ?? 0} />
          <FunnelTile label="Created a profile"   value={f.with_profile ?? 0}
            pctOfPrev={pct(f.with_profile, f.total_signups)} />
          <FunnelTile label="Logged anything"     value={f.with_log ?? 0}
            pctOfPrev={pct(f.with_log, f.with_profile)} />
          <FunnelTile label="Invited a caregiver" value={f.with_caregiver ?? 0}
            pctOfPrev={pct(f.with_caregiver, f.with_log)} />
          <FunnelTile label="Called the AI"       value={f.with_ai_call ?? 0}
            pctOfPrev={pct(f.with_ai_call, f.with_log)} />
        </div>
      </section>

      {/* Wave 46B: AI usage breakdown. */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink-strong">AI companion usage</h2>
            <p className="text-xs text-ink-muted">Last 30 days. Each call = one Claude API request from one user.</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span><strong className="text-ink-strong tabular-nums">{ai.today ?? 0}</strong> today</span>
            <span className="text-ink-muted">·</span>
            <span><strong className="text-ink-strong tabular-nums">{ai.last_7d ?? 0}</strong> · 7d</span>
            <span className="text-ink-muted">·</span>
            <span><strong className="text-ink-strong tabular-nums">{ai.last_30d ?? 0}</strong> · 30d</span>
          </div>
        </div>
        {ai.series && ai.series.length > 0 && (
          <Sparkline
            data={ai.series.map(r => Number(r.n || 0))}
            color="#B9A7D8" width={900} height={70} strokeWidth={2.5}
          />
        )}
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <BreakdownBlock title="By mode" rows={Object.entries(ai.by_mode ?? {})} />
          <BreakdownBlock title="By stage" rows={Object.entries(ai.by_stage ?? {})} />
        </div>
      </section>

      {/* Wave 46D: retention + stage transitions side-by-side. */}
      <section className="grid md:grid-cols-2 gap-3">
        <article className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-bold text-ink-strong mb-1">Retention (rough)</h2>
          <p className="text-xs text-ink-muted mb-4">
            Single-snapshot approximation from sign-up date vs last_seen_at.
            Cohort: users who signed up &gt; 30 days ago (n = {ret.cohort_size ?? 0}).
          </p>
          <div className="grid grid-cols-3 gap-3">
            <RetTile label="Day 1"  num={ret.d1_retained ?? 0}  den={ret.cohort_size ?? 0} />
            <RetTile label="Day 7"  num={ret.d7_retained ?? 0}  den={ret.cohort_size ?? 0} />
            <RetTile label="Day 30" num={ret.d30_retained ?? 0} den={ret.cohort_size ?? 0} />
          </div>
        </article>
        <article className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-bold text-ink-strong mb-1">Stage transitions</h2>
          <p className="text-xs text-ink-muted mb-4">Active pregnancies + recent births in the last 30/90 days.</p>
          <div className="grid grid-cols-2 gap-3">
            <Tile icon={HeartPulse} tint="lavender" label="Active pregnancies (30d updated)" value={trans.preg_30d ?? 0}
              sub={`${trans.preg_90d ?? 0} in last 90 days`} />
            <Tile icon={Baby}       tint="coral"    label="Babies born (last 30d)"          value={trans.born_30d ?? 0}
              sub={`${trans.born_90d ?? 0} in last 90 days`} />
          </div>
        </article>
      </section>

      {/* Wave 46D: country breakdown. */}
      {countryRows.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <h2 className="text-sm font-bold text-ink-strong mb-3">Where users come from</h2>
          <ul className="space-y-1.5">
            {countryRows.slice(0, 12).map(c => {
              const total = countryRows.reduce((a, r) => a + Number(r.n || 0), 0);
              const cPct = total ? Math.round((Number(c.n || 0) / total) * 100) : 0;
              return (
                <li key={c.country} className="flex items-center gap-3 text-sm">
                  <span className="w-12 font-mono text-xs text-ink-muted shrink-0">{c.country}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-brand-400" style={{ width: `${Math.max(2, cPct)}%` }} />
                  </div>
                  <span className="w-16 text-end tabular-nums text-ink-muted text-xs">{c.n} · {cPct}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Sign-ups chart */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-ink-strong">New sign-ups · last 30 days</h2>
            <p className="text-xs text-ink-muted">Daily count of new accounts created.</p>
          </div>
          <div className="text-2xl font-bold text-ink-strong">{signupSeries.reduce((a, r) => a + Number(r.signups || 0), 0)}</div>
        </div>
        {signupSeries.some(r => Number(r.signups || 0) > 0) ? (
          <>
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
          </>
        ) : (
          <EmptyChart message="No new sign-ups in the last 30 days." />
        )}
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
        {dauSeries.some(r => Number(r.dau || 0) > 0) ? (
          <Sparkline
            data={dauSeries.map(r => Number(r.dau || 0))}
            color="#B9A7D8" width={900} height={80} strokeWidth={2.5}
          />
        ) : (
          <EmptyChart message="No tracker activity in the last 30 days." />
        )}
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

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-20 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 grid place-items-center text-xs text-ink-muted">
      {message}
    </div>
  );
}

/** Wave 46A: funnel step tile. Number + optional "% of previous step". */
function FunnelTile({ label, value, pctOfPrev }: {
  label: string;
  value: number;
  pctOfPrev?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{value.toLocaleString()}</div>
      {pctOfPrev && (
        <div className="mt-0.5 text-[10px] text-mint-700 font-semibold">{pctOfPrev} of previous step</div>
      )}
    </div>
  );
}

/** Wave 46B: small key-value list for "by mode" / "by stage". */
function BreakdownBlock({ title, rows }: { title: string; rows: [string, number][] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-2">{title}</div>
        <div className="text-xs text-ink-muted">no data</div>
      </div>
    );
  }
  const total = rows.reduce((a, r) => a + Number(r[1] || 0), 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mb-2">{title}</div>
      <ul className="space-y-1.5">
        {rows.map(([key, n]) => {
          const p = total ? Math.round((Number(n || 0) / total) * 100) : 0;
          return (
            <li key={key} className="flex items-center gap-2 text-xs">
              <span className="w-20 capitalize text-ink-strong shrink-0">{key.replace(/_/g, ' ')}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-lavender-400" style={{ width: `${Math.max(2, p)}%` }} />
              </div>
              <span className="w-12 text-end tabular-nums text-ink-muted">{n} · {p}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Wave 46D: retention day tile with percentage + count. */
function RetTile({ label, num, den }: { label: string; num: number; den: number }) {
  const p = den ? Math.round((num / den) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink-strong tabular-nums">{p}%</div>
      <div className="text-[10px] text-ink-muted">{num} / {den}</div>
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

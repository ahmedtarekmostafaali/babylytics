import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRelative } from '@/lib/dates';
import {
  ArrowLeft, Baby, ShieldCheck, Sparkles, Heart, Droplet, MessagesSquare,
  Activity, LogIn, Clock, Languages, Globe, ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface BabyRow {
  id: string;
  name: string;
  stage: string;
  role: string;
}

interface Detail {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
  last_seen_at: string | null;
  language: string;
  country: string;
  babies: BabyRow[];
  logs_30d: Record<string, number>;
  ai: {
    total: number;
    today: number;
    last_30d: number;
    by_mode: Record<string, number>;
    last_called_at: string | null;
  };
  forum: { threads: number; replies: number; reactions: number; subscriptions: number };
  mh_buckets: Record<string, number>;
  mh_total: number;
  pumping_total: number;
  is_admin: boolean;
}

export default async function AdminUserDetail({
  params,
}: {
  params: { userId: string };
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user: params.userId });
  if (error) {
    return (
      <div className="rounded-2xl border border-coral-200 bg-coral-50 p-6 text-sm text-coral-700">
        Failed to load user — {error.message}
      </div>
    );
  }
  const d = data as Detail | null;
  if (!d || !d.user_id) notFound();

  const totalLogs = Object.values(d.logs_30d ?? {}).reduce((a, n) => a + Number(n || 0), 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/users"
        className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink-strong">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to users
      </Link>

      {/* Identity card */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-2xl bg-brand-100 text-brand-700 grid place-items-center text-xl font-bold shrink-0">
            {(d.display_name || d.email || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-ink-strong">{d.display_name || '(no display name)'}</h1>
            <div className="text-sm text-ink-muted mt-0.5 break-all">{d.email}</div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
              {d.is_admin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 text-mint-700 px-2 py-0.5 font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" /> Admin
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink-muted px-2 py-0.5">
                <Languages className="h-3 w-3" /> {d.language}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-ink-muted px-2 py-0.5">
                <Globe className="h-3 w-3" /> {d.country}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Joined"     icon={Clock}
            value={d.created_at ? fmtRelative(d.created_at) : '—'}
            sub={d.created_at ? fmtDate(d.created_at) : ''} />
          <Stat label="Last login" icon={LogIn}
            value={d.last_login_at ? fmtRelative(d.last_login_at) : '—'}
            sub={d.last_login_at ? fmtDate(d.last_login_at) : 'never'} />
          <Stat label="Last seen"  icon={Activity}
            value={d.last_seen_at ? fmtRelative(d.last_seen_at) : '—'}
            sub={d.last_seen_at ? fmtDate(d.last_seen_at) : 'never'} />
        </div>
      </section>

      {/* Babies they have access to */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <h2 className="text-sm font-bold text-ink-strong mb-3">
          Profiles ({d.babies?.length ?? 0})
        </h2>
        {(!d.babies || d.babies.length === 0) ? (
          <div className="text-xs text-ink-muted">No profiles yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.babies.map(b => (
              <li key={b.id} className="py-2.5 flex items-center gap-3">
                <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
                  <Baby className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-strong">{b.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    <span className="capitalize">{b.stage}</span>
                    {' · '}<span className="capitalize">{b.role}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity in last 30 days */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-bold text-ink-strong">Activity · last 30 days</h2>
          <div className="text-xs text-ink-muted">{totalLogs} total log events</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(d.logs_30d ?? {}).map(([k, n]) => (
            <div key={k} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{k.replace(/_/g, ' ')}</div>
              <div className="mt-1 text-xl font-bold text-ink-strong tabular-nums">{n}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI usage */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-lavender-500" />
          <h2 className="text-sm font-bold text-ink-strong">AI companion</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tile label="Total calls"  value={d.ai?.total ?? 0} />
          <Tile label="Today"        value={d.ai?.today ?? 0} />
          <Tile label="Last 30 days" value={d.ai?.last_30d ?? 0} />
          <Tile label="Last call"
            value={d.ai?.last_called_at ? fmtRelative(d.ai.last_called_at) : '—'}
            isString />
        </div>
        {d.ai?.by_mode && Object.keys(d.ai.by_mode).length > 0 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <span className="text-ink-muted">Mode split:</span>
            {Object.entries(d.ai.by_mode).map(([m, n]) => (
              <span key={m} className="rounded-full bg-lavender-100 text-lavender-700 px-2 py-0.5 font-semibold">
                {m.replace(/_/g, ' ')}: {n}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Forum + Pumping */}
      <section className="grid sm:grid-cols-2 gap-3">
        <article className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessagesSquare className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-bold text-ink-strong">Forum activity</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Threads"       value={d.forum?.threads ?? 0} />
            <Tile label="Replies"       value={d.forum?.replies ?? 0} />
            <Tile label="Reactions"     value={d.forum?.reactions ?? 0} />
            <Tile label="Subscriptions" value={d.forum?.subscriptions ?? 0} />
          </div>
        </article>
        <article className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Droplet className="h-4 w-4 text-coral-500" />
            <h2 className="text-sm font-bold text-ink-strong">Pumping logs</h2>
          </div>
          <Tile label="Total sessions" value={d.pumping_total ?? 0} />
        </article>
      </section>

      {/* Mental health — bucketed only */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-coral-500" />
          <h2 className="text-sm font-bold text-ink-strong">Mental health screenings</h2>
        </div>
        <p className="text-[11px] text-ink-muted mb-4 leading-relaxed">
          Bucketed by severity only — never per-screening detail. Even admins
          cannot see individual responses or scores.
        </p>
        {d.mh_total === 0 ? (
          <div className="text-xs text-ink-muted">No screenings.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['low', 'moderate', 'high', 'urgent'] as const).map(sev => (
              <div key={sev} className={`rounded-xl border p-3 text-center ${
                sev === 'urgent' ? 'border-coral-300 bg-coral-50' :
                sev === 'high'   ? 'border-coral-200 bg-coral-50/60' :
                sev === 'moderate' ? 'border-peach-200 bg-peach-50/60' :
                                     'border-mint-200 bg-mint-50/40'
              }`}>
                <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{sev}</div>
                <div className="mt-1 text-xl font-bold text-ink-strong tabular-nums">
                  {d.mh_buckets?.[sev] ?? 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[10px] text-ink-muted">
        Cross-user reads via SECURITY DEFINER admin RPC. Mental health detail is
        intentionally summarised — the raw screening rows are RLS-locked to the
        user themselves and not readable here.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, icon: Icon }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-ink-muted">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-ink-strong">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Tile({ label, value, isString }: { label: string; value: React.ReactNode; isString?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
      <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
      <div className={`mt-1 ${isString ? 'text-sm' : 'text-xl'} font-bold text-ink-strong tabular-nums`}>{value}</div>
    </div>
  );
}

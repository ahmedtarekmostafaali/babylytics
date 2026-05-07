import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { Search, Baby, ShieldCheck, HeartPulse, Activity, LogIn, Clock, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type BabySummary = {
  id: string;
  name: string;
  stage: 'pregnancy' | 'newborn' | 'infant' | 'toddler' | 'child' | 'archived';
};

type Row = {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  language: string;
  country: string;
  baby_count: number;
  pregnancy_count: number;
  babies: BabySummary[];
  last_activity: string | null;
  recent_log_count: number;
  /** Wave 36B */
  last_login_at:  string | null;
  last_seen_at:   string | null;
  ai_calls_today: number;
  ai_calls_total: number;
  is_admin: boolean;
  total_count: number;
};

const STAGE_TINT: Record<BabySummary['stage'], string> = {
  pregnancy: 'bg-lavender-100 text-lavender-700 border-lavender-200',
  newborn:   'bg-coral-100   text-coral-700   border-coral-200',
  infant:    'bg-peach-100   text-peach-700   border-peach-200',
  toddler:   'bg-mint-100    text-mint-700    border-mint-200',
  child:     'bg-brand-100   text-brand-700   border-brand-200',
  archived:  'bg-slate-100   text-ink-muted   border-slate-200',
};

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const supabase = createClient();
  const search = (searchParams.q ?? '').trim();
  const page   = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error } = await supabase.rpc('admin_user_list', {
    p_limit:  PAGE_SIZE,
    p_offset: offset,
    p_search: search || null,
  });
  const rows  = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink-strong">Users</h2>
          <p className="text-xs text-ink-muted">
            {total.toLocaleString()} total · paged 50 at a time · click a row to expand babies
          </p>
        </div>
        <form className="relative" action="/admin/users" method="get">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search email or name…"
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm w-72 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </form>
      </div>

      {error && (
        <div className="rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800">
          Failed to load users: {error.message}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-ink-muted">
              {search ? `No users match "${search}".` : 'No users yet.'}
            </li>
          )}
          {rows.map(r => (
            <li key={r.user_id} className="px-5 py-4 hover:bg-slate-50/40 transition">
              {/* Wave 46C: clickable row → user detail page. The whole
                  visible header is the link, sub-detail tiles below
                  stay separate so the click target is clear. */}
              <Link href={`/admin/users/${r.user_id}`}
                className="flex items-start gap-3 flex-wrap group">
                <span className="h-10 w-10 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-bold shrink-0">
                  {(r.display_name || r.email).charAt(0).toUpperCase()}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-ink-strong truncate group-hover:text-coral-700 transition">
                      {r.display_name || r.email.split('@')[0]}
                    </span>
                    {r.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-lavender-500 text-white px-1.5 py-0.5">
                        <ShieldCheck className="h-2.5 w-2.5" /> Admin
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-ink-strong px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {r.language}
                    </span>
                    <span className="text-[10px] text-ink-muted">· {r.country}</span>
                  </div>
                  <div className="text-xs text-ink-muted truncate mt-0.5">{r.email}</div>

                  {/* Baby chips — one per baby, color-coded by lifecycle stage */}
                  {r.babies && r.babies.length > 0 ? (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {r.babies.map(b => (
                        <span key={b.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${STAGE_TINT[b.stage] ?? STAGE_TINT.infant}`}>
                          {b.stage === 'pregnancy' ? <HeartPulse className="h-3 w-3" /> : <Baby className="h-3 w-3" />}
                          {b.name}
                          <span className="opacity-60 text-[9px] uppercase tracking-wider">· {b.stage}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-ink-muted italic">no babies yet</div>
                  )}
                </div>

                {/* Right-side stat strip */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right shrink-0 min-w-[200px]">
                  <Stat label="Joined" value={fmtDate(r.created_at)} sub={fmtRelative(r.created_at)} />
                  <Stat label="Babies" value={
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Baby className="h-3.5 w-3.5 text-coral-500" /> {r.baby_count}
                      {r.pregnancy_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-lavender-600 ml-1">
                          <HeartPulse className="h-3 w-3" /> {r.pregnancy_count} preg.
                        </span>
                      )}
                    </span>
                  } />
                  <Stat label="Last activity" value={r.last_activity ? fmtRelative(r.last_activity) : '—'}
                    sub={r.last_activity ? fmtDate(r.last_activity) : 'never logged'} />
                  <Stat label="Logs · 30d" value={
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Activity className="h-3.5 w-3.5 text-mint-500" /> {r.recent_log_count.toLocaleString()}
                    </span>
                  } />
                  {/* Wave 36B: session + AI tracking. */}
                  <Stat label="Last login" value={
                    <span className="inline-flex items-center gap-1 justify-end">
                      <LogIn className="h-3.5 w-3.5 text-brand-500" />
                      {r.last_login_at ? fmtRelative(r.last_login_at) : '—'}
                    </span>
                  } sub={r.last_login_at ? fmtDate(r.last_login_at) : 'never'} />
                  <Stat label="Last seen" value={
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Clock className="h-3.5 w-3.5 text-lavender-500" />
                      {r.last_seen_at ? fmtRelative(r.last_seen_at) : '—'}
                    </span>
                  } />
                  <Stat label="AI calls" value={
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Sparkles className="h-3.5 w-3.5 text-coral-500" />
                      {r.ai_calls_today}/{r.ai_calls_total}
                    </span>
                  } sub="today / total" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <div>Page {page} of {lastPage}</div>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={`/admin/users?${qs({ q: search, page: page - 1 })}`}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-ink">
                ← Previous
              </Link>
            )}
            {page < lastPage && (
              <Link href={`/admin/users?${qs({ q: search, page: page + 1 })}`}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-ink">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="text-right">
      <div className="text-[9px] uppercase tracking-wider text-ink-muted font-semibold">{label}</div>
      <div className="text-xs font-semibold text-ink-strong tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-ink-muted leading-tight">{sub}</div>}
    </div>
  );
}

function qs(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== 0) u.set(k, String(v));
  }
  return u.toString();
}

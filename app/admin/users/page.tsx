import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { Search, Baby, ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type Row = {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  language: string;
  country: string;
  baby_count: number;
  last_activity: string | null;
  is_admin: boolean;
  total_count: number;
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
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink-strong">Users</h2>
          <p className="text-xs text-ink-muted">{total.toLocaleString()} total · paged 50 at a time</p>
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

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr className="text-left text-[10px] uppercase tracking-wider text-ink-muted">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Joined</th>
              <th className="py-3 px-4">Last activity</th>
              <th className="py-3 px-4 text-center">Lang</th>
              <th className="py-3 px-4 text-center">Country</th>
              <th className="py-3 px-4 text-right">Babies</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-muted text-sm">
                {search ? `No users match "${search}".` : 'No users yet.'}
              </td></tr>
            )}
            {rows.map(r => (
              <tr key={r.user_id} className="border-t border-slate-100 hover:bg-slate-50/40 transition">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-bold shrink-0">
                      {(r.display_name || r.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink-strong truncate">{r.display_name || r.email.split('@')[0]}</span>
                        {r.is_admin && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded-full bg-lavender-500 text-white px-1.5 py-0.5">
                            <ShieldCheck className="h-2.5 w-2.5" /> Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-muted truncate">{r.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  <div className="text-ink-strong">{fmtDate(r.created_at)}</div>
                  <div className="text-[10px] text-ink-muted">{fmtRelative(r.created_at)}</div>
                </td>
                <td className="py-3 px-4 whitespace-nowrap">
                  {r.last_activity ? (
                    <>
                      <div className="text-ink-strong">{fmtDate(r.last_activity)}</div>
                      <div className="text-[10px] text-ink-muted">{fmtRelative(r.last_activity)}</div>
                    </>
                  ) : (
                    <span className="text-ink-muted text-xs">never logged</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-ink-strong px-2 py-0.5 text-[11px] font-semibold uppercase">
                    {r.language}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-xs text-ink">{r.country}</td>
                <td className="py-3 px-4 text-right">
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink-strong tabular-nums">
                    <Baby className="h-3.5 w-3.5 text-coral-500" /> {r.baby_count}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

function qs(params: Record<string, string | number | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== 0) u.set(k, String(v));
  }
  return u.toString();
}

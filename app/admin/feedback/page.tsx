import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { AdminFeedbackRow } from '@/components/AdminFeedbackRow';
import { Filter, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;
const STATUSES = ['open', 'triaged', 'in_progress', 'resolved', 'dismissed'] as const;
type Status = typeof STATUSES[number];

type Row = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  kind: string;
  subject: string;
  body: string;
  attachment_path: string | null;
  status: Status;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  total_count: number;
};

export default async function AdminFeedback({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createClient();
  const status = (STATUSES as readonly string[]).includes(searchParams.status ?? '')
    ? (searchParams.status as Status)
    : null;
  const page    = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const offset  = (page - 1) * PAGE_SIZE;

  const { data, error } = await supabase.rpc('admin_feedback_list', {
    p_status: status,
    p_limit:  PAGE_SIZE,
    p_offset: offset,
  });
  const rows  = (data ?? []) as Row[];
  const total = rows[0]?.total_count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-ink-strong flex items-center gap-2">
            <Inbox className="h-5 w-5 text-brand-600" /> Feedback inbox
          </h2>
          <p className="text-xs text-ink-muted">
            {total.toLocaleString()} {status ? status.replace('_', ' ') : 'total'} · expand a row to view body / attachment / change status
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-2xl bg-white border border-slate-200 shadow-sm p-1 flex-wrap">
          <Chip href="/admin/feedback" label="All" active={status == null} />
          {STATUSES.map(s => (
            <Chip key={s} href={`/admin/feedback?status=${s}`} label={s.replace('_', ' ')} active={status === s} />
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800">
          Failed to load feedback: {error.message}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-ink-muted">
              <Filter className="inline h-4 w-4 mr-1" />
              {status ? `No feedback with status "${status}".` : 'No feedback submitted yet.'}
            </li>
          )}
          {rows.map(r => (
            <AdminFeedbackRow
              key={r.id}
              row={{
                id: r.id, user_email: r.user_email, user_name: r.user_name,
                kind: r.kind, subject: r.subject, body: r.body,
                attachment_path: r.attachment_path, status: r.status,
                admin_response: r.admin_response, created_at: r.created_at,
              }}
              formatted={{ date: fmtDate(r.created_at), rel: fmtRelative(r.created_at) }}
            />
          ))}
        </ul>
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <div>Page {page} of {lastPage}</div>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Link href={`/admin/feedback?${qs({ status, page: page - 1 })}`}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-ink">
                ← Previous
              </Link>
            )}
            {page < lastPage && (
              <Link href={`/admin/feedback?${qs({ status, page: page + 1 })}`}
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

function Chip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href}
      className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
        active ? 'bg-ink text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-slate-50'
      }`}>
      {label}
    </Link>
  );
}

function qs(params: Record<string, string | number | null | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 0) u.set(k, String(v));
  }
  return u.toString();
}

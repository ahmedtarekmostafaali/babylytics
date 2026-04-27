// Tiny presentational footer for log-detail panels:
//
//   👤 Logged by Sarah · 2 hours ago
//   ✏️ Last edited by Ahmed · just now
//
// "Last edited" only renders when an audit-log UPDATE row exists for this row
// (i.e. someone has actually changed something after the initial insert).

import { fmtDateTime, fmtRelative } from '@/lib/dates';
import { tFor, type Lang } from '@/lib/i18n';
import { UserCircle2, PencilLine } from 'lucide-react';
import type { AuditFooterData } from '@/lib/audit';

export function AuditFooter({
  audit,
  fallbackCreatedAt,
  lang = 'en',
  className,
}: {
  audit: AuditFooterData | null | undefined;
  /** Used when the row's `created_at` field exists but no audit signature was
   *  fetched (e.g. the row's table isn't in the audit allowlist yet). */
  fallbackCreatedAt?: string | null;
  lang?: Lang;
  className?: string;
}) {
  const t = tFor(lang);
  const createdAt   = audit?.created_at ?? fallbackCreatedAt ?? null;
  const createdName = audit?.created_by_name ?? null;
  const updatedAt   = audit?.last_updated_at ?? null;
  const updatedName = audit?.last_updated_by_name ?? null;

  // Don't render at all if we have nothing to show.
  if (!createdAt && !updatedAt) return null;

  // Skip the "edited" line if it's the same author and within 60s of the
  // create time (just the trigger doing its own first-pass writes).
  const showEdited = !!updatedAt
    && (!createdAt || new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60_000);

  return (
    <div className={`border-t border-slate-100 pt-3 space-y-1 text-xs ${className ?? ''}`}>
      {createdAt && (
        <div className="flex items-center gap-1.5 text-ink-muted">
          <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-ink-muted/70" />
          <span>
            {createdName
              ? <>{t('audit.logged_by')} <span className="font-semibold text-ink">{createdName}</span></>
              : <span className="font-semibold text-ink">{t('audit.logged')}</span>}
            <span className="text-ink-muted"> · </span>
            <time dateTime={createdAt} title={fmtDateTime(createdAt)}>{fmtRelative(createdAt)}</time>
          </span>
        </div>
      )}
      {showEdited && (
        <div className="flex items-center gap-1.5 text-ink-muted">
          <PencilLine className="h-3.5 w-3.5 shrink-0 text-ink-muted/70" />
          <span>
            {updatedName
              ? <>{t('audit.edited_by')} <span className="font-semibold text-ink">{updatedName}</span></>
              : <span className="font-semibold text-ink">{t('audit.edited')}</span>}
            <span className="text-ink-muted"> · </span>
            <time dateTime={updatedAt!} title={fmtDateTime(updatedAt!)}>{fmtRelative(updatedAt!)}</time>
          </span>
        </div>
      )}
    </div>
  );
}

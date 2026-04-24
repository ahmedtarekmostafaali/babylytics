import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyRole } from '@/lib/role';
import type { Role } from '@/lib/permissions';
import {
  canViewLogs, canWriteLogs, canComment, canExportReports, canUploadFiles, isParent,
} from '@/lib/permissions';

/**
 * Look up the caller's role + role-permission booleans in one call. Use at
 * the top of any log page / form page that needs to gate or hide UI.
 *
 * Options:
 *   - requireWrite:    redirect non-writers to the list page for this baby.
 *   - requireParent:   redirect non-parents to the overview.
 *   - requireLogs:     redirect viewers to the overview. Use on every log list.
 *   - requireComment:  redirect non-commenters (nurse, viewer) to the overview.
 *   - requireExport:   redirect users who cannot export.
 */
export async function assertRole(babyId: string, opts: {
  requireWrite?: boolean;
  requireParent?: boolean;
  requireLogs?: boolean;
  requireComment?: boolean;
  requireExport?: boolean;
  fallback?: string;
} = {}): Promise<{
  role: Role;
  isParent: boolean;
  canWriteLogs: boolean;
  canComment: boolean;
  canExport: boolean;
  canUpload: boolean;
  canViewLogs: boolean;
}> {
  const supabase = createClient();
  const role = await getMyRole(supabase, babyId);
  const fallback = opts.fallback ?? `/babies/${babyId}`;

  const snapshot = {
    role,
    isParent:      isParent(role),
    canWriteLogs:  canWriteLogs(role),
    canComment:    canComment(role),
    canExport:     canExportReports(role),
    canUpload:     canUploadFiles(role),
    canViewLogs:   canViewLogs(role),
  };

  if (opts.requireLogs    && !snapshot.canViewLogs)  redirect(fallback);
  if (opts.requireWrite   && !snapshot.canWriteLogs) redirect(fallback);
  if (opts.requireParent  && !snapshot.isParent)     redirect(fallback);
  if (opts.requireComment && !snapshot.canComment)   redirect(fallback);
  if (opts.requireExport  && !snapshot.canExport)    redirect(fallback);

  return snapshot;
}

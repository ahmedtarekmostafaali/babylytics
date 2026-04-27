// Server-side helper that throws a 404 if the current user is not a platform
// admin. Use in any /admin/* page or layout. We choose 404 over 403 on
// purpose: non-admins shouldn't even be able to confirm the route exists.
//
// Usage:
//   import { assertAdmin } from '@/lib/admin-guard';
//   const { supabase, userId } = await assertAdmin();
//
// The function returns the supabase client + verified user id so callers can
// continue without re-creating either.

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function assertAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // Use the SECURITY DEFINER helper installed in migration 041. It runs the
  // membership check with the function owner's privileges, so RLS on
  // app_admins doesn't matter here.
  const { data, error } = await supabase.rpc('is_platform_admin', { p_user: user.id });
  if (error || !data) notFound();

  return { supabase, userId: user.id, email: user.email ?? null };
}

/**
 * Cheap client-callable version for components that just need to know whether
 * to render an "Admin" link (the actual page guard runs server-side anyway).
 * Returns false on any error so a transient outage doesn't surface admin UI
 * to non-admins.
 */
export async function isAdminClient(supabase: ReturnType<typeof createClient>) {
  try {
    const { data, error } = await supabase.rpc('is_platform_admin');
    if (error) return false;
    return Boolean(data);
  } catch {
    return false;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role } from '@/lib/permissions';

/**
 * Look up the caller's role for a given baby. Uses the `my_baby_role()` SQL
 * helper we created in migration 009. Returns null if the caller is not a
 * member of the baby.
 *
 * Cached in practice by Next's fetch dedup — each page hits it once.
 */
export async function getMyRole(
  // Passed loosely typed because the app uses an `any` Database generic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, 'public', any>,
  babyId: string,
): Promise<Role> {
  const { data } = await supabase.rpc('my_baby_role', { b: babyId });
  return (data as Role) ?? null;
}

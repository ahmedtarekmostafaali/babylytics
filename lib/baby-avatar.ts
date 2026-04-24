import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'medical-files';

/**
 * Given a Supabase client + storage path (e.g. "babies/{uuid}/avatar/photo.jpg"),
 * return a signed URL valid for 10 minutes. Returns null on failure or when
 * path is falsy. Safe to call on server components.
 */
export async function signAvatarUrl(
  supabase: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export function avatarStoragePath(babyId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `babies/${babyId}/avatar/${Date.now()}_${safe}`;
}

export const AVATAR_BUCKET = BUCKET;

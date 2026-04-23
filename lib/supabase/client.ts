// Browser-side Supabase client (uses the anon key + user session cookies).
// We deliberately do NOT pass a Database generic — our hand-rolled schema
// shim made supabase-js's GetResult<> collapse to `never` in strict mode.
// App-level types (Baby, Feeding, etc.) still cover the shapes we care about
// at call sites via explicit casts.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

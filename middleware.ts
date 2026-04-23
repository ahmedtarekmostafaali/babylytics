import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  matcher: [
    // Run on every page except static assets and API image optimizer
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

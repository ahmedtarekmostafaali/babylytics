// OAuth callback route — Supabase redirects here after a social login
// flow with a `code` query param that we exchange for a real session.
// Once the cookie is set we redirect to /dashboard (or whatever path
// the original sign-in form passed via `next`).

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const code   = url.searchParams.get('code');
  const next   = url.searchParams.get('next') ?? '/dashboard';
  const errMsg = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  // Provider rejected the request — bounce back to /login with the
  // error attached so the form can render it. Don't expose the raw
  // OAuth params; just the human-readable message.
  if (errMsg) {
    const back = new URL('/login', req.url);
    back.searchParams.set('oauth_error', errMsg);
    return NextResponse.redirect(back);
  }

  if (!code) {
    // No code, no error — odd. Send them back to login.
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL('/login', req.url);
    back.searchParams.set('oauth_error', error.message);
    return NextResponse.redirect(back);
  }

  // Success — session cookie is now set on the response by the
  // Supabase server client. Redirect to the intended destination.
  // Validate `next` is a same-origin path so we don't open-redirect.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
  return NextResponse.redirect(new URL(safeNext, req.url));
}

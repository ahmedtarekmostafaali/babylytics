import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/Wordmark';
import { fmtDateTime } from '@/lib/dates';
import { Heart, Stethoscope, Shield, Eye, Check, AlertTriangle, Clock } from 'lucide-react';
import { AcceptButton } from './AcceptButton';

export const dynamic = 'force-dynamic';

const ROLE_META: Record<string, { label: string; desc: string; icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  parent: { label: 'Parent / Guardian', desc: 'Full access — write every log, upload files, invite others.', icon: Shield, tint: 'bg-brand-100 text-brand-700' },
  doctor: { label: 'Doctor',            desc: 'Read logs, comment, export reports.',                          icon: Stethoscope, tint: 'bg-lavender-100 text-lavender-700' },
  nurse:  { label: 'Nurse',             desc: 'Read-only access to logs.',                                   icon: Heart, tint: 'bg-coral-100 text-coral-700' },
  caregiver: { label: 'Caregiver',      desc: 'Logs visible; can post comments.',                           icon: Heart, tint: 'bg-mint-100 text-mint-700' },
  viewer: { label: 'Viewer',            desc: 'Overview page only.',                                          icon: Eye,  tint: 'bg-slate-100 text-ink' },
};

export default async function AcceptInvitation({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Peek at the invitation. RPC works for both authenticated and anon callers.
  const { data: rows, error } = await supabase.rpc('peek_invitation', { p_token: params.token });
  const peek = ((rows ?? []) as Array<{ baby_id: string; baby_name: string | null; role: string; expires_at: string; valid: boolean; reason: string | null }>)[0];

  // If not logged in, send to login first with returnTo. The login page should
  // honor a redirect query param.
  if (!user && peek?.valid) {
    redirect(`/login?next=/invite/${params.token}`);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-white to-brand-50 px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-card p-7 space-y-5">
        <div className="flex items-center justify-center">
          <Wordmark size="md" />
        </div>

        {error && (
          <div className="rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-700">
            <AlertTriangle className="h-4 w-4 inline mr-1.5" /> {error.message}
          </div>
        )}

        {!peek && !error && (
          <p className="text-center text-sm text-ink-muted">Looking up your invitation…</p>
        )}

        {peek && !peek.valid && (
          <div className="rounded-2xl border border-coral-200 bg-coral-50 p-5 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto text-coral-600" />
            <h1 className="mt-2 text-lg font-bold text-ink-strong">
              {peek.reason === 'not_found' && 'Invitation not found'}
              {peek.reason === 'expired'   && 'This invitation has expired'}
              {peek.reason === 'accepted'  && 'Already accepted'}
              {peek.reason === 'revoked'   && 'Invitation was revoked'}
            </h1>
            <p className="mt-2 text-sm text-ink-muted">
              {peek.reason === 'not_found' && 'Double-check the link, or ask the parent to send a fresh one.'}
              {peek.reason === 'expired'   && 'Ask the parent to generate a new link for you.'}
              {peek.reason === 'accepted'  && 'You can already access the baby from your dashboard.'}
              {peek.reason === 'revoked'   && 'Contact the parent for a new invitation.'}
            </p>
            <Link href={user ? '/dashboard' : '/login'}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2">
              {user ? 'Go to dashboard' : 'Log in'}
            </Link>
          </div>
        )}

        {peek && peek.valid && user && (() => {
          const meta = ROLE_META[peek.role] ?? ROLE_META.viewer;
          const Icon = meta.icon;
          return (
            <>
              <div className="text-center">
                <h1 className="text-xl font-bold text-ink-strong">You&apos;re invited!</h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Help track <strong className="text-ink-strong">{peek.baby_name ?? 'this baby'}</strong> on Babylytics.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 flex items-center gap-3">
                <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${meta.tint}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink-strong">{meta.label}</div>
                  <div className="text-xs text-ink-muted">{meta.desc}</div>
                </div>
              </div>

              <div className="text-xs text-ink-muted inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Expires {fmtDateTime(peek.expires_at)}
              </div>

              <AcceptButton token={params.token} babyId={peek.baby_id} />

              <p className="text-[11px] text-ink-muted text-center">
                By accepting, you&apos;ll appear on the caregivers list and the parent can revoke access at any time.
              </p>
            </>
          );
        })()}
      </div>
    </div>
  );
}

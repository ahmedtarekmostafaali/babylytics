import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InviteForm } from '@/components/forms/InviteForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDate } from '@/lib/dates';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CaregiversPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  type CaregiverRow = { baby_id: string; user_id: string; role: 'owner' | 'editor' | 'viewer'; created_at: string };
  const { data: rowsRaw } = await supabase
    .from('baby_users')
    .select('baby_id,user_id,role,created_at')
    .eq('baby_id', params.babyId);
  const rows = (rowsRaw ?? []) as CaregiverRow[];

  const ownerCount = rows.filter(r => r.role === 'owner').length;
  const me = rows.find(r => r.user_id === user?.id);
  const iAmOwner = me?.role === 'owner';

  const tintByRole = {
    owner:  'bg-brand-100 text-brand-700',
    editor: 'bg-mint-100  text-mint-700',
    viewer: 'bg-peach-100 text-peach-700',
  };

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Team" eyebrowTint="mint" title="Caregivers"
        subtitle="Owners have full control. Editors write logs. Viewers are read-only." />

      <Card>
        <CardHeader><CardTitle>Current caregivers</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-sm text-ink-muted">No caregivers visible (owner-only view).</p>}
          {rows.map(r => (
            <div key={r.user_id} className="flex items-center gap-4 rounded-2xl bg-white/70 p-3 border border-slate-200/70">
              <span className="h-11 w-11 rounded-xl bg-brand-100 text-brand-700 grid place-items-center shrink-0">
                <Users className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink-strong truncate">
                  {r.user_id === user?.id ? 'You' : r.user_id.slice(0, 8) + '…'}
                </div>
                <div className="text-xs text-ink-muted">joined {fmtDate(r.created_at)}</div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tintByRole[r.role]}`}>
                {r.role}{r.role === 'owner' && ownerCount === 1 ? ' · last' : ''}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {iAmOwner && (
        <Card>
          <CardHeader><CardTitle>Invite a caregiver</CardTitle></CardHeader>
          <CardContent><InviteForm babyId={params.babyId} /></CardContent>
        </Card>
      )}
    </PageShell>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { InviteForm } from '@/components/forms/InviteForm';
import { fmtDate } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function CaregiversPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  // We rely on RLS — only owners can see/edit baby_users for this baby.
  type CaregiverRow = { baby_id: string; user_id: string; role: 'owner' | 'editor' | 'viewer'; created_at: string };
  const { data: rowsRaw } = await supabase
    .from('baby_users')
    .select('baby_id,user_id,role,created_at')
    .eq('baby_id', params.babyId);
  const rows = (rowsRaw ?? []) as CaregiverRow[];

  const ownerCount = rows.filter(r => r.role === 'owner').length;
  const me = rows.find(r => r.user_id === user?.id);
  const iAmOwner = me?.role === 'owner';

  return (
    <div>
      <Nav email={user?.email} />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div>
          <Link href={`/babies/${params.babyId}`} className="text-sm text-slate-500 hover:underline">← {baby.name}</Link>
          <h1 className="text-xl font-semibold mt-1">Caregivers</h1>
          <p className="text-sm text-slate-500">Owners have full control. Editors can write logs. Viewers are read-only.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Current caregivers</CardTitle></CardHeader>
          <CardContent className="divide-y divide-slate-100 text-sm">
            {rows.length === 0 && <p className="text-slate-500">No caregivers visible (owner-only view).</p>}
            {rows.map(r => (
              <div key={r.user_id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{r.user_id === user?.id ? 'You' : r.user_id.slice(0,8) + '…'}</div>
                  <div className="text-xs text-slate-500">role: {r.role} · joined {fmtDate(r.created_at)}</div>
                </div>
                <span className="text-xs text-slate-400">{r.role === 'owner' && ownerCount === 1 ? 'last owner' : ''}</span>
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
      </main>
    </div>
  );
}

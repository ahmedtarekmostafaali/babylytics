import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ageInDays } from '@/lib/dates';
import { Baby as BabyIcon, Bell } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: babies } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { data: unread } = await supabase
    .from('notifications')
    .select('id,kind,payload,created_at,baby_id')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink-strong">Your babies</h1>
          <p className="text-ink-muted text-sm">Pick a baby to see its dashboard, or add a new one.</p>
        </div>
        <Link href="/babies/new"><Button>+ Add baby</Button></Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {babies?.map(b => (
          <Link key={b.id} href={`/babies/${b.id}`} className="block">
            <Card className="hover:shadow-panel transition-shadow cursor-pointer">
              <CardContent className="py-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-brand-100 text-brand-700 grid place-items-center shrink-0">
                  <BabyIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-ink-strong truncate">{b.name}</div>
                  <div className="text-xs text-ink-muted">
                    {b.gender}
                    {b.birth_weight_kg ? ` · ${b.birth_weight_kg} kg at birth` : ''}
                  </div>
                  <div className="text-xs text-ink-muted">{ageInDays(b.dob)} days old</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {(!babies || babies.length === 0) && (
          <Card>
            <CardContent className="text-ink-muted py-8 text-center">
              <p>No babies yet.</p>
              <Link href="/babies/new" className="mt-2 inline-block text-brand-600 hover:underline">Click <em>Add baby</em> to start.</Link>
            </CardContent>
          </Card>
        )}
      </div>

      {unread && unread.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-coral-600" />
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Unread notifications</h2>
          </div>
          <Card>
            <CardContent className="divide-y divide-slate-100 text-sm py-2">
              {unread.map(n => (
                <Link
                  key={n.id}
                  href={`/babies/${n.baby_id}`}
                  className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded"
                >
                  <span className="font-medium text-ink-strong">{n.kind.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-ink-muted">{new Date(n.created_at).toLocaleString()}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

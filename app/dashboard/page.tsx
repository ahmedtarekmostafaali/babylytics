import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ageInDays } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Only babies the caller has access to (RLS enforced)
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
    <div>
      <Nav email={user?.email} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your babies</h1>
            <p className="text-slate-500 text-sm">Pick a baby to see its dashboard, or add a new one.</p>
          </div>
          <Link href="/babies/new"><Button>Add baby</Button></Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {babies?.map(b => (
            <Link key={b.id} href={`/babies/${b.id}`}>
              <Card className="hover:shadow-md transition">
                <CardHeader><CardTitle className="text-base">{b.name}</CardTitle></CardHeader>
                <CardContent className="text-sm text-slate-600">
                  <div>{b.gender}{b.birth_weight_kg ? ` · ${b.birth_weight_kg} kg at birth` : ''}</div>
                  <div className="text-slate-500">{ageInDays(b.dob)} days old</div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!babies || babies.length === 0) && (
            <Card><CardContent className="text-slate-600">No babies yet. Click <em>Add baby</em> to start.</CardContent></Card>
          )}
        </div>

        {unread && unread.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold">Unread notifications</h2>
            <ul className="mt-3 space-y-2">
              {unread.map(n => (
                <li key={n.id}>
                  <Link
                    href={`/babies/${n.baby_id}`}
                    className="block rounded-md border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium">{n.kind.replace(/_/g, ' ')}</span> · {new Date(n.created_at).toLocaleString()}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

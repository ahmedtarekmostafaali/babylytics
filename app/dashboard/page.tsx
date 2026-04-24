import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ageInDays } from '@/lib/dates';
import { Baby as BabyIcon, Bell, Plus, Heart, Milk } from 'lucide-react';

export const dynamic = 'force-dynamic';

function greetingFor(hour: number): string {
  if (hour < 5)  return 'Good early morning';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}

const TILE_TINTS: { bg: string; ring: string; iconBg: string; iconFg: string }[] = [
  { bg: 'bg-coral-50',    ring: 'hover:ring-coral-200',    iconBg: 'bg-coral-100',    iconFg: 'text-coral-700'    },
  { bg: 'bg-mint-50',     ring: 'hover:ring-mint-200',     iconBg: 'bg-mint-100',     iconFg: 'text-mint-700'     },
  { bg: 'bg-lavender-50', ring: 'hover:ring-lavender-200', iconBg: 'bg-lavender-100', iconFg: 'text-lavender-700' },
  { bg: 'bg-peach-50',    ring: 'hover:ring-peach-200',    iconBg: 'bg-peach-100',    iconFg: 'text-peach-700'    },
  { bg: 'bg-brand-50',    ring: 'hover:ring-brand-200',    iconBg: 'bg-brand-100',    iconFg: 'text-brand-700'    },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: babies }, { data: unread }, { data: profile }] = await Promise.all([
    supabase.from('babies')
      .select('id,name,dob,gender,birth_weight_kg')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('notifications')
      .select('id,kind,payload,created_at,baby_id')
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('profiles').select('display_name').eq('id', user?.id ?? '').single(),
  ]);

  const name = profile?.display_name ?? user?.email?.split('@')[0] ?? 'there';
  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Hero greeting */}
      <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-coral-50 border border-slate-200 shadow-card p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-mint-100 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-coral-100 blur-2xl" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">{greeting}</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
              Hi {name} 👋
            </h1>
            <p className="mt-2 text-ink max-w-md">
              {(babies ?? []).length === 0
                ? 'Ready to start? Add your first baby to track feedings, stool, medications and growth.'
                : `You have ${(babies ?? []).length} ${((babies ?? []).length === 1) ? 'baby' : 'babies'} on your dashboard. Pick one to see today\u2019s summary.`}
            </p>
          </div>
          <Link href="/babies/new">
            <Button className="rounded-xl">
              <Plus className="h-4 w-4" /> Add baby
            </Button>
          </Link>
        </div>
      </div>

      {/* Baby tiles */}
      {(babies ?? []).length > 0 ? (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Your babies</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {babies?.map((b, i) => {
              const tint = TILE_TINTS[i % TILE_TINTS.length];
              return (
                <Link key={b.id} href={`/babies/${b.id}`} className="block">
                  <div className={`rounded-2xl ${tint.bg} border border-slate-200 p-5 ring-1 ring-transparent ${tint.ring} hover:shadow-panel transition`}>
                    <div className="flex items-center gap-4">
                      <div className={`h-14 w-14 rounded-2xl ${tint.iconBg} ${tint.iconFg} grid place-items-center shrink-0`}>
                        <BabyIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-strong truncate text-lg">{b.name}</div>
                        <div className="text-xs text-ink-muted">
                          {b.gender}{b.birth_weight_kg ? ` · ${b.birth_weight_kg} kg at birth` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-ink">
                      <span className="rounded-full bg-white/70 border border-slate-200 px-2.5 py-1">
                        {ageInDays(b.dob)} days old
                      </span>
                      <span className={`rounded-full ${tint.iconBg} ${tint.iconFg} px-2.5 py-1 inline-flex items-center gap-1`}>
                        <Milk className="h-3 w-3" /> open dashboard
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-ink-muted">
            <div className="mx-auto h-16 w-16 rounded-full bg-brand-100 text-brand-700 grid place-items-center">
              <Heart className="h-8 w-8" />
            </div>
            <p className="mt-4">No babies yet.</p>
            <Link href="/babies/new" className="mt-2 inline-block text-brand-600 hover:underline">Add your first baby to begin.</Link>
          </CardContent>
        </Card>
      )}

      {/* Unread notifications */}
      {unread && unread.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-coral-600" />
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Unread notifications</h2>
          </div>
          <Card>
            <CardContent className="divide-y divide-slate-100 text-sm py-2">
              {unread.map(n => (
                <Link key={n.id} href={`/babies/${n.baby_id}`}
                  className="flex items-center justify-between py-2 hover:bg-slate-50 -mx-2 px-2 rounded">
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

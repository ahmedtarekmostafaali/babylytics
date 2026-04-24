import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { fmtDateTime, fmtRelative, fmtTime } from '@/lib/dates';
import { Moon, Bed, Car, Home, Armchair, Baby as BabyIcon, HelpCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sleep' };

const LOC_ICON = { crib: BabyIcon, bed: Bed, car: Car, stroller: Home, arms: Armchair, other: HelpCircle } as const;
const QUALITY_TINT: Record<string, string> = {
  sound: 'bg-mint-50 text-mint-700',
  restless: 'bg-peach-50 text-peach-700',
  woke_often: 'bg-coral-50 text-coral-700',
  unknown: 'bg-slate-100 text-ink-muted',
};

function fmtDuration(min: number | null | undefined) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default async function SleepList({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();
  const { data: rows } = await supabase
    .from('sleep_logs')
    .select('id,start_at,end_at,duration_min,location,quality,notes')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .order('start_at', { ascending: false }).limit(200);

  const running = rows?.find(r => r.end_at == null);
  const completed = (rows ?? []).filter(r => r.end_at != null);
  const totalMin = completed.reduce((a, r) => a + (r.duration_min ?? 0), 0);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Sleep" eyebrowTint="lavender" title="Sleep sessions"
        subtitle={`${completed.length} completed · ${fmtDuration(totalMin)} total`}
        right={<Link href={`/babies/${params.babyId}/sleep/new`}><Button variant="primary">+ Log sleep</Button></Link>} />

      {running && (
        <div className="rounded-2xl bg-gradient-to-r from-lavender-100 via-white to-brand-50 border border-lavender-200 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-lavender-500 text-white grid place-items-center shadow-sm">
            <Moon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Sleeping now</div>
            <div className="text-lg font-bold text-ink-strong">Started {fmtRelative(running.start_at)}</div>
          </div>
          <Link href={`/babies/${params.babyId}/sleep/${running.id}`}>
            <Button variant="secondary">Open</Button>
          </Link>
        </div>
      )}

      <div className="space-y-2">
        {(rows ?? []).length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-10 text-center text-ink-muted">
            No sleep sessions yet. Tap <span className="font-semibold">+ Log sleep</span> to start your first one.
          </div>
        )}
        {rows?.map(r => {
          const Icon = LOC_ICON[(r.location as keyof typeof LOC_ICON) ?? 'other'] ?? HelpCircle;
          const qTint = QUALITY_TINT[r.quality ?? 'unknown'] ?? QUALITY_TINT.unknown;
          return (
            <Link key={r.id} href={`/babies/${params.babyId}/sleep/${r.id}`}
              className="flex items-center gap-4 rounded-2xl bg-lavender-50 hover:bg-lavender-100/70 p-4 transition">
              <span className="h-11 w-11 rounded-xl bg-white shadow-sm grid place-items-center shrink-0 text-lavender-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-ink-strong text-lg">{fmtDuration(r.duration_min)}</span>
                  {r.end_at == null && <span className="text-[10px] font-semibold uppercase tracking-wider text-lavender-700 bg-lavender-200 rounded-full px-2 py-0.5">in progress</span>}
                  {r.quality && (
                    <span className={`text-[10px] font-semibold capitalize rounded-full px-2 py-0.5 ${qTint}`}>
                      {r.quality.replace('_', ' ')}
                    </span>
                  )}
                </span>
                <span className="block text-xs text-ink-muted truncate">
                  {r.location} · {fmtDateTime(r.start_at)}{r.end_at ? ` → ${fmtTime(r.end_at)}` : ''}
                </span>
                {r.notes && <span className="block text-xs text-ink-muted truncate mt-0.5">{r.notes}</span>}
              </span>
              <span className="text-xs text-ink-muted whitespace-nowrap">{fmtRelative(r.start_at)}</span>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

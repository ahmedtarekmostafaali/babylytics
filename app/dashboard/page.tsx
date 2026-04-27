import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { ageInDays, fmtDateTime } from '@/lib/dates';
import { fmtKg } from '@/lib/units';
import { signAvatarUrl } from '@/lib/baby-avatar';
import { BabyAvatar } from '@/components/BabyAvatar';
import { Bell, Plus, Heart, Sparkles, ArrowRight } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor, type TFunc } from '@/lib/i18n';

import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Your babies' };
export const dynamic = 'force-dynamic';

function greetingFor(hour: number, t: TFunc): string {
  if (hour < 5)  return t('dashboard.g_early');
  if (hour < 12) return t('dashboard.g_morning');
  if (hour < 17) return t('dashboard.g_afternoon');
  if (hour < 22) return t('dashboard.g_evening');
  return t('dashboard.g_night');
}

/** Map DB notification_kind values to user-friendly labels with correct casing. */
function friendlyNotificationLabel(kind: string, t: TFunc): string {
  const map: Record<string, string> = {
    medication_due:      t('dashboard.notif_med_due'),
    medication_missed:   t('dashboard.notif_med_missed'),
    low_ocr_confidence:  t('dashboard.notif_low_ocr'),
    file_ready:          t('dashboard.notif_file_ready'),
    feeding_alert:       t('dashboard.notif_feed_alert'),
    stool_alert:         t('dashboard.notif_stool_alert'),
    app_update:          t('dashboard.notif_app_update'),
  };
  return map[kind] ?? kind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const PALETTES = [
  { bg: 'from-coral-50 via-white to-coral-50',       blob: 'bg-coral-200',    dot: 'bg-coral-500',    text: 'text-coral-700'    },
  { bg: 'from-mint-50 via-white to-mint-50',         blob: 'bg-mint-200',     dot: 'bg-mint-500',     text: 'text-mint-700'     },
  { bg: 'from-lavender-50 via-white to-lavender-50', blob: 'bg-lavender-200', dot: 'bg-lavender-500', text: 'text-lavender-700' },
  { bg: 'from-peach-50 via-white to-peach-50',       blob: 'bg-peach-200',    dot: 'bg-peach-500',    text: 'text-peach-700'    },
  { bg: 'from-brand-50 via-white to-brand-50',       blob: 'bg-brand-200',    dot: 'bg-brand-500',    text: 'text-brand-700'    },
];

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const [{ data: babies }, { data: unread }, { data: profile }] = await Promise.all([
    supabase.from('babies')
      .select('id,name,dob,gender,birth_weight_kg,avatar_path')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    // my_unread_notifications honours per-user reads on broadcasts via the
    // notification_reads table introduced in migration 028. Falls back to the
    // older read_at semantics for personal rows. Limit applied client-side.
    supabase.rpc('my_unread_notifications')
      .then(r => ({
        ...r,
        data: ((r.data ?? []) as Array<{ id: string; kind: string; payload: Record<string, unknown> | null; created_at: string; baby_id: string }>).slice(0, 10),
      })),
    supabase.from('profiles').select('display_name').eq('id', user?.id ?? '').single(),
  ]);

  // Fetch current weight + avatar URL for each baby — small N, parallel fine
  const weights: Record<string, number | null> = {};
  const avatars: Record<string, string | null> = {};
  if (babies) {
    await Promise.all((babies as { id: string; avatar_path: string | null }[]).map(async b => {
      const [w, a] = await Promise.all([
        supabase.rpc('current_weight_kg', { p_baby: b.id }),
        signAvatarUrl(supabase, b.avatar_path),
      ]);
      weights[b.id] = w.data as number | null;
      avatars[b.id] = a;
    }));
  }

  const name = profile?.display_name ?? user?.email?.split('@')[0] ?? t('dashboard.name_fallback');
  const greeting = greetingFor(new Date().getHours(), t);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-50 via-white to-coral-50 border border-slate-200/70 shadow-card">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 280" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id="dash-a" cx="80%" cy="20%" r="50%">
              <stop offset="0%" stopColor="#7FC8A9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#7FC8A9" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="dash-b" cx="15%" cy="80%" r="45%">
              <stop offset="0%" stopColor="#F4A6A6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F4A6A6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="280" fill="url(#dash-a)" />
          <rect width="800" height="280" fill="url(#dash-b)" />
        </svg>
        <div className="relative p-8 sm:p-10 flex items-center justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-mint-700 uppercase">
              <Sparkles className="h-3.5 w-3.5" /> {greeting}
            </div>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong leading-tight">
              {t('dashboard.hi_name', { name })}
            </h1>
            <p className="mt-2 text-ink max-w-lg">
              {(babies ?? []).length === 0
                ? t('dashboard.sub_none')
                : (babies ?? []).length === 1
                  ? t('dashboard.sub_one')
                  : t('dashboard.sub_n', { n: (babies ?? []).length })}
            </p>
          </div>
          <Link href="/babies/new"
            className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-3 shadow-sm">
            <Plus className="h-4 w-4" />
            {t('dashboard.add_baby')}
          </Link>
        </div>
      </div>

      {/* Baby cards */}
      {(babies ?? []).length > 0 ? (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('dashboard.your_babies')}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {babies?.map((b, i) => {
              const p = PALETTES[i % PALETTES.length];
              return (
                <Link key={b.id} href={`/babies/${b.id}`} className="group block">
                  <div className={`relative overflow-hidden rounded-3xl border border-slate-200/70 shadow-card bg-gradient-to-br ${p.bg} transition hover:shadow-panel`}>
                    <div className={`absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-70 ${p.blob}`} />
                    <div className="relative p-5">
                      <div className="flex items-start justify-between gap-3">
                        <BabyAvatar url={avatars[b.id]} size="lg" />
                        <span className={`rounded-full bg-white/80 ${p.text} text-[11px] font-semibold px-2 py-0.5`}>
                          {t('dashboard.days_old', { n: ageInDays(b.dob) })}
                        </span>
                      </div>
                      <div className="mt-4">
                        <div className="text-xl font-bold text-ink-strong leading-tight">{b.name}</div>
                        <div className="mt-1 text-xs text-ink-muted">
                          {b.gender}
                          {b.birth_weight_kg ? ` · ${t('dashboard.birth_short', { weight: fmtKg(Number(b.birth_weight_kg)) })}` : ''}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <Stat label={t('dashboard.stat_current')} value={fmtKg(weights[b.id])} dot={p.dot} />
                        <Stat label={t('dashboard.stat_open')} value={<span className="inline-flex items-center gap-1">{t('dashboard.stat_dashboard')} <ArrowRight className="h-3 w-3" /></span>} dot={p.dot} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-3xl bg-white/80 border border-dashed border-slate-300 p-14 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-coral-100 text-coral-600 grid place-items-center">
            <Heart className="h-10 w-10" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-ink-strong">{t('dashboard.none_h')}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t('dashboard.none_p')}</p>
          <Link href="/babies/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2.5 shadow-sm">
            <Plus className="h-4 w-4" /> {t('dashboard.add_first')}
          </Link>
        </div>
      )}

      {/* Unread notifications — only the user's own + broadcasts they haven't read */}
      {unread && unread.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-coral-600" />
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('dashboard.unread')}</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-50 px-1.5 py-0.5 rounded-full">
              {unread.length}
            </span>
          </div>
          <div className="rounded-2xl bg-white/85 border border-slate-200 divide-y divide-slate-100 shadow-card">
            {unread.map(n => {
              // Deep-link per kind so the dashboard tile takes the user
              // straight to the actionable target, not just the baby home.
              const href = (() => {
                const baby = `/babies/${n.baby_id}`;
                const p = n.payload as Record<string, unknown> | null;
                switch (n.kind) {
                  case 'medication_due':
                  case 'medication_missed':  return `${baby}/medications`;
                  case 'low_ocr_confidence':
                    if (typeof p?.extracted_id === 'string') return `${baby}/ocr/${p.extracted_id}`;
                    if (typeof p?.file_id === 'string')      return `${baby}/files/${p.file_id}`;
                    return `${baby}/ocr`;
                  case 'feeding_alert':      return `${baby}/feedings`;
                  case 'stool_alert':        return `${baby}/stool`;
                  case 'file_ready':         return `${baby}/ocr`;
                  case 'app_update':         return '/updates';
                  default:                   return baby;
                }
              })();
              const baby = (babies ?? []).find(b => b.id === n.baby_id);
              return (
                <Link key={n.id} href={href}
                  className="flex items-center justify-between py-3 px-4 hover:bg-slate-50 transition group">
                  <div className="min-w-0">
                    <div className="font-medium text-ink-strong">{friendlyNotificationLabel(n.kind, t)}</div>
                    {baby && <div className="text-[11px] text-ink-muted">{baby.name}</div>}
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{fmtDateTime(n.created_at)}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: React.ReactNode; dot: string }) {
  return (
    <div className="rounded-xl bg-white/80 px-3 py-2 border border-slate-200/70">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink-strong">{value}</div>
    </div>
  );
}

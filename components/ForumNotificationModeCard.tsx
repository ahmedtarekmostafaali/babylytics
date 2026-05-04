'use client';

// ForumNotificationModeCard — Wave 31b. A standalone card on the
// /preferences page that lets the user pick how they receive forum
// reply notifications: instant (one ping per reply, default), digest
// (one daily summary), or off (no pings at all). Subscribes still
// govern *which* threads are tracked — this card governs *how* the
// pings arrive.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bell, Mail, BellOff, Loader2, Check } from 'lucide-react';

type Mode = 'instant' | 'digest' | 'off';

const OPTIONS: { mode: Mode; en_label: string; ar_label: string;
                 en_help: string; ar_help: string;
                 icon: React.ComponentType<{ className?: string }> }[] = [
  { mode: 'instant', icon: Bell,
    en_label: 'Instant',  ar_label: 'فوري',
    en_help:  'A ping in your bell for every reply in threads you follow.',
    ar_help:  'إشعار فوري عن كل رد في المواضيع التي تتابعينها.' },
  { mode: 'digest',  icon: Mail,
    en_label: 'Daily digest', ar_label: 'ملخص يومي',
    en_help:  'One summary per day with all the replies you missed across followed threads.',
    ar_help:  'ملخص واحد يومياً يجمع كل الردود في المواضيع التي تتابعينها.' },
  { mode: 'off',     icon: BellOff,
    en_label: 'Off',      ar_label: 'إيقاف',
    en_help:  'No forum pings. You can still see new replies by visiting the forum.',
    ar_help:  'لا إشعارات منتدى. يمكنك زيارة المنتدى لرؤية الردود الجديدة.' },
];

export function ForumNotificationModeCard({ lang = 'en' }: { lang?: 'en' | 'ar' }) {
  const isAr = lang === 'ar';
  const [mode, setMode]     = useState<Mode>('instant');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Mode | null>(null);
  const [savedMs, setSavedMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_notification_prefs')
        .select('forum_mode')
        .maybeSingle();
      if (!cancelled) {
        setMode(((data as { forum_mode?: Mode } | null)?.forum_mode) ?? 'instant');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function pick(next: Mode) {
    if (next === mode || saving) return;
    setSaving(next);
    const supabase = createClient();
    const { error } = await supabase.rpc('set_forum_notification_mode', { p_mode: next });
    setSaving(null);
    if (!error) {
      setMode(next);
      setSavedMs(Date.now());
    }
  }

  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center">
          <Bell className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'إشعارات المنتدى' : 'Forum notifications'}
          </h3>
          <p className="text-xs text-ink-muted">
            {isAr
              ? 'تطبق على كل المواضيع التي تتابعينها.'
              : 'Applies to all threads you follow.'}
          </p>
        </div>
        {savedMs > 0 && Date.now() - savedMs < 2500 && (
          <span className="inline-flex items-center gap-1 text-xs text-mint-700">
            <Check className="h-3.5 w-3.5" /> {isAr ? 'محفوظ' : 'Saved'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-ink-muted py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {isAr ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      ) : (
        <div className="space-y-2">
          {OPTIONS.map(o => {
            const active = o.mode === mode;
            const Icon = o.icon;
            return (
              <button key={o.mode} type="button" onClick={() => pick(o.mode)}
                disabled={Boolean(saving)}
                className={`w-full flex items-start gap-3 rounded-xl border p-3 text-start transition ${
                  active
                    ? 'border-coral-300 bg-coral-50/40'
                    : 'border-slate-200 hover:bg-slate-50'
                } disabled:opacity-50`}>
                <span className={`h-8 w-8 rounded-lg grid place-items-center shrink-0 ${
                  active ? 'bg-coral-100 text-coral-700' : 'bg-slate-100 text-ink-muted'
                }`}>
                  {saving === o.mode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-strong">
                    {isAr ? o.ar_label : o.en_label}
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
                    {isAr ? o.ar_help : o.en_help}
                  </p>
                </div>
                {active && <Check className="h-4 w-4 text-coral-600 mt-1 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

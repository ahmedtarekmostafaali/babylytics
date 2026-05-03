'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n/client';
import {
  COUNTRY_OPTIONS, TIMEZONE_OPTIONS, DEFAULT_PREFS,
  type UserPrefs, type TimeFormat, type UnitSystem, saveUserPrefs,
} from '@/lib/user-prefs';
import type { Lang } from '@/lib/i18n';
import { Save, Globe, MapPin, Clock, Ruler, Bell, Check, Palette, Sun, Moon, Monitor, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WhatsAppSandboxJoin } from '@/components/WhatsAppSandboxJoin';
import { AreaPicker } from '@/components/AreaPicker';

export function PreferencesForm({ initial, initialFeatures }: {
  initial: UserPrefs;
  /** 050 batch: per-stage feature visibility shaped {planning,pregnancy,baby:[area,...]}.
   *  Undefined or missing key = unrestricted for that stage. */
  initialFeatures?: Record<string, string[]>;
}) {
  const router = useRouter();
  const t = useT();

  const [language,    setLanguage]    = useState<Lang>(initial.language);
  const [country,     setCountry]     = useState(initial.country);
  const [timezone,    setTimezone]    = useState(initial.timezone);
  const [timeFormat,  setTimeFormat]  = useState<TimeFormat>(initial.time_format);
  const [unitSystem,  setUnitSystem]  = useState<UnitSystem>(initial.unit_system);
  const [waNumber,    setWaNumber]    = useState(initial.whatsapp_e164 ?? '');
  const [waOptin,     setWaOptin]     = useState(initial.whatsapp_optin);
  // 050 batch: theme. Applied on save by toggling the .dark class on <html>
  // — same trick Tailwind's dark: variant uses.
  const [theme,       setTheme]       = useState<typeof initial.theme>(initial.theme);
  // 050 batch: per-stage feature visibility. Tabs let the user pick a stage
  // and toggle areas. Saved on submit alongside the rest of the prefs.
  const [featStage,   setFeatStage]   = useState<'planning'|'pregnancy'|'baby'>('baby');
  const [features,    setFeatures]    = useState<Record<string, string[] | null>>(() => ({
    planning:  initialFeatures?.planning  && initialFeatures.planning.length  > 0 ? initialFeatures.planning  : null,
    pregnancy: initialFeatures?.pregnancy && initialFeatures.pregnancy.length > 0 ? initialFeatures.pregnancy : null,
    baby:      initialFeatures?.baby      && initialFeatures.baby.length      > 0 ? initialFeatures.baby      : null,
  }));

  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function pickCountry(code: string) {
    setCountry(code);
    const meta = COUNTRY_OPTIONS.find(c => c.code === code);
    if (meta) setTimezone(meta.default_tz);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const supabase = createClient();
      const res = await saveUserPrefs(supabase, {
        language, country, timezone,
        time_format: timeFormat, unit_system: unitSystem,
        whatsapp_e164: waNumber.trim() || null,
        whatsapp_optin: waOptin && !!waNumber.trim(),
        theme,
      });
      if (!res.ok) { setErr(res.error); return; }
      // 050 batch: persist per-stage features in a separate update — they
      // live in the same row but as a jsonb column. We strip empty arrays
      // back to "no key" so the my_enabled_features RPC returns null
      // (= unrestricted) instead of an empty list (= block everything).
      const featurePayload: Record<string, string[]> = {};
      for (const k of ['planning','pregnancy','baby'] as const) {
        const v = features[k];
        if (v && v.length > 0) featurePayload[k] = v;
      }
      const supabase2 = createClient();
      const { data: { user } } = await supabase2.auth.getUser();
      if (user) {
        await supabase2.from('user_preferences')
          .update({ enabled_features: featurePayload })
          .eq('user_id', user.id);
      }
      setSavedAt(Date.now());
      // Apply the chosen theme immediately — no need to wait for the
      // server round-trip + page refresh. Same logic the layout runs.
      applyThemeClass(theme);
      // Force the layout to re-fetch prefs (lang/dir flip) on next paint.
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Language */}
      <Card icon={Globe} title={t('prefs.language')}>
        <div className="grid grid-cols-2 gap-2">
          <PickerTile active={language === 'en'} onClick={() => setLanguage('en')}>
            English
          </PickerTile>
          <PickerTile active={language === 'ar'} onClick={() => setLanguage('ar')}>
            العربية
          </PickerTile>
        </div>
      </Card>

      {/* Country + Timezone */}
      <Card icon={MapPin} title={`${t('prefs.country')} · ${t('prefs.timezone')}`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('prefs.country')}</span>
            <select
              value={country}
              onChange={e => pickCountry(e.target.value)}
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            >
              {COUNTRY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>
                  {language === 'ar' ? c.label_ar : c.label_en}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('prefs.timezone')}</span>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            >
              {TIMEZONE_OPTIONS.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {/* Time format */}
      <Card icon={Clock} title={t('prefs.time_format')}>
        <div className="grid grid-cols-2 gap-2">
          <PickerTile active={timeFormat === '12h'} onClick={() => setTimeFormat('12h')}>
            {t('prefs.time_12h')}
          </PickerTile>
          <PickerTile active={timeFormat === '24h'} onClick={() => setTimeFormat('24h')}>
            {t('prefs.time_24h')}
          </PickerTile>
        </div>
      </Card>

      {/* Theme — light, dark, or follow OS. */}
      <Card icon={Palette} title="Theme">
        <div className="grid grid-cols-3 gap-2">
          <PickerTile active={theme === 'system'} onClick={() => setTheme('system')}>
            <span className="inline-flex items-center gap-1.5"><Monitor className="h-4 w-4" /> System</span>
          </PickerTile>
          <PickerTile active={theme === 'light'} onClick={() => setTheme('light')}>
            <span className="inline-flex items-center gap-1.5"><Sun className="h-4 w-4" /> Light</span>
          </PickerTile>
          <PickerTile active={theme === 'dark'} onClick={() => setTheme('dark')}>
            <span className="inline-flex items-center gap-1.5"><Moon className="h-4 w-4" /> Dark</span>
          </PickerTile>
        </div>
        <p className="text-[11px] text-ink-muted mt-2">System follows your device setting and switches automatically when it changes.</p>
      </Card>

      {/* Units */}
      <Card icon={Ruler} title={t('prefs.units')}>
        <div className="grid grid-cols-2 gap-2">
          <PickerTile active={unitSystem === 'metric'} onClick={() => setUnitSystem('metric')}>
            {t('prefs.units_metric')}
          </PickerTile>
          <PickerTile active={unitSystem === 'imperial'} onClick={() => setUnitSystem('imperial')}>
            {t('prefs.units_imperial')}
          </PickerTile>
        </div>
      </Card>

      {/* WhatsApp notifications */}
      <Card icon={Bell} title={t('prefs.notifications')}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              {t('prefs.whatsapp_number')}
            </span>
            <input
              type="tel"
              value={waNumber}
              onChange={e => setWaNumber(e.target.value)}
              placeholder="+201234567890"
              className="mt-1 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <p className="text-[11px] text-ink-muted mt-1">{t('prefs.whatsapp_help')}</p>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-strong">
            <input
              type="checkbox"
              checked={waOptin}
              onChange={e => setWaOptin(e.target.checked)}
              disabled={!waNumber.trim()}
              className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500 disabled:opacity-40"
            />
            {t('prefs.whatsapp_optin')}
          </label>

          {/* Sandbox onboarding helper — appears the moment the user starts
              entering a number. Disappears once we move to a production
              sender (set NEXT_PUBLIC_WHATSAPP_SANDBOX=false). */}
          {waNumber.trim() && <WhatsAppSandboxJoin />}
        </div>
      </Card>

      {/* Features visibility (050 batch) — pick which areas you want
          to see for each stage. Applies to YOU only and only on profiles
          where you're the parent/owner. */}
      <Card icon={Sliders} title="Features per stage">
        <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 mb-3">
          {(['planning','pregnancy','baby'] as const).map(s => (
            <button key={s} type="button" onClick={() => setFeatStage(s)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-semibold capitalize',
                featStage === s ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
              {s === 'planning' ? 'My cycle' : s === 'pregnancy' ? 'Pregnancy' : 'Baby'}
            </button>
          ))}
        </div>
        <AreaPicker
          value={features[featStage]}
          onChange={next => setFeatures(prev => ({ ...prev, [featStage]: next }))}
          stage={featStage}
        />
      </Card>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}
          className="h-12 rounded-2xl text-base font-semibold bg-gradient-to-r from-brand-500 to-mint-500 hover:from-brand-600 hover:to-mint-600 px-6">
          <Save className="h-5 w-5" /> {pending ? t('common.saving') : t('common.save')}
        </Button>
        {savedAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-50 text-mint-700 text-xs font-bold px-3 py-1">
            <Check className="h-3.5 w-3.5" /> {t('prefs.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

/** Apply the chosen theme class to <html> right now. The same logic runs
 *  again on every page load via app/layout.tsx (server-side) — this just
 *  avoids a flash on save. */
function applyThemeClass(theme: 'system' | 'light' | 'dark') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const wantsDark = theme === 'dark'
    || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', wantsDark);
}

function Card({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-lg grid place-items-center bg-brand-100 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-bold text-ink-strong">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function PickerTile({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'rounded-2xl border px-4 py-3 text-sm font-semibold transition',
        active ? 'border-brand-500 bg-brand-50 text-brand-700'
               : 'border-slate-200 bg-white hover:bg-slate-50 text-ink',
      )}>
      {children}
    </button>
  );
}

'use client';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Clock, Check, Minus, Plus } from 'lucide-react';

/** Numbered section used in every log form */
export function Section({ n, title, optional, children }: {
  n: number; title: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-lg font-bold text-ink-strong">
        <span className="text-ink-muted font-medium">{n}. </span>
        {title}
        {optional && <span className="ml-1 text-ink-muted text-sm font-normal">(optional)</span>}
      </h3>
      {children}
    </section>
  );
}

type Tint = 'coral' | 'brand' | 'peach' | 'mint' | 'lavender';

const RING: Record<Tint, string> = {
  coral: 'ring-coral-500 bg-coral-50',
  brand: 'ring-brand-500 bg-brand-50',
  peach: 'ring-peach-500 bg-peach-50',
  mint:  'ring-mint-500  bg-mint-50',
  lavender: 'ring-lavender-500 bg-lavender-50',
};
const ICON_ACTIVE: Record<Tint, string> = {
  coral: 'bg-coral-500 text-white',
  brand: 'bg-brand-500 text-white',
  peach: 'bg-peach-500 text-white',
  mint:  'bg-mint-500 text-white',
  lavender: 'bg-lavender-500 text-white',
};
const ICON_IDLE: Record<Tint, string> = {
  coral: 'bg-coral-100 text-coral-500',
  brand: 'bg-brand-100 text-brand-500',
  peach: 'bg-peach-100 text-peach-500',
  mint:  'bg-mint-100 text-mint-500',
  lavender: 'bg-lavender-100 text-lavender-500',
};

/** Big selectable tile used as a radio-group item (breast/bottle/solid etc.) */
export function TypeTile({
  icon: Icon, label, tint, active, onClick, sub,
}: {
  icon: LucideIcon;
  label: string;
  tint: Tint;
  active: boolean;
  onClick: () => void;
  sub?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 transition',
        active ? `ring-2 ${RING[tint]} border-transparent` : 'border-slate-200 bg-white hover:bg-slate-50'
      )}
    >
      <div className={cn('h-12 w-12 rounded-2xl grid place-items-center', active ? ICON_ACTIVE[tint] : ICON_IDLE[tint])}>
        <Icon className="h-6 w-6" />
      </div>
      <span className={cn('font-semibold', active ? 'text-ink-strong' : 'text-ink')}>{label}</span>
      {sub && <span className="text-xs text-ink-muted text-center">{sub}</span>}
    </button>
  );
}

/** Quick time-ago pill used in the "When?" section */
export function QuickPill({ active, onClick, icon, tint = 'coral', children }: {
  active?: boolean; onClick: () => void; icon?: React.ReactNode; tint?: Tint; children: React.ReactNode;
}) {
  const filled = {
    coral: 'bg-coral-500 border-coral-500',
    brand: 'bg-brand-500 border-brand-500',
    peach: 'bg-peach-500 border-peach-500',
    mint:  'bg-mint-500 border-mint-500',
    lavender: 'bg-lavender-500 border-lavender-500',
  }[tint];
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition',
        active
          ? `${filled} text-white shadow-sm`
          : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-muted mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

/** Big stepper (number with +/- buttons) used for breast minutes, temperature etc. */
export function Stepper({
  label, value, onChange, unit, step = 1, min = 0, max = 999, badge,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit: string;
  step?: number;
  min?: number;
  max?: number;
  badge?: { text: string; tint: Tint };
}) {
  const badgeCss = badge ? {
    coral: 'bg-coral-100 text-coral-700',
    brand: 'bg-brand-100 text-brand-700',
    peach: 'bg-peach-100 text-peach-700',
    mint:  'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
  }[badge.tint] : '';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink">{label}</div>
        {badge && <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', badgeCss)}>{badge.text}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-3xl font-bold text-ink-strong">
          {value} <span className="text-sm font-medium text-ink-muted">{unit}</span>
        </div>
        <div className="inline-flex items-center gap-1">
          <button type="button" onClick={() => onChange(Math.max(min, value - step))}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center">
            <Minus className="h-4 w-4 text-ink" />
          </button>
          <button type="button" onClick={() => onChange(Math.min(max, value + step))}
            className="h-9 w-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center">
            <Plus className="h-4 w-4 text-ink" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** "When?" section — shared across every log form */
export function WhenPicker({ time, onChange, tint = 'coral' }: {
  time: string;
  onChange: (local: string) => void;
  tint?: Tint;
}) {
  function setRelative(minutesAgo: number) {
    const d = new Date(Date.now() - minutesAgo * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }
  const isNow = (() => {
    const d = new Date(time);
    return Math.abs(d.getTime() - Date.now()) < 2 * 60 * 1000;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuickPill active={isNow} onClick={() => setRelative(0)} tint={tint} icon={<Check className="h-3.5 w-3.5" />}>Now</QuickPill>
      <QuickPill onClick={() => setRelative(15)} tint={tint}>−15 min</QuickPill>
      <QuickPill onClick={() => setRelative(30)} tint={tint}>−30 min</QuickPill>
      <QuickPill onClick={() => setRelative(60)} tint={tint}>−1 hr</QuickPill>
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
        <Clock className="h-3.5 w-3.5 text-ink-muted" />
        <input type="datetime-local" value={time} onChange={e => onChange(e.target.value)}
          className="bg-transparent text-sm focus:outline-none" />
      </div>
    </div>
  );
}

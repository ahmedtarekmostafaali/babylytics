'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Check, Save, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  OVERVIEW_WIDGETS, PREGNANCY_DASHBOARD_WIDGETS, DAILY_REPORT_WIDGETS, FULL_REPORT_WIDGETS,
  type WidgetDef, type WidgetScope,
} from '@/lib/dashboard-prefs';

const SCOPES: { id: WidgetScope; label: string; widgets: WidgetDef[] }[] = [
  { id: 'overview',            label: 'Overview',     widgets: OVERVIEW_WIDGETS },
  { id: 'pregnancy_dashboard', label: 'Pregnancy',    widgets: PREGNANCY_DASHBOARD_WIDGETS },
  { id: 'daily_report',        label: 'Daily report', widgets: DAILY_REPORT_WIDGETS },
  { id: 'full_report',         label: 'Full report',  widgets: FULL_REPORT_WIDGETS },
];

export function DashboardSettingsForm({
  babyId, initialHidden,
}: {
  babyId: string;
  initialHidden: Record<WidgetScope, string[]>;
}) {
  const router = useRouter();
  const [activeScope, setActiveScope] = useState<WidgetScope>('overview');
  const [hidden, setHidden] = useState<Record<WidgetScope, Set<string>>>(() => ({
    overview:            new Set(initialHidden.overview),
    pregnancy_dashboard: new Set(initialHidden.pregnancy_dashboard),
    daily_report:        new Set(initialHidden.daily_report),
    full_report:         new Set(initialHidden.full_report),
  }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState<string | null>(null);
  const [err, setErr]       = useState<string | null>(null);

  const scope = SCOPES.find(s => s.id === activeScope)!;
  const grouped = useMemo(() => {
    const out: Record<string, WidgetDef[]> = {};
    for (const w of scope.widgets) (out[w.group] ??= []).push(w);
    return out;
  }, [scope]);

  function toggle(scopeId: WidgetScope, widgetId: string) {
    setHidden(h => {
      const next = new Set(h[scopeId]);
      if (next.has(widgetId)) next.delete(widgetId); else next.add(widgetId);
      return { ...h, [scopeId]: next };
    });
  }

  function showAll(scopeId: WidgetScope) {
    setHidden(h => ({ ...h, [scopeId]: new Set() }));
  }

  async function save() {
    setErr(null); setMsg(null); setSaving(true);
    const supabase = createClient();
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) { setSaving(false); setErr('not authenticated'); return; }

    const rows: { user_id: string; baby_id: string; scope: WidgetScope; hidden_widgets: string[]; updated_at: string }[] = [];
    for (const s of SCOPES) {
      rows.push({
        user_id: userId,
        baby_id: babyId,
        scope: s.id,
        hidden_widgets: Array.from(hidden[s.id]),
        updated_at: new Date().toISOString(),
      });
    }
    const { error } = await supabase.from('dashboard_preferences').upsert(rows, {
      onConflict: 'user_id,baby_id,scope',
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg('Saved.');
    router.refresh();
  }

  const totalHidden = Array.from(hidden[activeScope]).length;
  const totalWidgets = scope.widgets.length;

  return (
    <div className="space-y-5">
      {/* Scope tabs */}
      <div className="rounded-2xl bg-slate-100 p-1 grid grid-cols-2 sm:grid-cols-4 text-sm font-semibold">
        {SCOPES.map(s => {
          const active = activeScope === s.id;
          const hiddenCount = hidden[s.id].size;
          return (
            <button key={s.id} type="button" onClick={() => setActiveScope(s.id)}
              className={cn('rounded-xl py-2 transition inline-flex items-center justify-center gap-1.5',
                active ? 'bg-white text-ink-strong shadow-sm' : 'text-ink-muted hover:text-ink')}>
              {s.label}
              {hiddenCount > 0 && (
                <span className={cn('text-[10px] uppercase tracking-wider rounded-full px-1.5',
                  active ? 'bg-coral-100 text-coral-700' : 'bg-slate-200 text-slate-600')}>
                  {hiddenCount} hidden
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>{totalWidgets - totalHidden} of {totalWidgets} widgets visible</span>
        <button type="button" onClick={() => showAll(activeScope)}
          className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1">
          <Eye className="h-3.5 w-3.5" /> Show all
        </button>
      </div>

      <div className="space-y-5">
        {Object.entries(grouped).map(([groupName, widgets]) => (
          <section key={groupName} className="rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-2.5 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {groupName}
            </div>
            <ul className="divide-y divide-slate-100">
              {widgets.map(w => {
                const isHidden = hidden[activeScope].has(w.id);
                return (
                  <li key={w.id}>
                    <button type="button" onClick={() => toggle(activeScope, w.id)}
                      className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                      <div className="flex-1 min-w-0">
                        <div className={cn('font-semibold', isHidden ? 'text-ink-muted line-through' : 'text-ink-strong')}>
                          {w.label}
                        </div>
                        <div className="text-xs text-ink-muted">{w.description}</div>
                      </div>
                      {/* iOS-style toggle */}
                      <span className={cn(
                        'relative inline-block h-6 w-11 rounded-full transition shrink-0',
                        isHidden ? 'bg-slate-300' : 'bg-mint-500'
                      )}>
                        <span className={cn(
                          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                          isHidden ? '' : 'translate-x-5'
                        )} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
      {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}

      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent pt-4 pb-2 -mx-1 px-1">
        <Button type="button" onClick={save} disabled={saving}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-brand-500 to-mint-500">
          {saving ? <EyeOff className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : msg ? <><Check className="h-4 w-4" /> Saved</> : 'Save preferences'}
        </Button>
        <p className="mt-2 text-[11px] text-ink-muted text-center">
          Settings are per-user. Each caregiver can pick their own view.
        </p>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fmtRelative } from '@/lib/dates';
import { cn } from '@/lib/utils';
import {
  Bell, X, Check, Pill, FileText, Milk, Droplet, AlertTriangle, BellOff, ArrowRight,
} from 'lucide-react';
import { useT } from '@/lib/i18n/client';

type Notification = {
  id: string;
  baby_id: string;
  kind: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const KIND_META: Record<string, { icon: React.ComponentType<{ className?: string }>; tint: string; tkey: string }> = {
  medication_due:      { icon: Pill,    tint: 'bg-coral-100 text-coral-700',     tkey: 'notif.medication_due' },
  medication_missed:   { icon: Pill,    tint: 'bg-coral-100 text-coral-700',     tkey: 'notif.medication_missed' },
  low_ocr_confidence:  { icon: FileText,tint: 'bg-peach-100 text-peach-700',     tkey: 'notif.smart_scan_review' },
  file_ready:          { icon: FileText,tint: 'bg-mint-100 text-mint-700',       tkey: 'notif.file_ready' },
  feeding_alert:       { icon: Milk,    tint: 'bg-coral-100 text-coral-700',     tkey: 'notif.feeding_alert' },
  stool_alert:         { icon: Droplet, tint: 'bg-mint-100 text-mint-700',       tkey: 'notif.stool_alert' },
};

export function NotificationsBell({ babyId }: { babyId: string }) {
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Load notifications when popup opens (and once on mount for the badge count).
  // Uses my_unread_notifications RPC so broadcast read state is per-user
  // (migration 028). Read items aren't returned by that RPC, so the bell only
  // shows what the current user actually still needs to act on.
  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('my_unread_notifications', { p_baby: babyId });
    // Coerce shape — RPC returns the same row shape, just stripped of any rows
    // already read by this user.
    setItems(((data ?? []) as Notification[]).slice(0, 40));
    setLoading(false);
  }

  useEffect(() => { load(); /* initial load for the badge */ }, [babyId]);
  useEffect(() => { if (open) load(); }, [open]);

  const unread = items.filter(n => !n.read_at).length;

  async function markAllRead() {
    const supabase = createClient();
    const { error } = await supabase.rpc('mark_notifications_read', { p_baby: babyId });
    if (!error) {
      setItems(arr => arr.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      router.refresh();
    }
  }

  async function clearAll() {
    if (!window.confirm(t('notif.clear_confirm'))) return;
    const supabase = createClient();
    const { error } = await supabase.rpc('clear_notifications', { p_baby: babyId });
    if (!error) {
      setItems([]);
      router.refresh();
    }
  }

  async function dismiss(id: string) {
    const supabase = createClient();
    // mark_one_notification_read handles per-user reads on broadcasts via the
    // notification_reads table (migration 028) and a plain read_at update on
    // personal rows.
    await supabase.rpc('mark_one_notification_read', { p_id: id });
    setItems(arr => arr.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }

  function hrefFor(n: Notification): string | null {
    const baby = `/babies/${n.baby_id}`;
    switch (n.kind) {
      case 'medication_due':
      case 'medication_missed':
        return `${baby}/medications`;
      case 'low_ocr_confidence':
        if (typeof n.payload?.extracted_id === 'string') return `${baby}/ocr/${n.payload.extracted_id}`;
        if (typeof n.payload?.file_id === 'string')      return `${baby}/files/${n.payload.file_id}`;
        return `${baby}/ocr`;
      case 'feeding_alert': return `${baby}/feedings`;
      case 'stool_alert':   return `${baby}/stool`;
      case 'file_ready':    return `${baby}/ocr`;
      default:              return null;
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="relative h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
        aria-label={t('notif.aria_label')}>
        <Bell className={`h-4 w-4 ${unread > 0 ? 'text-coral-600' : 'text-ink'}`} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-coral-500 text-white text-[10px] grid place-items-center font-bold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-panel z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-ink" />
              <h3 className="text-sm font-bold text-ink-strong">{t('notif.header')}</h3>
              {unread > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-coral-700 bg-coral-50 px-1.5 py-0.5 rounded-full">
                  {t('notif.n_unread', { n: unread })}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center rounded-full hover:bg-slate-100" aria-label={t('notif.close')}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Action row */}
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between text-xs">
            <button onClick={markAllRead} disabled={unread === 0}
              className={cn(
                'inline-flex items-center gap-1 font-semibold',
                unread === 0 ? 'text-ink-muted' : 'text-brand-600 hover:text-brand-700'
              )}>
              <Check className="h-3.5 w-3.5" /> {t('notif.mark_all')}
            </button>
            <button onClick={clearAll} disabled={items.length === 0}
              className={cn(
                'inline-flex items-center gap-1 font-semibold',
                items.length === 0 ? 'text-ink-muted' : 'text-coral-600 hover:text-coral-700'
              )}>
              <BellOff className="h-3.5 w-3.5" /> {t('notif.clear_all')}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-6 text-center text-xs text-ink-muted">{t('notif.loading')}</p>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-ink-muted">
                <BellOff className="h-7 w-7 mx-auto opacity-50" />
                <p className="mt-2">{t('notif.all_caught_up')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map(n => {
                  const meta = KIND_META[n.kind] ?? { icon: AlertTriangle, tint: 'bg-slate-100 text-ink', tkey: '' };
                  const Icon = meta.icon;
                  const href = hrefFor(n);
                  const message = (() => {
                    if (typeof n.payload?.message === 'string') return n.payload.message as string;
                    if (n.kind === 'low_ocr_confidence') {
                      const conf = typeof n.payload?.confidence === 'number' ? Math.round(n.payload.confidence * 100) : null;
                      return conf != null ? t('notif.smart_scan_conf', { n: conf }) : t('notif.smart_scan_needs');
                    }
                    if (n.kind === 'medication_due')    return t('notif.med_due_msg');
                    if (n.kind === 'medication_missed') return t('notif.med_missed_msg');
                    if (n.kind === 'file_ready')        return t('notif.file_ready_msg');
                    return meta.tkey ? t(meta.tkey) : n.kind;
                  })();
                  const Body = (
                    <>
                      <span className={cn('h-9 w-9 rounded-xl grid place-items-center shrink-0', meta.tint)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm', n.read_at ? 'text-ink-muted' : 'text-ink-strong font-semibold')}>
                          {message}
                        </div>
                        <div className="text-[11px] text-ink-muted">{fmtRelative(n.created_at)}</div>
                      </div>
                      {href && <ArrowRight className="h-3.5 w-3.5 text-ink-muted shrink-0 mt-2" />}
                    </>
                  );
                  return (
                    <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition group', !n.read_at && 'bg-coral-50/30')}>
                      {href ? (
                        <Link href={href} onClick={() => { dismiss(n.id); setOpen(false); }}
                          className="flex items-start gap-3 flex-1 min-w-0">
                          {Body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 flex-1 min-w-0">{Body}</div>
                      )}
                      {!n.read_at && (
                        <button onClick={() => dismiss(n.id)}
                          className="opacity-0 group-hover:opacity-100 transition h-6 w-6 grid place-items-center rounded-full hover:bg-slate-100"
                          title={t('notif.mark_read')} aria-label={t('notif.mark_read')}>
                          <Check className="h-3.5 w-3.5 text-ink-muted" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

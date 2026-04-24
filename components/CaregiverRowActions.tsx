'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MoreHorizontal, Trash2, ChevronRight, Loader2 } from 'lucide-react';

type Role = 'owner' | 'parent' | 'doctor' | 'nurse' | 'caregiver' | 'viewer' | 'editor';

const ROLES: { value: Exclude<Role, 'editor' | 'caregiver'>; label: string }[] = [
  { value: 'owner',   label: 'Owner' },
  { value: 'parent',  label: 'Parent / Guardian' },
  { value: 'doctor',  label: 'Doctor' },
  { value: 'nurse',   label: 'Nurse' },
  { value: 'viewer',  label: 'Viewer' },
];

/**
 * Per-row actions menu for the caregivers list.
 *
 * The menu renders through a React portal into <body> so it can escape any
 * `overflow-hidden` on its ancestor card — otherwise the "Change role" popover
 * gets clipped by the list container.
 */
export function CaregiverRowActions({
  babyId, userId, currentRole, canManage, isSelf,
}: {
  babyId: string;
  userId: string;
  currentRole: Role;
  canManage: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; flipRight: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  // Position the floating menu below-right of the button.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const menuWidth = 224; // w-56
    const flipRight = r.left + menuWidth > window.innerWidth - 8;
    setCoords({
      top: r.bottom + 6,
      left: flipRight ? r.right - menuWidth : r.left,
      flipRight,
    });
  }, [open]);

  // Close on escape / resize / scroll.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function onScroll() { setOpen(false); }
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onScroll, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onScroll, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  async function changeRole(newRole: Role) {
    setErr(null); setOpen(false);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('set_caregiver_role', {
        p_baby: babyId, p_user: userId, p_role: newRole,
      });
      if (error) { setErr(error.message); return; }
      router.refresh();
    });
  }

  async function revoke() {
    if (!window.confirm('Remove this caregiver from the baby?')) return;
    setErr(null); setOpen(false);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('revoke_caregiver', { p_baby: babyId, p_user: userId });
      if (error) { setErr(error.message); return; }
      router.refresh();
    });
  }

  if (!canManage || isSelf) {
    return (
      <button aria-label="More" disabled
        title={isSelf ? 'You can\'t change your own role here' : 'Only parents and owners can manage caregivers'}
        className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted opacity-40 cursor-not-allowed">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={() => setOpen(o => !o)} aria-label="Actions" disabled={pending}
        className="h-8 w-8 grid place-items-center rounded-lg hover:bg-slate-100 text-ink">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>

      {open && coords && typeof document !== 'undefined' && createPortal(
        <>
          <button onClick={() => setOpen(false)} aria-hidden
            className="fixed inset-0 z-[60] cursor-default bg-transparent" />
          <div
            role="menu"
            className="fixed z-[70] w-56 rounded-xl border border-slate-200 bg-white shadow-panel p-1"
            style={{ top: coords.top, left: coords.left }}>
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              Change role
            </div>
            {ROLES.filter(r => r.value !== currentRole).map(r => (
              <button key={r.value} onClick={() => changeRole(r.value)}
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <ChevronRight className="h-3.5 w-3.5 text-ink-muted" />
                {r.label}
              </button>
            ))}
            <div className="h-px bg-slate-100 my-1" />
            <button onClick={revoke}
              className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-coral-50 text-coral-700 flex items-center gap-2">
              <Trash2 className="h-3.5 w-3.5" />
              Remove caregiver
            </button>
          </div>
        </>,
        document.body,
      )}

      {err && (
        <div className="absolute right-0 top-full mt-2 z-50 whitespace-nowrap rounded-md bg-coral-50 text-coral-700 text-xs px-2 py-1 border border-coral-200 shadow-sm">
          {err}
        </div>
      )}
    </div>
  );
}

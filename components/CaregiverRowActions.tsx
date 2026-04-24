'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MoreHorizontal, Trash2, ChevronDown, Loader2 } from 'lucide-react';

type Role = 'owner' | 'parent' | 'doctor' | 'nurse' | 'caregiver' | 'viewer' | 'editor';

const ROLES: { value: Exclude<Role, 'editor'>; label: string }[] = [
  { value: 'owner',     label: 'Owner' },
  { value: 'parent',    label: 'Parent / Guardian' },
  { value: 'doctor',    label: 'Doctor' },
  { value: 'nurse',     label: 'Nurse' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'viewer',    label: 'Viewer' },
];

/**
 * Small menu attached to each caregiver row — lets an owner/parent change the
 * user's role or remove them from the baby.
 */
export function CaregiverRowActions({
  babyId, userId, currentRole, canManage, isSelf,
}: {
  babyId: string;
  userId: string;
  currentRole: Role;
  /** true if the viewer is a parent/owner */
  canManage: boolean;
  /** true if this row is the currently signed-in user */
  isSelf: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

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
    // Still render the dots for visual parity but disabled
    return (
      <button aria-label="More" disabled
        className="h-8 w-8 grid place-items-center rounded-lg text-ink-muted opacity-40 cursor-not-allowed">
        <MoreHorizontal className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Actions" disabled={pending}
        className="h-8 w-8 grid place-items-center rounded-lg hover:bg-slate-100 text-ink">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <>
          <button onClick={() => setOpen(false)} aria-hidden className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl border border-slate-200 bg-white shadow-panel p-1">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Change role</div>
            {ROLES.filter(r => r.value !== currentRole).map(r => (
              <button key={r.value} onClick={() => changeRole(r.value)}
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
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
        </>
      )}
      {err && <p className="absolute right-0 top-full mt-2 z-50 whitespace-nowrap rounded-md bg-coral-50 text-coral-700 text-xs px-2 py-1 border border-coral-200">{err}</p>}
    </div>
  );
}

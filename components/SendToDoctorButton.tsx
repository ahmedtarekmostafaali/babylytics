'use client';

// SendToDoctorButton — opens a private 1:1 chat thread with a doctor
// caregiver and pre-fills it with the cycle red-flag questions. Reuses
// the chat infrastructure from Wave 8 (start_or_get_direct_thread +
// send_thread_message RPCs) — nothing custom, just wires the UI.
//
// Three states:
//   - 0 doctor caregivers → CTA to invite a doctor
//   - 1 doctor caregiver  → one-click open + prefilled, edit-and-send
//   - 2+ doctor caregivers → small picker, then same flow
//
// The pre-filled message is shown in a textarea so the user can edit /
// add context before sending. We never auto-send.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Send, Loader2, Stethoscope, X, MessageCircle, UserPlus } from 'lucide-react';
import Link from 'next/link';

export interface DoctorCaregiver {
  user_id: string;
  display_name: string | null;
  email: string | null;
  doctor_name: string | null;
  doctor_specialty: string | null;
}

export interface DoctorQuestion {
  question: string;
  evidence: string;
  severity: 'info' | 'warn' | 'urgent';
}

export function SendToDoctorButton({
  babyId, questions, label = 'Send these to my doctor',
}: {
  babyId: string;
  questions: DoctorQuestion[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorCaregiver[] | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Lazy-load the doctor list when the modal first opens. Avoids a
  // useless RPC call on every planner page load when the user never
  // touches this button.
  useEffect(() => {
    if (!open || doctors !== null) return;
    const supabase = createClient();
    supabase.rpc('doctor_caregivers_for', { p_baby: babyId })
      .then(({ data }) => {
        const list = (data ?? []) as DoctorCaregiver[];
        setDoctors(list);
        // Auto-select if there's exactly one — saves a tap.
        if (list.length === 1) setSelectedUser(list[0]!.user_id);
      });
  }, [open, doctors, babyId]);

  // Pre-fill the textarea once we have questions + the selected doctor
  // resolves. The user can still edit before sending.
  useEffect(() => {
    if (!open || draft) return;
    const intro = questions.length === 1
      ? "Hi — there's one thing I'd like to ask you about at my next visit:"
      : `Hi — there are ${questions.length} things I'd like to ask you about at my next visit:`;
    const body = questions.map((q, i) =>
      `${i + 1}. ${q.question}\n   Evidence from my tracker: ${q.evidence}`
    ).join('\n\n');
    setDraft(`${intro}\n\n${body}\n\nThank you.`);
  }, [open, questions, draft]);

  function close() {
    setOpen(false);
    setSent(false);
    setErr(null);
    // Reset draft so the next open re-prefills (in case questions change).
    setDraft('');
  }

  async function send() {
    if (!selectedUser || !draft.trim()) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    // 1. Find/create the 1:1 thread with this doctor on this baby.
    const { data: threadId, error: threadErr } = await supabase.rpc(
      'start_or_get_direct_thread',
      { p_baby: babyId, p_other_user: selectedUser },
    );
    if (threadErr || !threadId) {
      setBusy(false);
      setErr(threadErr?.message ?? 'Could not open chat');
      return;
    }
    // 2. Post the message to that thread.
    const { error: sendErr } = await supabase.rpc('send_thread_message', {
      p_thread: threadId, p_body: draft.trim(),
    });
    setBusy(false);
    if (sendErr) { setErr(sendErr.message); return; }
    setSent(true);
    // Refresh after a beat so the chat sidebar shows the new thread when
    // they navigate. Don't auto-route — let them see the success state.
    setTimeout(() => router.refresh(), 600);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        disabled={questions.length === 0}
        className="inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
        <Send className="h-3.5 w-3.5" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}>
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg grid place-items-center bg-lavender-100 text-lavender-700">
                  <Stethoscope className="h-4 w-4" />
                </span>
                <h2 className="text-base font-bold text-ink-strong">Send to my doctor</h2>
              </div>
              <button type="button" onClick={close}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {sent ? (
                <div className="text-center py-6">
                  <div className="mx-auto h-14 w-14 rounded-full bg-mint-500 text-white grid place-items-center mb-3">
                    <MessageCircle className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-strong">Sent</h3>
                  <p className="mt-1 text-sm text-ink-muted">Your doctor will see it as a private message — no other caregivers can read it.</p>
                  <Link href={`/babies/${babyId}/chat`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold px-4 py-2">
                    Open chat
                  </Link>
                </div>
              ) : doctors === null ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 text-coral-600 animate-spin" />
                </div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-6">
                  <div className="mx-auto h-12 w-12 rounded-full bg-coral-100 text-coral-600 grid place-items-center mb-2">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-ink-strong">No doctor caregiver yet</h3>
                  <p className="mt-1 text-sm text-ink-muted max-w-sm mx-auto">
                    Invite your doctor as a caregiver first — they get private access to the
                    parts of your profile you choose, and you can message them directly.
                  </p>
                  <Link href={`/babies/${babyId}/caregivers`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-coral-500 hover:bg-coral-600 text-white text-sm font-semibold px-4 py-2">
                    <UserPlus className="h-4 w-4" /> Invite a doctor
                  </Link>
                </div>
              ) : (
                <>
                  {/* Doctor picker — only renders when there are 2+ doctors. */}
                  {doctors.length > 1 && (
                    <div>
                      <div className="text-xs font-semibold text-ink-strong mb-2">Send to</div>
                      <div className="grid gap-2">
                        {doctors.map(d => {
                          const name = d.doctor_name?.trim()
                            || d.display_name?.trim()
                            || d.email?.split('@')[0]
                            || d.user_id.slice(0, 6);
                          const subline = [d.doctor_specialty, d.email].filter(Boolean).join(' · ');
                          const active = selectedUser === d.user_id;
                          return (
                            <button key={d.user_id} type="button"
                              onClick={() => setSelectedUser(d.user_id)}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                                active
                                  ? 'ring-2 ring-coral-500 border-transparent bg-coral-50/40'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}>
                              <span className="h-9 w-9 rounded-full bg-lavender-100 text-lavender-700 grid place-items-center text-xs font-bold shrink-0">
                                {name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-ink-strong text-sm truncate">{name}</div>
                                {subline && <div className="text-[11px] text-ink-muted truncate">{subline}</div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Editable message */}
                  <div>
                    <div className="text-xs font-semibold text-ink-strong mb-2">Message (edit before sending)</div>
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      rows={10}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30 leading-relaxed"
                    />
                    <p className="text-[11px] text-ink-muted mt-1">
                      Goes into a private 1:1 chat — only you and the selected doctor see it.
                    </p>
                  </div>

                  {err && <p className="text-xs text-coral-600">{err}</p>}

                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={close}
                      className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
                      Cancel
                    </button>
                    <button type="button" onClick={send}
                      disabled={busy || !selectedUser || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send privately
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

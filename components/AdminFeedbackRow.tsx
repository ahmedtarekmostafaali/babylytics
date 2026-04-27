'use client';

// Single feedback-inbox row with collapsible body + a client-side action bar
// to change status / save admin response. Posts back via a server-side RPC
// (admin_set_feedback_status) gated by is_platform_admin().

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChevronDown, ChevronUp, Paperclip, Mail, Loader2, Check } from 'lucide-react';

type Row = {
  id: string;
  user_email: string;
  user_name: string | null;
  kind: string;
  subject: string;
  body: string;
  attachment_path: string | null;
  status: 'open'|'triaged'|'in_progress'|'resolved'|'dismissed';
  admin_response: string | null;
  created_at: string;
};

const KIND_BADGE: Record<string, string> = {
  bug:              'bg-coral-100 text-coral-700',
  feature_request:  'bg-brand-100 text-brand-700',
  feedback:         'bg-mint-100 text-mint-700',
  question:         'bg-peach-100 text-peach-700',
};
const STATUS_BADGE: Record<string, string> = {
  open:        'bg-coral-100 text-coral-700',
  triaged:     'bg-peach-100 text-peach-700',
  in_progress: 'bg-brand-100 text-brand-700',
  resolved:    'bg-mint-100 text-mint-700',
  dismissed:   'bg-slate-100 text-ink-muted',
};

export function AdminFeedbackRow({ row, formatted }: { row: Row; formatted: { date: string; rel: string } }) {
  const [open,    setOpen]    = useState(false);
  const [status,  setStatus]  = useState(row.status);
  const [resp,    setResp]    = useState(row.admin_response ?? '');
  const [saving,  setSaving]  = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  // Lazy-sign the attachment URL only when the row is expanded — avoids
  // hammering Storage with N signing requests on the inbox load.
  async function ensureAttachmentSigned() {
    if (!row.attachment_path || attachmentUrl) return;
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('feedback-attachments')
      .createSignedUrl(row.attachment_path, 60 * 10);
    setAttachmentUrl(data?.signedUrl ?? null);
  }

  async function save() {
    setSaving(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc('admin_set_feedback_status', {
      p_id: row.id,
      p_status: status,
      p_response: resp.trim() || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    }
  }

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); if (!open) ensureAttachmentSigned(); }}
        className="w-full text-left px-4 py-3 hover:bg-slate-50/60 transition flex items-start gap-3"
      >
        <span className="h-9 w-9 rounded-xl bg-slate-100 grid place-items-center shrink-0 text-ink-strong text-xs font-bold">
          {(row.user_name || row.user_email).charAt(0).toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${KIND_BADGE[row.kind] ?? 'bg-slate-100'}`}>
              {row.kind.replace('_', ' ')}
            </span>
            <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 ${STATUS_BADGE[row.status] ?? 'bg-slate-100'}`}>
              {row.status.replace('_', ' ')}
            </span>
            <span className="font-semibold text-ink-strong truncate">{row.subject}</span>
          </div>
          <div className="text-[11px] text-ink-muted mt-0.5">
            {row.user_name || row.user_email.split('@')[0]} · <span className="text-ink-muted/80">{row.user_email}</span> · {formatted.date} · {formatted.rel}
            {row.attachment_path && <span className="inline-flex items-center gap-0.5 ml-2"><Paperclip className="h-3 w-3" /> attachment</span>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-ink-muted shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-ink-muted shrink-0 mt-1" />}
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 space-y-3">
          <p className="whitespace-pre-wrap text-sm text-ink leading-relaxed">{row.body}</p>

          {row.attachment_path && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1.5">Attachment</div>
              {attachmentUrl ? (
                <a href={attachmentUrl} target="_blank" rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
                  <Paperclip className="h-3 w-3" /> Open in new tab
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> signing URL…
                </span>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-[160px_1fr] gap-3 items-start">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as Row['status'])}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                <option value="open">Open</option>
                <option value="triaged">Triaged</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold block mb-1">Internal response (optional)</label>
              <textarea value={resp} onChange={e => setResp(e.target.value)} rows={2}
                placeholder="Notes for yourself, or canned reply text — not auto-sent to the user."
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <a href={`mailto:${row.user_email}?subject=Re:%20${encodeURIComponent(row.subject)}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
              <Mail className="h-3.5 w-3.5" /> Email user
            </a>
            <div className="flex items-center gap-2">
              {error && <span className="text-xs text-coral-600">{error}</span>}
              {savedAt && (
                <span className="inline-flex items-center gap-1 text-xs text-mint-700 font-semibold">
                  <Check className="h-3.5 w-3.5" /> saved
                </span>
              )}
              <button onClick={save} disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink text-white text-xs font-semibold px-3 py-1.5 disabled:opacity-50">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

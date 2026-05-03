'use client';

// ForumReportButton — opens a modal to report a thread or reply. Hidden
// from the author of the target (you can't report your own post).
// Submits to the forum_reports table; one report per user per item is
// enforced by a unique constraint.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Flag, X, Check, Loader2 } from 'lucide-react';

type Reason = 'spam' | 'harassment' | 'off_topic' | 'medical_misinformation' | 'self_harm' | 'other';

const REASONS: { value: Reason; en: string; ar: string }[] = [
  { value: 'spam',                   en: 'Spam or commercial',          ar: 'سبام أو إعلان' },
  { value: 'harassment',             en: 'Harassment or hate',          ar: 'تحرش أو كراهية' },
  { value: 'off_topic',              en: 'Off-topic for this category', ar: 'خارج موضوع القسم' },
  { value: 'medical_misinformation', en: 'Medical misinformation',      ar: 'معلومات طبية مضللة' },
  { value: 'self_harm',              en: 'Self-harm or unsafe content', ar: 'إيذاء للنفس أو محتوى خطر' },
  { value: 'other',                  en: 'Something else',              ar: 'سبب آخر' },
];

export function ForumReportButton({
  targetType, targetId, lang = 'en',
}: {
  targetType: 'thread' | 'reply';
  targetId: string;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setReason(null); setDetail(''); setDone(false); setErr(null);
  }

  async function submit() {
    if (!reason) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setErr(isAr ? 'سجلي الدخول أولًا' : 'Sign in first'); return; }
    const { error } = await supabase.from('forum_reports').insert({
      target_type: targetType,
      target_id:   targetId,
      reported_by: user.id,
      reason,
      detail: detail.trim() || null,
    });
    setBusy(false);
    if (error) {
      // Unique violation = already reported. Treat as success silently.
      if (error.code === '23505') { setDone(true); return; }
      setErr(error.message);
      return;
    }
    setDone(true);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title={isAr ? 'إبلاغ' : 'Report'}
        className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-coral-600">
        <Flag className="h-3 w-3" /> {isAr ? 'إبلاغ' : 'Report'}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 backdrop-blur-sm p-4"
          onClick={close}>
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg grid place-items-center bg-coral-100 text-coral-700">
                  <Flag className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold text-ink-strong">{isAr ? 'إبلاغ' : 'Report'}</h3>
              </div>
              <button type="button" onClick={close}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {done ? (
              <div className="p-6 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-mint-500 text-white grid place-items-center mb-2">
                  <Check className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-ink-strong">
                  {isAr ? 'وصلنا الإبلاغ' : 'Report received'}
                </h4>
                <p className="mt-1 text-sm text-ink-muted">
                  {isAr
                    ? 'سيراجعه فريق المنصة. شكرًا للحفاظ على المجتمع.'
                    : 'A platform admin will review it. Thanks for keeping the community safe.'}
                </p>
                <button type="button" onClick={close}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2">
                  {isAr ? 'تم' : 'Done'}
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <p className="text-xs text-ink-muted">
                  {isAr
                    ? 'اختاري سببًا. لا يختفي المحتوى تلقائيًا — مدير المنصة يراجع كل بلاغ.'
                    : "Pick a reason. Nothing auto-hides — a platform admin reviews each report."}
                </p>
                <div className="space-y-1.5">
                  {REASONS.map(r => (
                    <button key={r.value} type="button" onClick={() => setReason(r.value)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition ${
                        reason === r.value
                          ? 'border-coral-500 bg-coral-50/40 text-ink-strong font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-ink'
                      }`}>
                      {isAr ? r.ar : r.en}
                    </button>
                  ))}
                </div>

                {reason === 'other' && (
                  <textarea value={detail} onChange={e => setDetail(e.target.value)}
                    placeholder={isAr ? 'فاصلي السبب (اختياري)' : 'Tell us more (optional)'}
                    rows={3} maxLength={1000}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
                )}

                {err && <p className="text-xs text-coral-600">{err}</p>}

                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={close}
                    className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="button" onClick={submit} disabled={busy || !reason}
                    className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2 disabled:opacity-50">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                    {isAr ? 'أرسلي البلاغ' : 'Submit report'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

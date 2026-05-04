'use client';

// PregnancyCompanion — Wave 33B. Two-mode AI assistant card on the
// pregnancy overview. The user picks "Explain my data" or "Draft a
// question for my visit", types a free-text prompt, and gets a response
// from Claude Haiku that is grounded in the user's actual tracked data
// via the pregnancy_companion_context RPC (server-side).
//
// Strict safety framing: the system prompt forbids medical advice /
// diagnosis / treatment recommendations. Every response ends with a
// "discuss with your doctor" line.
//
// Rate-limited at 5 calls per day per user (enforced server-side by
// record_companion_call RPC). The card shows X/5 today.

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, MessageCircle, FileQuestion, Loader2, AlertCircle } from 'lucide-react';

type Mode = 'explain' | 'draft_question';

export function PregnancyCompanion({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const [mode, setMode]     = useState<Mode>('explain');
  const [input, setInput]   = useState('');
  const [reply, setReply]   = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState<string | null>(null);
  const [calls, setCalls]   = useState<{ today: number; limit: number } | null>(null);

  // Initial fetch of "X/5 today" without making a call.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc('companion_calls_today', { p_baby: babyId });
      const row = ((data ?? []) as Array<{ calls_today: number; daily_limit: number }>)[0];
      if (!cancelled && row) {
        setCalls({ today: row.calls_today, limit: row.daily_limit });
      }
    })();
    return () => { cancelled = true; };
  }, [babyId]);

  async function submit() {
    const trimmed = input.trim();
    if (trimmed.length < 5 || busy) return;
    setBusy(true); setErr(null); setReply(null);
    try {
      const resp = await fetch('/api/pregnancy-companion', {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ baby_id: babyId, mode, user_input: trimmed, lang }),
      });
      const j = await resp.json();
      if (!resp.ok) {
        if (j?.error === 'rate_limited') {
          setErr(isAr
            ? 'وصلتِ للحد اليومي (٥ استدعاءات). جرّبي بكرة.'
            : 'You\'ve hit today\'s limit (5 calls). Try again tomorrow.');
        } else if (j?.error === 'companion_unavailable') {
          setErr(isAr
            ? 'المساعد غير متاح حالياً. يحتاج المسؤول إلى إعداد ANTHROPIC_API_KEY.'
            : 'Companion is not configured. Admin needs to set ANTHROPIC_API_KEY.');
        } else {
          setErr(isAr
            ? `حدث خطأ. ${j?.detail ?? ''}`
            : `Something went wrong. ${j?.detail ?? ''}`);
        }
      } else {
        setReply(j.text ?? '');
        if (typeof j.calls_today === 'number') {
          setCalls({ today: j.calls_today, limit: j.daily_limit ?? 5 });
        }
      }
    } catch {
      setErr(isAr ? 'تعذّر الاتصال.' : 'Could not reach the companion.');
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5 shadow-card">
      <header className="flex items-center gap-3 flex-wrap">
        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'المساعد الذكي للحمل' : 'Pregnancy companion'}
          </h3>
          <p className="text-xs text-ink-muted">
            {isAr
              ? 'اشرحي قراءة، أو صيغي سؤالاً لطبيبك. لا يعطي نصيحة علاجية.'
              : 'Explain a reading, or draft a question for your doctor. Never gives medical advice.'}
          </p>
        </div>
        {calls && (
          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
            calls.today >= calls.limit ? 'bg-coral-100 text-coral-700' : 'bg-slate-100 text-ink-muted'
          }`}>
            {calls.today}/{calls.limit} {isAr ? 'اليوم' : 'today'}
          </span>
        )}
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode('explain')}
          className={`flex items-center gap-2 rounded-xl border p-3 text-start transition ${
            mode === 'explain'
              ? 'border-coral-300 bg-coral-50/60'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 bg-coral-100 text-coral-700">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-ink-strong">
            {isAr ? 'اشرحي بياناتي' : 'Explain my data'}
          </span>
        </button>
        <button type="button" onClick={() => setMode('draft_question')}
          className={`flex items-center gap-2 rounded-xl border p-3 text-start transition ${
            mode === 'draft_question'
              ? 'border-coral-300 bg-coral-50/60'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}>
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 bg-lavender-100 text-lavender-700">
            <FileQuestion className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold text-ink-strong">
            {isAr ? 'صيغي سؤالاً للطبيب' : 'Draft a doctor question'}
          </span>
        </button>
      </div>

      <textarea
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder={mode === 'explain'
          ? (isAr ? 'مثال: ضغطي اليوم كان ١٤٢/٩٢، ماذا يعني؟' : 'e.g. My BP today was 142/92 — what does that mean?')
          : (isAr ? 'مثال: قلقانة من قراءات السكر بعد الإفطار' : 'e.g. Worried about post-iftar glucose readings')}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-ink focus:border-coral-300 focus:ring-2 focus:ring-coral-100 outline-none" />

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] text-ink-muted">
          {isAr
            ? 'يقرأ بياناتك المسجلة فقط. لا يعطي تشخيصاً.'
            : 'Reads only your tracked data. Never diagnoses.'}
        </span>
        <button type="button" onClick={submit}
          disabled={busy || input.trim().length < 5 || (calls?.today ?? 0) >= (calls?.limit ?? 5)}
          className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Sparkles className="h-3.5 w-3.5" />}
          {isAr ? 'اسألي' : 'Ask'}
        </button>
      </div>

      {reply && (
        <article className="mt-4 rounded-xl bg-white border border-slate-200 p-4 text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">
          {reply}
        </article>
      )}

      {err && (
        <div className="mt-3 rounded-xl border border-coral-200 bg-coral-50 p-3 text-xs text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
    </section>
  );
}

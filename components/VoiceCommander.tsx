'use client';

// Voice-to-log dictation widget. Tap the mic, speak in English or
// Egyptian Arabic, review what we heard, hit save. Always confirms
// before writing anything to the database — the parser is permissive
// so the human review step is non-negotiable.
//
// Implementation notes:
//   * Uses the Web Speech API (SpeechRecognition / webkitSpeechRecognition)
//     which is available in Chrome / Edge / Safari and supports `ar-EG`
//     out of the box. Firefox doesn't ship it — we render a friendly
//     "your browser doesn't support voice yet" message in that case.
//   * Server-side transcription (Whisper, Deepgram) would be more
//     accurate but costs money and adds latency. The Web Speech API is
//     good enough for the v1 / feasibility ship and is upgradeable.
//   * Every successful command opens a confirm modal showing the parsed
//     intent. Saving uses the same Supabase tables / columns as the
//     manual forms — no privileged code path.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  parseVoiceCommandAuto, type Intent,
  type FeedingIntent, type StoolIntent, type SleepIntent,
  type TemperatureIntent, type KickIntent, type NoteIntent,
} from '@/lib/voice/grammar';
import {
  Mic, MicOff, X, Save, Loader2, AlertTriangle,
  Milk, Droplet, Moon, Thermometer, Activity, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

// Minimal type shim for the Web Speech API — TypeScript's lib doesn't
// ship these because they're still a draft spec. We only use the bits
// we need; everything else stays `unknown`.
type SREvent = { results: { 0: { transcript: string } }[]; resultIndex: number };
type SRError = { error: string; message?: string };
type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (e: SREvent) => void;
  onerror: (e: SRError) => void;
  onend: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Win = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };

export function VoiceCommander({ babyId, lang = 'en' }: { babyId: string; lang?: 'en' | 'ar' }) {
  const router = useRouter();
  const t = useT();

  const [supported, setSupported]   = useState<boolean | null>(null); // null = checking
  const [open, setOpen]             = useState(false);
  const [listening, setListening]   = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError]           = useState<string | null>(null);
  const [intent, setIntent]         = useState<Intent | null>(null);
  const [detectedLang, setDetectedLang] = useState<'en' | 'ar' | null>(null);
  const [saving, setSaving]         = useState(false);
  const [savedMsg, setSavedMsg]     = useState<string | null>(null);

  // ASR language — controls which language the SpeechRecognition object
  // is biased toward. Defaults to the user's UI preference but can be
  // flipped per-session inside the modal. The PARSER always runs both
  // languages on the resulting transcript — so even if the user has
  // set this to Arabic and they speak English (or vice-versa), we still
  // try to recognise the command.
  const [asrLang, setAsrLang] = useState<'en' | 'ar'>(lang);
  // Re-sync when the parent's language changes (e.g. user toggled it).
  useEffect(() => { setAsrLang(lang); }, [lang]);

  const recRef = useRef<SR | null>(null);

  // Detect support on mount only — bail otherwise.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as Win;
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  function startListening() {
    setError(null); setTranscript(''); setIntent(null); setDetectedLang(null); setSavedMsg(null);
    const win = window as Win;
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) { setError(t('voice.unsupported')); return; }
    const r: SR = new Ctor();
    // ASR language — biases the recognizer's phonetics. The parser
    // always runs against BOTH languages on the resulting transcript,
    // so a mismatch isn't fatal.
    r.lang = asrLang === 'ar' ? 'ar-EG' : 'en-US';
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) => {
      let txt = '';
      for (let i = e.resultIndex; i < (e.results as unknown as { length: number }).length; i++) {
        txt += e.results[i][0].transcript;
      }
      setTranscript(txt);
    };
    r.onerror = (e) => {
      setListening(false);
      // 'no-speech', 'aborted', 'not-allowed', 'audio-capture'…
      if (e.error === 'not-allowed') setError(t('voice.err_perm'));
      else if (e.error === 'no-speech') setError(t('voice.err_no_speech'));
      else setError(`${t('voice.err_generic')} (${e.error})`);
    };
    r.onend = () => {
      setListening(false);
      // Once recognition ends, parse whatever we got. parseVoiceCommandAuto
      // tries both English and Arabic grammars and returns the matching
      // intent + the language it was detected in.
      setTranscript(curr => {
        if (curr) {
          const parsed = parseVoiceCommandAuto(curr);
          if (parsed) {
            setIntent(parsed.intent);
            setDetectedLang(parsed.lang);
          } else {
            setIntent(null);
            setDetectedLang(null);
            setError(t('voice.err_no_match'));
          }
        }
        return curr;
      });
    };
    recRef.current = r;
    setListening(true);
    try { r.start(); } catch { /* already started — ignore */ }
  }

  function stopListening() {
    recRef.current?.stop();
    setListening(false);
  }

  function reset() {
    setTranscript(''); setIntent(null); setDetectedLang(null); setError(null); setSavedMsg(null);
  }

  async function save() {
    if (!intent) return;
    setSaving(true); setError(null);
    const supabase = createClient();
    const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
    try {
      const result = await persistIntent(intent, babyId, userId, supabase);
      setSavedMsg(result);
      setIntent(null); setTranscript('');
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  // The button is hidden entirely when the browser doesn't support voice
  // recognition — we don't show "feature unavailable" chrome for users
  // who can't even reach the modal.
  if (supported === false) return null;
  if (supported === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
        title={t('voice.btn_title')}
        aria-label={t('voice.btn_title')}>
        <Mic className="h-4 w-4 text-ink" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => { stopListening(); setOpen(false); reset(); }}>
          <div className="w-full max-w-md rounded-3xl bg-white shadow-panel border border-slate-200 p-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-coral-700">{t('voice.eyebrow')}</div>
                <h3 className="text-lg font-bold text-ink-strong">{t('voice.title')}</h3>
              </div>
              <button onClick={() => { stopListening(); setOpen(false); reset(); }}
                className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100"
                aria-label={t('voice.close')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* ASR language toggle — biases the speech recognizer's
                phonetics. The parser is bilingual either way, so this
                is purely about transcription accuracy. */}
            <div className="flex items-center justify-between gap-3 mb-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
              <div className="text-[11px] text-ink-muted leading-tight">
                <div className="font-semibold text-ink">{t('voice.asr_lang_label')}</div>
                <div>{t('voice.asr_lang_help')}</div>
              </div>
              <div className="inline-flex rounded-full bg-white border border-slate-200 p-0.5 shrink-0">
                <button type="button"
                  onClick={() => setAsrLang('en')}
                  disabled={listening}
                  className={cn(
                    'h-7 px-3 rounded-full text-xs font-bold transition',
                    asrLang === 'en' ? 'bg-coral-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}>EN</button>
                <button type="button"
                  onClick={() => setAsrLang('ar')}
                  disabled={listening}
                  className={cn(
                    'h-7 px-3 rounded-full text-xs font-bold transition',
                    asrLang === 'ar' ? 'bg-coral-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink'
                  )}>ع</button>
              </div>
            </div>

            {/* Mic state */}
            <div className="text-center py-4">
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={saving}
                className={cn(
                  'mx-auto h-20 w-20 rounded-full grid place-items-center text-white shadow-panel transition',
                  listening
                    ? 'bg-coral-500 hover:bg-coral-600 animate-pulse'
                    : 'bg-gradient-to-br from-coral-500 to-coral-600 hover:brightness-105'
                )}>
                {listening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <div className="mt-3 text-sm font-medium text-ink-strong">
                {listening ? t('voice.listening') : t('voice.tap_to_speak')}
              </div>
              <div className="text-[11px] text-ink-muted mt-0.5">
                {t('voice.bilingual_hint')}
              </div>
            </div>

            {/* Transcript */}
            {transcript && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">
                    {t('voice.heard')}
                  </div>
                  {detectedLang && (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                      detectedLang === 'ar' ? 'bg-mint-100 text-mint-700' : 'bg-brand-100 text-brand-700'
                    )}>
                      {detectedLang === 'ar' ? t('voice.detected_ar') : t('voice.detected_en')}
                    </span>
                  )}
                </div>
                <div className="text-ink-strong">{transcript}</div>
              </div>
            )}

            {/* Parsed intent confirm card */}
            {intent && !savedMsg && (
              <div className="mt-3">
                <IntentCard intent={intent} t={t} />
                {error && <p className="mt-2 text-xs text-coral-700 font-medium">{error}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={save} disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-coral-500 to-coral-600 text-white text-sm font-semibold py-3 hover:brightness-105 disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? t('voice.saving') : t('voice.save')}
                  </button>
                  <button onClick={reset} className="rounded-2xl border border-slate-200 bg-white text-sm font-semibold px-4 py-3 hover:bg-slate-50">
                    {t('voice.try_again')}
                  </button>
                </div>
              </div>
            )}

            {/* Friendly error / no-match without an intent */}
            {!intent && error && (
              <div className="mt-3 rounded-xl bg-coral-50 border border-coral-200 p-3 text-xs text-coral-900 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-coral-700" />
                <p>{error}</p>
              </div>
            )}

            {/* Saved confirmation */}
            {savedMsg && (
              <div className="mt-3 rounded-xl bg-mint-50 border border-mint-200 p-3 text-sm text-mint-900 flex items-center justify-between gap-2">
                <span className="font-medium">{savedMsg}</span>
                <button onClick={reset} className="text-xs font-semibold text-mint-700 hover:underline">
                  {t('voice.log_another')}
                </button>
              </div>
            )}

            {/* Examples — shown when nothing has been said yet. Both
                languages are shown so the user knows either works. */}
            {!transcript && !intent && (
              <div className="mt-4 space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">English</div>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                    <Example>&ldquo;Log a feeding 120 ml bottle&rdquo;</Example>
                    <Example>&ldquo;Diaper change large&rdquo;</Example>
                    <Example>&ldquo;Nap 45 minutes&rdquo;</Example>
                    <Example>&ldquo;Temperature 37.5&rdquo;</Example>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold mb-1">العربية</div>
                  <div className="grid grid-cols-1 gap-1.5 text-[11px]" dir="rtl">
                    <Example>«سجّل رضعة ١٢٠ مل زجاجة»</Example>
                    <Example>«حفاضة كبيرة»</Example>
                    <Example>«نام ٤٥ دقيقة»</Example>
                    <Example>«حرارة ٣٧.٥»</Example>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-ink-muted">{children}</div>;
}

// Render the parsed intent in a friendly card so the user can verify
// before saving.
function IntentCard({ intent, t }: { intent: Intent; t: (k: string, vars?: Record<string, string|number>) => string }) {
  switch (intent.kind) {
    case 'feeding':     return <Card icon={Milk}        tint="coral"    title={t('voice.intent.feeding')}     body={feedingBody(intent, t)} />;
    case 'stool':       return <Card icon={Droplet}     tint="mint"     title={t('voice.intent.stool')}       body={t(`voice.size.${intent.size}`)} />;
    case 'sleep':       return <Card icon={Moon}        tint="lavender" title={t('voice.intent.sleep')}       body={`${Math.floor(intent.duration_min/60)}h ${intent.duration_min%60}m`} />;
    case 'temperature': return <Card icon={Thermometer} tint="peach"    title={t('voice.intent.temperature')} body={`${intent.temperature_c.toFixed(1)} °C${intent.method ? ` · ${t(`voice.method.${intent.method}`)}` : ''}`} />;
    case 'kick':        return <Card icon={Activity}    tint="coral"    title={t('voice.intent.kick')}        body={t('voice.kick_n', { n: intent.count })} />;
    case 'note':        return <Card icon={MessageSquare} tint="brand"  title={t('voice.intent.note')}        body={intent.text} />;
  }
}

function feedingBody(i: FeedingIntent, t: (k: string) => string): string {
  const parts: string[] = [t(`voice.milk.${i.milk_type}`)];
  if (i.quantity_ml != null) parts.push(`${i.quantity_ml} ml`);
  if (i.duration_min != null) parts.push(`${i.duration_min} min`);
  return parts.join(' · ');
}

function Card({ icon: Icon, tint, title, body }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'mint'|'lavender'|'peach'|'brand';
  title: string; body: string;
}) {
  const css = {
    coral:    'bg-coral-100 text-coral-700',
    mint:     'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    peach:    'bg-peach-100 text-peach-700',
    brand:    'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 flex items-start gap-3">
      <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${css}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Will log</div>
        <div className="text-base font-bold text-ink-strong">{title}</div>
        <div className="text-sm text-ink mt-0.5">{body}</div>
      </div>
    </div>
  );
}

// ---- Persistence -----------------------------------------------------------
// Writes the parsed intent to the matching log table. Returns a friendly
// success string the UI can show ("Logged a feeding · 120 ml bottle").
async function persistIntent(intent: Intent, babyId: string, userId: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any): Promise<string> {
  const now = new Date().toISOString();
  if (intent.kind === 'feeding') {
    const i = intent as FeedingIntent;
    const { error } = await supabase.from('feedings').insert({
      baby_id: babyId, feeding_time: now, milk_type: i.milk_type,
      quantity_ml: i.quantity_ml ?? null, duration_min: i.duration_min ?? null,
      created_by: userId,
    });
    if (error) throw error;
    return `✓ Logged feeding · ${i.milk_type}${i.quantity_ml ? ` · ${i.quantity_ml} ml` : ''}${i.duration_min ? ` · ${i.duration_min} min` : ''}`;
  }
  if (intent.kind === 'stool') {
    const i = intent as StoolIntent;
    const { error } = await supabase.from('stool_logs').insert({
      baby_id: babyId, stool_time: now, quantity_category: i.size, created_by: userId,
    });
    if (error) throw error;
    return `✓ Logged diaper · ${i.size}`;
  }
  if (intent.kind === 'sleep') {
    const i = intent as SleepIntent;
    const start = new Date(Date.now() - i.duration_min * 60_000).toISOString();
    const { error } = await supabase.from('sleep_logs').insert({
      baby_id: babyId, start_at: start, end_at: now, duration_min: i.duration_min,
      location: 'crib', created_by: userId,
    });
    if (error) throw error;
    return `✓ Logged sleep · ${Math.floor(i.duration_min/60)}h ${i.duration_min%60}m`;
  }
  if (intent.kind === 'temperature') {
    const i = intent as TemperatureIntent;
    const { error } = await supabase.from('temperature_logs').insert({
      baby_id: babyId, measured_at: now, temperature_c: i.temperature_c,
      method: i.method ?? 'axillary', created_by: userId,
    });
    if (error) throw error;
    return `✓ Logged temperature · ${i.temperature_c.toFixed(1)} °C`;
  }
  if (intent.kind === 'kick') {
    const i = intent as KickIntent;
    // Kick counts go into fetal_movements as a one-minute "session".
    const { error } = await supabase.from('fetal_movements').insert({
      baby_id: babyId, counted_at: now, duration_min: 1, movements: i.count,
      created_by: userId,
    });
    if (error) throw error;
    return `✓ Logged ${i.count} kick${i.count === 1 ? '' : 's'}`;
  }
  if (intent.kind === 'note') {
    const i = intent as NoteIntent;
    // Caregiver notes — saved as a comment on the baby itself with no
    // page scope so they show up on the overview's caregiver-notes
    // section for today.
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('comments').insert({
      baby_id: babyId, target: 'babies', target_id: babyId,
      scope_date: today, body: i.text, created_by: userId,
    });
    if (error) throw error;
    return `✓ Saved note`;
  }
  throw new Error('unsupported intent');
}

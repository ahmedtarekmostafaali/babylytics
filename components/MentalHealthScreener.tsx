'use client';

// MentalHealthScreener — Wave 41. Renders EPDS or PHQ-2 questionnaire,
// captures answers, submits to submit_mental_health_screening which
// returns the computed score + severity. The result panel is the
// critical part: it frames the result as screening (not diagnosis),
// gives clear next steps based on severity, and surfaces crisis
// resources when score warrants it.
//
// Item 10 of EPDS (self-harm thoughts) any non-zero ALWAYS shows the
// crisis path regardless of total score.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Heart, AlertTriangle, Phone, Loader2, Check, ArrowRight, X } from 'lucide-react';

type Kind = 'epds' | 'phq2';

interface Question {
  q_en: string;
  q_ar: string;
  /** Each answer is { score, label_en, label_ar }. */
  options: { score: number; label_en: string; label_ar: string }[];
}

// PHQ-2 — 2 items, 0-3 each. Standard wording.
const PHQ2_OPTIONS = [
  { score: 0, label_en: 'Not at all',          label_ar: 'إطلاقاً' },
  { score: 1, label_en: 'Several days',        label_ar: 'بعض الأيام' },
  { score: 2, label_en: 'More than half the days', label_ar: 'أكثر من نصف الأيام' },
  { score: 3, label_en: 'Nearly every day',    label_ar: 'تقريباً كل يوم' },
];
const PHQ2_QUESTIONS: Question[] = [
  {
    q_en: 'Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?',
    q_ar: 'خلال الأسبوعين الماضيين، كم مرة شعرتِ بقلة الاهتمام أو المتعة في الأشياء؟',
    options: PHQ2_OPTIONS,
  },
  {
    q_en: 'Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?',
    q_ar: 'خلال الأسبوعين الماضيين، كم مرة شعرتِ بالحزن أو الإحباط أو فقدان الأمل؟',
    options: PHQ2_OPTIONS,
  },
];

// EPDS — 10 items. Score direction varies per item (some items are
// reverse-scored in the original scale). The per-item options below
// already encode the scored value, so the totals work correctly.
const EPDS_QUESTIONS: Question[] = [
  {
    q_en: 'I have been able to laugh and see the funny side of things.',
    q_ar: 'كنت قادرة على الضحك ورؤية الجانب المضحك في الأمور.',
    options: [
      { score: 0, label_en: 'As much as I always could',      label_ar: 'كما اعتدتُ تماماً' },
      { score: 1, label_en: 'Not quite as much now',          label_ar: 'ليس كما اعتدت' },
      { score: 2, label_en: 'Definitely not so much now',     label_ar: 'بالتأكيد أقل من المعتاد' },
      { score: 3, label_en: 'Not at all',                     label_ar: 'إطلاقاً' },
    ],
  },
  {
    q_en: 'I have looked forward with enjoyment to things.',
    q_ar: 'كنت أتطلع باستمتاع للأشياء.',
    options: [
      { score: 0, label_en: 'As much as I ever did',          label_ar: 'كما اعتدت' },
      { score: 1, label_en: 'Rather less than I used to',     label_ar: 'أقل قليلاً من المعتاد' },
      { score: 2, label_en: 'Definitely less than I used to', label_ar: 'بالتأكيد أقل' },
      { score: 3, label_en: 'Hardly at all',                  label_ar: 'بالكاد' },
    ],
  },
  {
    q_en: 'I have blamed myself unnecessarily when things went wrong.',
    q_ar: 'كنت ألوم نفسي بلا داع عندما تسوء الأمور.',
    options: [
      { score: 3, label_en: 'Yes, most of the time',           label_ar: 'نعم، معظم الوقت' },
      { score: 2, label_en: 'Yes, some of the time',           label_ar: 'نعم، أحياناً' },
      { score: 1, label_en: 'Not very often',                  label_ar: 'ليس كثيراً' },
      { score: 0, label_en: 'No, never',                       label_ar: 'لا، أبداً' },
    ],
  },
  {
    q_en: 'I have been anxious or worried for no good reason.',
    q_ar: 'كنت قلقة أو متوترة بدون سبب واضح.',
    options: [
      { score: 0, label_en: 'No, not at all',                  label_ar: 'لا، إطلاقاً' },
      { score: 1, label_en: 'Hardly ever',                     label_ar: 'بالكاد' },
      { score: 2, label_en: 'Yes, sometimes',                  label_ar: 'نعم، أحياناً' },
      { score: 3, label_en: 'Yes, very often',                 label_ar: 'نعم، كثيراً جداً' },
    ],
  },
  {
    q_en: 'I have felt scared or panicky for no very good reason.',
    q_ar: 'شعرت بالخوف أو الذعر بدون سبب واضح.',
    options: [
      { score: 3, label_en: 'Yes, quite a lot',                label_ar: 'نعم، كثيراً' },
      { score: 2, label_en: 'Yes, sometimes',                  label_ar: 'نعم، أحياناً' },
      { score: 1, label_en: 'No, not much',                    label_ar: 'لا، ليس كثيراً' },
      { score: 0, label_en: 'No, not at all',                  label_ar: 'لا، إطلاقاً' },
    ],
  },
  {
    q_en: 'Things have been getting on top of me.',
    q_ar: 'الأمور أصبحت أكبر مني.',
    options: [
      { score: 3, label_en: 'Yes, most of the time I haven\'t been able to cope', label_ar: 'نعم، معظم الوقت لم أستطع التحمل' },
      { score: 2, label_en: 'Yes, sometimes I haven\'t been coping',              label_ar: 'نعم، أحياناً لم أستطع التحمل' },
      { score: 1, label_en: 'No, most of the time I have coped quite well',       label_ar: 'لا، معظم الوقت كنت متحملة' },
      { score: 0, label_en: 'No, I have been coping as well as ever',             label_ar: 'لا، كنت متحملة كالمعتاد' },
    ],
  },
  {
    q_en: 'I have been so unhappy that I have had difficulty sleeping.',
    q_ar: 'كنت حزينة لدرجة أنني واجهت صعوبة في النوم.',
    options: [
      { score: 3, label_en: 'Yes, most of the time',           label_ar: 'نعم، معظم الوقت' },
      { score: 2, label_en: 'Yes, sometimes',                  label_ar: 'نعم، أحياناً' },
      { score: 1, label_en: 'Not very often',                  label_ar: 'ليس كثيراً' },
      { score: 0, label_en: 'No, not at all',                  label_ar: 'لا، إطلاقاً' },
    ],
  },
  {
    q_en: 'I have felt sad or miserable.',
    q_ar: 'شعرت بالحزن أو البؤس.',
    options: [
      { score: 3, label_en: 'Yes, most of the time',           label_ar: 'نعم، معظم الوقت' },
      { score: 2, label_en: 'Yes, quite often',                label_ar: 'نعم، كثيراً' },
      { score: 1, label_en: 'Not very often',                  label_ar: 'ليس كثيراً' },
      { score: 0, label_en: 'No, not at all',                  label_ar: 'لا، إطلاقاً' },
    ],
  },
  {
    q_en: 'I have been so unhappy that I have been crying.',
    q_ar: 'كنت حزينة لدرجة البكاء.',
    options: [
      { score: 3, label_en: 'Yes, most of the time',           label_ar: 'نعم، معظم الوقت' },
      { score: 2, label_en: 'Yes, quite often',                label_ar: 'نعم، كثيراً' },
      { score: 1, label_en: 'Only occasionally',               label_ar: 'أحياناً فقط' },
      { score: 0, label_en: 'No, never',                       label_ar: 'لا، أبداً' },
    ],
  },
  {
    q_en: 'The thought of harming myself has occurred to me.',
    q_ar: 'فكرة إيذاء نفسي خطرت ببالي.',
    options: [
      { score: 3, label_en: 'Yes, quite often',                label_ar: 'نعم، كثيراً' },
      { score: 2, label_en: 'Sometimes',                       label_ar: 'أحياناً' },
      { score: 1, label_en: 'Hardly ever',                     label_ar: 'بالكاد' },
      { score: 0, label_en: 'Never',                           label_ar: 'أبداً' },
    ],
  },
];

interface Result {
  total_score:    number;
  severity:       'low' | 'moderate' | 'high' | 'urgent';
  self_harm_flag: boolean;
}

export function MentalHealthScreener({
  babyId, kind, lang = 'en', onClose,
}: {
  babyId: string;
  kind: Kind;
  lang?: 'en' | 'ar';
  onClose?: () => void;
}) {
  const router = useRouter();
  const isAr = lang === 'ar';
  const questions = kind === 'epds' ? EPDS_QUESTIONS : PHQ2_QUESTIONS;
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [result, setResult]   = useState<Result | null>(null);

  const allAnswered = answers.every(a => a !== null);

  async function submit() {
    if (!allAnswered || busy) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('submit_mental_health_screening', {
      p_baby:    babyId,
      p_kind:    kind,
      p_answers: answers as number[],
      p_notes:   null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = (data as Result[])?.[0];
    if (row) {
      setResult(row);
      router.refresh();
    }
  }

  // ── Result panel ─────────────────────────────────────────────────────
  if (result) {
    return <ResultPanel result={result} kind={kind} lang={lang} onClose={onClose} />;
  }

  // ── Questionnaire ────────────────────────────────────────────────────
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5 space-y-5">
      <header className="flex items-center gap-3 flex-wrap">
        <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
          <Heart className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {kind === 'epds'
              ? (isAr ? 'فحص EPDS — اكتئاب ما حول الولادة' : 'EPDS check-in — perinatal depression screening')
              : (isAr ? 'فحص PHQ-2 السريع' : 'PHQ-2 quick check-in')}
          </h3>
          <p className="text-xs text-ink-muted">
            {kind === 'epds'
              ? (isAr ? '١٠ أسئلة، حوالي ٥ دقائق. عن آخر ٧ أيام.' : '10 questions, about 5 minutes. About the last 7 days.')
              : (isAr ? 'سؤالان، أقل من دقيقة. عن آخر أسبوعين.' : '2 questions, under a minute. About the last 2 weeks.')}
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100 text-ink-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="rounded-xl bg-lavender-50/60 border border-lavender-200 p-3 text-[11px] text-ink leading-relaxed">
        {isAr
          ? 'هذا فحص ذاتي — ليس تشخيصاً. النتيجة خاصة بكِ فقط (لا الشركاء ولا الرعاة الآخرون يرونها). إذا كانت النتيجة مرتفعة، سنقترح موارد للمساعدة.'
          : 'This is a self-screening — not a diagnosis. Your result is private to you (partners and other caregivers do not see it). If the score is high, we\'ll suggest support resources.'}
      </div>

      <ol className="space-y-5">
        {questions.map((q, qi) => (
          <li key={qi} className="space-y-2">
            <div className="text-sm font-semibold text-ink-strong">
              <span className="text-ink-muted me-1">{qi + 1}.</span>
              {isAr ? q.q_ar : q.q_en}
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {q.options.map(opt => {
                const active = answers[qi] === opt.score;
                return (
                  <button key={opt.score} type="button"
                    onClick={() => setAnswers(a => { const n = [...a]; n[qi] = opt.score; return n; })}
                    className={`text-start rounded-lg border p-2 text-xs transition ${
                      active
                        ? 'border-lavender-400 bg-lavender-50 text-ink-strong'
                        : 'border-slate-200 hover:bg-slate-50 text-ink'
                    }`}>
                    {isAr ? opt.label_ar : opt.label_en}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {err && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 p-2 text-xs text-coral-700">{err}</div>
      )}

      <div className="flex items-center justify-end gap-2">
        {onClose && (
          <button type="button" onClick={onClose}
            className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
        )}
        <button type="button" onClick={submit}
          disabled={!allAnswered || busy}
          className="inline-flex items-center gap-2 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white font-semibold text-sm px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {allAnswered
            ? (isAr ? 'إرسال' : 'Submit')
            : (isAr ? `أكملي الإجابات (${answers.filter(a => a !== null).length}/${questions.length})` : `Complete answers (${answers.filter(a => a !== null).length}/${questions.length})`)}
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultPanel — what the user sees after submitting. The framing is
// the most important part of this whole feature.
// ─────────────────────────────────────────────────────────────────────────────
function ResultPanel({
  result, kind, lang, onClose,
}: {
  result: Result;
  kind: Kind;
  lang?: 'en' | 'ar';
  onClose?: () => void;
}) {
  const isAr = lang === 'ar';
  const max = kind === 'epds' ? 30 : 6;

  const tint =
    result.severity === 'urgent'   ? 'border-coral-300   bg-coral-50' :
    result.severity === 'high'     ? 'border-coral-200   bg-coral-50/70' :
    result.severity === 'moderate' ? 'border-peach-200   bg-peach-50' :
                                      'border-mint-200    bg-mint-50/60';
  const headline = (() => {
    if (result.self_harm_flag) {
      return isAr
        ? 'إجابتكِ تشير إلى أفكار قد تكون خطيرة. نريد التأكد أنكِ بأمان.'
        : 'Your answer suggests thoughts that could be serious. We want to make sure you\'re safe.';
    }
    switch (result.severity) {
      case 'urgent':
      case 'high':
        return isAr
          ? 'النتيجة تشير إلى أعراض كبيرة. نوصي بمحادثة طبيبتكِ هذا الأسبوع.'
          : 'Your score suggests significant symptoms. We recommend talking to your doctor this week.';
      case 'moderate':
        return isAr
          ? 'النتيجة تشير إلى أعراض ملحوظة. تستحق المراجعة مع طبيبتكِ في زيارتكِ القادمة.'
          : 'Your score suggests notable symptoms. Worth raising with your doctor at your next visit.';
      default:
        return isAr
          ? 'النتيجة في النطاق الطبيعي. استمري في الاهتمام بنفسكِ.'
          : 'Your score is in the typical range. Keep taking care of yourself.';
    }
  })();

  const showCrisis = result.self_harm_flag || result.severity === 'urgent' || result.severity === 'high';

  return (
    <section className={`rounded-2xl border p-5 space-y-4 ${tint}`}>
      <header className="flex items-center gap-3 flex-wrap">
        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
          showCrisis ? 'bg-coral-100 text-coral-700' : 'bg-mint-100 text-mint-700'
        }`}>
          {showCrisis ? <AlertTriangle className="h-5 w-5" /> : <Check className="h-5 w-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">
            {kind === 'epds' ? 'EPDS' : 'PHQ-2'} · {isAr ? 'النتيجة' : 'Result'}
          </div>
          <h3 className="text-2xl font-bold text-ink-strong leading-tight">
            {result.total_score} / {max}
          </h3>
        </div>
      </header>

      <p className="text-sm text-ink leading-relaxed">{headline}</p>

      {showCrisis && (
        <div className="rounded-xl bg-white border border-coral-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-coral-600" />
            <h4 className="text-sm font-bold text-ink-strong">
              {isAr ? 'إذا كنتِ في خطر فوري' : 'If you\'re in immediate danger'}
            </h4>
          </div>
          <ul className="space-y-2 text-xs text-ink leading-relaxed">
            <li>
              <strong>{isAr ? 'مصر' : 'Egypt'}:</strong>{' '}
              {isAr
                ? 'الخط الساخن للصحة النفسية ٠٨٠٠-٢٠٠٠-٢٠٠ (مجاناً) أو الإسعاف ١٢٣ أو توجهي لأقرب طوارئ.'
                : 'Mental Health Hotline 0800-2000-200 (free) or Ambulance 123 or go to the nearest emergency room.'}
            </li>
            <li>
              {isAr
                ? 'تواصلي مع طبيبتكِ النسائية أو طبيب العائلة اليوم — لا تنتظري الموعد القادم.'
                : 'Contact your OB-GYN or family doctor today — don\'t wait for your next appointment.'}
            </li>
            <li>
              {isAr
                ? 'إذا كان شخص تثقين به قريباً، أخبريه الآن. لا تكوني وحدكِ.'
                : 'If someone you trust is nearby, tell them now. Don\'t be alone.'}
            </li>
          </ul>
        </div>
      )}

      <div className="rounded-xl bg-white/60 border border-slate-200 p-3 text-[11px] text-ink-muted leading-relaxed">
        {isAr
          ? 'هذا فحص ذاتي مبني على EPDS / PHQ-2 — ليس تشخيصاً. اكتئاب ما حول الولادة شائع وقابل للعلاج. الاستشارة المبكرة تُحدث فرقاً.'
          : 'This is a self-screening based on EPDS / PHQ-2 — not a diagnosis. Perinatal depression is common and treatable. Early support makes a real difference.'}
      </div>

      {onClose && (
        <div className="flex justify-end">
          <button type="button" onClick={onClose}
            className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2">
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      )}
    </section>
  );
}

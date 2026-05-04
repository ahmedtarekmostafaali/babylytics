// BabyTonightCard — Wave 39. Server component that calls
// baby_routine_predictions(p_baby) and renders the "Tonight's outlook"
// card on the baby overview. Shifts the app from logbook to co-pilot:
//
//   - When asleep: "Likely to wake around 11:42pm" (median nap duration)
//   - When awake:  "Optimal nap window: 3:15pm – 3:45pm" (age-appropriate
//                   wake window from Polly Moore / Weissbluth bands)
//   - Sleep regression flag when total sleep dropped ≥30% week-over-week
//   - Pattern alert (overtired / growth spurt) with plain-language
//     explanation when one is detected
//
// Returns nothing if there's no DOB or insufficient sleep data.

import { createClient } from '@/lib/supabase/server';
import { Moon, Sun, AlertTriangle, TrendingDown, Sparkles } from 'lucide-react';
import { fmtDateTime } from '@/lib/dates';

interface Prediction {
  status:                   'asleep' | 'awake' | 'unknown';
  last_sleep_start:         string | null;
  last_sleep_end:           string | null;
  next_wake_estimate:       string | null;
  next_nap_window_start:    string | null;
  next_nap_window_end:      string | null;
  wake_window_target_min:   number | null;
  median_nap_min:           number | null;
  regression_detected:      boolean;
  regression_severity:      'mild' | 'moderate' | 'severe' | null;
  pattern_kind:             'overtired' | 'growth_spurt' | null;
  pattern_msg_en:           string | null;
  pattern_msg_ar:           string | null;
  last_7d_total_sleep_min:  number | null;
  prior_7d_total_sleep_min: number | null;
  feeds_last_7d:            number | null;
  feeds_prior_7d:           number | null;
}

function fmtClock(iso: string | null, isAr: boolean): string {
  if (!iso) return '—';
  return fmtDateTime(iso);
}
function fmtMin(m: number | null): string {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export async function BabyTonightCard({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const supabase = createClient();
  const { data } = await supabase.rpc('baby_routine_predictions', { p_baby: babyId });
  const p = ((data ?? []) as Prediction[])[0] ?? null;
  if (!p || p.status === 'unknown') return null;

  const isAsleep = p.status === 'asleep';
  const Icon     = isAsleep ? Moon : Sun;
  const tint     = isAsleep ? 'bg-lavender-100 text-lavender-700' : 'bg-peach-100 text-peach-700';

  const headerLabel = isAsleep
    ? (isAr ? 'الطفل نائم' : 'Baby is asleep')
    : (isAr ? 'الطفل مستيقظ' : 'Baby is awake');

  const primaryLine = (() => {
    if (isAsleep && p.next_wake_estimate) {
      return isAr
        ? `استيقاظ متوقع حوالي ${fmtClock(p.next_wake_estimate, true)}`
        : `Likely to wake around ${fmtClock(p.next_wake_estimate, false)}`;
    }
    if (!isAsleep && p.next_nap_window_start && p.next_nap_window_end) {
      return isAr
        ? `أنسب وقت للقيلولة: من ${fmtClock(p.next_nap_window_start, true)} إلى ${fmtClock(p.next_nap_window_end, true)}`
        : `Optimal nap window: ${fmtClock(p.next_nap_window_start, false)} – ${fmtClock(p.next_nap_window_end, false)}`;
    }
    return isAr ? '—' : '—';
  })();

  const subLine = isAsleep && p.median_nap_min
    ? (isAr
        ? `بناءً على متوسط مدة قيلولة ${p.median_nap_min} دقيقة من آخر أسبوعين`
        : `Based on a ${p.median_nap_min}-minute median nap over the last 2 weeks`)
    : (!isAsleep && p.wake_window_target_min)
      ? (isAr
          ? `بناءً على فترة استيقاظ مناسبة لعمره: حوالي ${fmtMin(p.wake_window_target_min)}`
          : `Based on an age-appropriate wake window: about ${fmtMin(p.wake_window_target_min)}`)
      : null;

  const patternMsg = p.pattern_kind && (isAr ? p.pattern_msg_ar : p.pattern_msg_en);
  const patternIcon = p.pattern_kind === 'overtired' ? AlertTriangle : Sparkles;
  const patternLabel = p.pattern_kind === 'overtired'
    ? (isAr ? 'نمط الإجهاد الزائد' : 'Overtired pattern')
    : p.pattern_kind === 'growth_spurt'
      ? (isAr ? 'طفرة نمو محتملة' : 'Possible growth spurt')
      : null;
  const patternTint = p.pattern_kind === 'overtired'
    ? 'border-coral-300 bg-coral-50'
    : 'border-mint-300 bg-mint-50';

  return (
    <section className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5 shadow-card">
      <header className="flex items-center gap-3 mb-4 flex-wrap">
        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${tint}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'توقعات الليلة' : 'Tonight\'s outlook'}
          </div>
          <h3 className="text-sm font-bold text-ink-strong">{headerLabel}</h3>
        </div>
      </header>

      <div className="rounded-xl bg-white border border-slate-200 p-4">
        <p className="text-sm font-semibold text-ink-strong leading-relaxed">{primaryLine}</p>
        {subLine && <p className="mt-1 text-[11px] text-ink-muted">{subLine}</p>}
      </div>

      {/* Sleep regression banner */}
      {p.regression_detected && (
        <div className="mt-3 rounded-xl border border-coral-300 bg-coral-50 p-3 flex items-start gap-2">
          <span className="h-7 w-7 rounded-lg grid place-items-center shrink-0 bg-coral-100 text-coral-700">
            <TrendingDown className="h-3.5 w-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-ink-strong">
              {isAr
                ? `تراجع نوم محتمل (${p.regression_severity === 'severe' ? 'شديد' : p.regression_severity === 'moderate' ? 'متوسط' : 'بسيط'})`
                : `Possible sleep regression (${p.regression_severity})`}
            </div>
            <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">
              {isAr
                ? `إجمالي النوم انخفض من ${Math.round((p.prior_7d_total_sleep_min ?? 0)/60)} إلى ${Math.round((p.last_7d_total_sleep_min ?? 0)/60)} ساعة هذا الأسبوع. تراجعات النوم الكلاسيكية تظهر حوالي ٤ شهور و٨-١٠ شهور و١٢ شهر — تستمر عادةً ٢-٦ أسابيع.`
                : `Total sleep dropped from ${Math.round((p.prior_7d_total_sleep_min ?? 0)/60)}h to ${Math.round((p.last_7d_total_sleep_min ?? 0)/60)}h this week. Classic sleep regressions cluster around 4 months, 8-10 months, and 12 months — typically last 2-6 weeks.`}
            </p>
          </div>
        </div>
      )}

      {/* Pattern alert (overtired / growth spurt) */}
      {p.pattern_kind && patternMsg && (
        <div className={`mt-3 rounded-xl border p-3 flex items-start gap-2 ${patternTint}`}>
          <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 ${
            p.pattern_kind === 'overtired' ? 'bg-coral-100 text-coral-700' : 'bg-mint-100 text-mint-700'
          }`}>
            {(() => { const I = patternIcon; return <I className="h-3.5 w-3.5" />; })()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-ink-strong">{patternLabel}</div>
            <p className="text-[11px] text-ink leading-relaxed mt-0.5">{patternMsg}</p>
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-ink-muted leading-relaxed">
        {isAr
          ? 'توقعات بناءً على بيانات طفلك (آخر أسبوعين) وأبحاث Polly Moore و Weissbluth لفترات الاستيقاظ. ليست بديلاً عن طبيب الأطفال.'
          : 'Predictions based on your baby\'s logged data (last 2 weeks) + Polly Moore / Weissbluth wake-window research. Not a substitute for your pediatrician.'}
      </p>
    </section>
  );
}

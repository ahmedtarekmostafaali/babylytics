// PartnerPregnancyView — Wave 36C. What a partner caregiver sees on a
// pregnancy profile overview. Curated, supportive, never showing raw
// symptom logs, BP readings, ultrasound notes, or kick counts. Reads
// only the safe fields via partner_pregnancy_summary RPC (which
// bypasses the Wave 36C deny-partner RLS lockdown internally via
// SECURITY DEFINER).

import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Heart, MessageCircle, Sparkles, Baby, ArrowRight, CalendarDays } from 'lucide-react';
import { fmtDate } from '@/lib/dates';
import type { Lang } from '@/lib/i18n';

interface Summary {
  baby_name:       string;
  ga_weeks:        number | null;
  ga_days_within:  number | null;
  trimester:       number | null;
  edd:             string | null;
  days_to_edd:     number | null;
  has_appointment: boolean;
}

const TRIMESTER_LABELS: Record<number, { en: string; ar: string }> = {
  1: { en: 'first trimester',  ar: 'الثلث الأول' },
  2: { en: 'second trimester', ar: 'الثلث الثاني' },
  3: { en: 'third trimester',  ar: 'الثلث الثالث' },
};

/** Phase-appropriate "how to support" copy. Trimester-keyed. */
const SUPPORT_COPY: Record<number, { en: string; ar: string }> = {
  1: {
    en: 'Most-needed support right now: protein-rich snacks for nausea, water reminders, ' +
        'understanding when she\'s exhausted by 4pm. Avoid strong smells. The first trimester ' +
        'often feels heaviest emotionally — your patience matters more than fixing.',
    ar: 'أكثر ما تحتاجه الآن: وجبات صغيرة غنية بالبروتين للغثيان، تذكيرها بشرب الماء، ' +
        'تفهّم تعبها مع نهاية اليوم. ابتعد عن الروائح القوية. الثلث الأول ' +
        'يكون عاطفياً ثقيل — صبرك أهم من محاولة الإصلاح.',
  },
  2: {
    en: 'The "honeymoon" trimester for many — energy returns, nausea fades. Good time for ' +
        'quality time + light walks + baby-prep planning together. Watch for headaches or ' +
        'unusual swelling — those are worth raising at her next visit.',
    ar: 'ثلث «الراحة» لكثير من النساء — الطاقة تعود، والغثيان يخف. وقت جيد ' +
        'للوقت معاً + المشي الخفيف + التخطيط للطفل سوياً. انتبه للصداع أو ' +
        'التورم غير المعتاد — يستحق ذكره في زيارتها القادمة.',
  },
  3: {
    en: 'Tiredness returns + back pain + sleep gets harder. Practical help wins now: ' +
        'pack the hospital bag together, install the car seat, learn the early labour signs ' +
        '(regular contractions, water breaking, decreased fetal movement = call doctor immediately).',
    ar: 'التعب يعود + ألم الظهر + النوم يصعب. المساعدة العملية الآن أهم: ' +
        'حضّر شنطة المستشفى معاً، ركّب كرسي السيارة، تعلّم علامات الولادة المبكرة ' +
        '(تقلصات منتظمة، نزول ماء، أو قلة حركة الجنين = اتصل بالطبيبة فوراً).',
  },
};

export async function PartnerPregnancyView({
  babyId, lang,
}: {
  babyId: string;
  lang: Lang;
}) {
  const supabase = createClient();
  const isAr = lang === 'ar';

  // Curated summary — bypasses the deny-partner RLS lockdown internally.
  const { data: summaryRows } = await supabase
    .rpc('partner_pregnancy_summary', { p_baby: babyId });
  const summary = ((summaryRows ?? []) as Summary[])[0] ?? null;

  if (!summary) {
    return (
      <PageShell max="3xl">
        <PageHeader
          backHref="/dashboard"
          backLabel={isAr ? 'ملفاتي' : 'My profiles'}
          eyebrow={isAr ? 'عرض الشريك' : 'PARTNER VIEW'} eyebrowTint="lavender"
          title={isAr ? 'الحمل' : 'Pregnancy'} />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
          {isAr ? 'لا توجد بيانات حمل بعد.' : 'No pregnancy data yet.'}
        </div>
      </PageShell>
    );
  }

  const trim   = summary.trimester ?? null;
  const support = trim ? (isAr ? SUPPORT_COPY[trim].ar : SUPPORT_COPY[trim].en) : null;
  const trimLabel = trim ? (isAr ? TRIMESTER_LABELS[trim].ar : TRIMESTER_LABELS[trim].en) : null;

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref="/dashboard"
        backLabel={isAr ? 'ملفاتي' : 'My profiles'}
        eyebrow={isAr ? 'عرض الشريك' : 'PARTNER VIEW'} eyebrowTint="lavender"
        title={summary.baby_name}
        subtitle={isAr
          ? 'ملخص لطيف — بدون سجلات تفصيلية، فقط ما يساعدك تدعمها.'
          : 'A friendly summary — no detailed logs, just the context that helps you support.'}
      />

      {/* Hero card — gestational age + trimester + EDD countdown */}
      <section className="rounded-3xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-coral-50 to-peach-50 p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="h-12 w-12 rounded-2xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
            <Baby className="h-6 w-6" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-lavender-700">
              {isAr ? 'حالياً' : 'Right now'}
            </div>
            <h2 className="mt-0.5 text-2xl font-bold text-ink-strong leading-tight">
              {summary.ga_weeks != null
                ? (isAr
                    ? `أسبوع ${summary.ga_weeks} و${summary.ga_days_within ?? 0} أيام`
                    : `${summary.ga_weeks} weeks, ${summary.ga_days_within ?? 0} days`)
                : (isAr ? 'لم يُسجل عمر الحمل' : 'No gestational age yet')}
            </h2>
            {trimLabel && (
              <p className="mt-1 text-sm text-ink">
                {isAr ? `في ${trimLabel}` : `Currently in the ${trimLabel}.`}
              </p>
            )}
            {summary.edd && summary.days_to_edd != null && (
              <p className="mt-1 text-sm text-ink">
                {summary.days_to_edd > 0
                  ? (isAr
                      ? `الموعد المتوقع بعد ${summary.days_to_edd} يوم (${fmtDate(summary.edd)})`
                      : `Due date in ${summary.days_to_edd} day${summary.days_to_edd === 1 ? '' : 's'} (${fmtDate(summary.edd)})`)
                  : summary.days_to_edd === 0
                    ? (isAr ? 'الموعد المتوقع اليوم!' : 'Due date is today!')
                    : (isAr
                        ? `متأخرة ${-summary.days_to_edd} يوم عن الموعد`
                        : `${-summary.days_to_edd} day${summary.days_to_edd === -1 ? '' : 's'} past due date`)}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* How to support — trimester-keyed copy */}
      {support && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-8 w-8 rounded-lg grid place-items-center bg-mint-100 text-mint-600">
              <Heart className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-ink-strong">
              {isAr ? 'كيف تدعمها هذا الأسبوع' : 'How to support this week'}
            </h3>
          </div>
          <p className="text-sm text-ink leading-relaxed">{support}</p>
        </section>
      )}

      {/* Next appointment hint (boolean only — no details) */}
      {summary.has_appointment && (
        <section className="rounded-2xl border border-coral-200 bg-coral-50/60 p-4 text-sm text-ink leading-relaxed flex items-start gap-3">
          <span className="h-9 w-9 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <strong className="text-ink-strong">
              {isAr ? 'لديها موعد قادم' : 'She has an upcoming appointment'}
            </strong>
            <p className="text-xs text-ink-muted mt-0.5">
              {isAr
                ? 'اعرض المساعدة في توصيلها أو في حضور الموعد معها.'
                : 'Offer to drive her or come along to the appointment.'}
            </p>
          </div>
        </section>
      )}

      {/* Chat CTA — partners get the same private chat as everyone else */}
      <Link href={`/babies/${babyId}/chat`}
        className="block rounded-2xl bg-gradient-to-br from-mint-500 to-mint-600 text-white shadow-card hover:shadow-panel transition p-5">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center shrink-0">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wider opacity-80">
              {isAr ? 'تواصل' : 'Stay in sync'}
            </div>
            <div className="font-bold">
              {isAr ? 'افتح الدردشة الخاصة' : 'Open private chat'}
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {isAr
                ? 'محادثة خاصة بينكما فقط.'
                : 'A direct thread between just the two of you.'}
            </p>
          </div>
          <ArrowRight className="h-5 w-5" />
        </div>
      </Link>

      <p className="text-[11px] text-ink-muted text-center px-4">
        {isAr
          ? 'عرض الشريك بحكم تصميمه — السجلات التفصيلية والتفاصيل الطبية لا تُعرض هنا. يمكنها دائماً منحك صلاحية أوسع من صفحة الرعاة.'
          : 'Partner view by design — detailed symptom logs and medical detail aren\'t shown here. She can always grant you wider access from her caregivers page.'}
      </p>
    </PageShell>
  );
}

// NutritionCard — Wave 37. Server component that calls
// nutrition_suggestions(p_baby, 3) and renders 3 stage-aware Egyptian-
// cuisine tips on the overview. Picks shift naturally because the SQL
// uses random() in the rank — every page load can show different tips.
//
// Returns nothing if the seed comes back empty (e.g. the migration
// hasn't been applied yet).

import { createClient } from '@/lib/supabase/server';
import { Apple, Sparkles, FlaskConical } from 'lucide-react';

interface Tip {
  id:              string;
  title_en:        string;
  title_ar:        string;
  body_en:         string;
  body_ar:         string;
  food_type:       'meal' | 'snack' | 'drink' | 'sweet' | 'side' | 'staple' | 'tip';
  addresses_tags:  string[];
  is_ramadan_pick: boolean;
  /** Wave 38A: non-null when this tip was up-ranked because the user's
   *  recent labs flagged a low value matching one of its addresses_tags.
   *  Format: "low iron, b12 from labs". */
  boosted_for:     string | null;
}

const FOOD_EMOJI: Record<Tip['food_type'], string> = {
  meal:   '🍽️',
  snack:  '🥜',
  drink:  '🍵',
  sweet:  '🍯',
  side:   '🥄',
  staple: '🌾',
  tip:    '💡',
};

const TAG_LABELS: Record<string, { en: string; ar: string }> = {
  iron:        { en: 'Iron',      ar: 'حديد' },
  folate:      { en: 'Folate',    ar: 'حمض فوليك' },
  calcium:     { en: 'Calcium',   ar: 'كالسيوم' },
  protein:     { en: 'Protein',   ar: 'بروتين' },
  zinc:        { en: 'Zinc',      ar: 'زنك' },
  magnesium:   { en: 'Magnesium', ar: 'مغنيسيوم' },
  fertility:   { en: 'Fertility', ar: 'خصوبة' },
  hydration:   { en: 'Hydration', ar: 'ترطيب' },
  energy:      { en: 'Energy',    ar: 'طاقة' },
  glucose:     { en: 'Blood sugar', ar: 'سكر الدم' },
  nausea:      { en: 'Nausea',    ar: 'غثيان' },
  antioxidant: { en: 'Antioxidant', ar: 'مضادات أكسدة' },
  vitamin_a:   { en: 'Vitamin A', ar: 'فيتامين أ' },
  b12:         { en: 'B12',       ar: 'فيتامين ب١٢' },
  fat:         { en: 'Healthy fats', ar: 'دهون صحية' },
  safety:      { en: 'Safety',    ar: 'أمان' },
  familiarity: { en: 'Family flavours', ar: 'نكهات عائلية' },
};

export async function NutritionCard({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const supabase = createClient();
  const { data } = await supabase.rpc('nutrition_suggestions', { p_baby: babyId, p_limit: 3 });
  const tips = (data ?? []) as Tip[];
  if (tips.length === 0) return null;

  const hasRamadanPick = tips.some(t => t.is_ramadan_pick);

  return (
    <section className="rounded-2xl border border-mint-200 bg-gradient-to-br from-mint-50 via-white to-peach-50 p-5 shadow-card">
      <header className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="h-10 w-10 rounded-xl bg-mint-100 text-mint-700 grid place-items-center shrink-0">
          <Apple className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'تغذية ذكية اليوم' : 'Smart nutrition today'}
          </h3>
          <p className="text-xs text-ink-muted">
            {isAr
              ? 'اقتراحات تناسب مرحلتك من المطبخ المصري'
              : 'Egyptian-cuisine picks tuned to your stage'}
          </p>
        </div>
        {hasRamadanPick && (
          <span className="inline-flex items-center gap-1 rounded-full bg-peach-100 text-peach-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            <Sparkles className="h-3 w-3" />
            {isAr ? 'رمضان' : 'Ramadan'}
          </span>
        )}
      </header>

      <ul className="space-y-3">
        {tips.map(t => {
          const title = isAr ? t.title_ar : t.title_en;
          const body  = isAr ? t.body_ar  : t.body_en;
          return (
            <li key={t.id}
              className="rounded-xl bg-white border border-slate-200 p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl leading-none shrink-0">{FOOD_EMOJI[t.food_type] ?? '🍽️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-ink-strong">{title}</h4>
                    {t.is_ramadan_pick && (
                      <span className="text-[9px] uppercase tracking-wider bg-peach-100 text-peach-700 rounded-full px-1.5 py-0.5 font-bold">
                        {isAr ? 'رمضان' : 'Ramadan'}
                      </span>
                    )}
                    {t.boosted_for && (
                      <span title={t.boosted_for}
                        className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider bg-coral-100 text-coral-700 rounded-full px-1.5 py-0.5 font-bold">
                        <FlaskConical className="h-2.5 w-2.5" />
                        {isAr ? 'لتحاليلك' : 'For your labs'}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted leading-relaxed">{body}</p>
                  {t.addresses_tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-1 flex-wrap">
                      {t.addresses_tags.slice(0, 4).map(tag => {
                        const lbl = TAG_LABELS[tag];
                        return (
                          <span key={tag}
                            className="text-[10px] rounded-full bg-mint-50 text-mint-700 border border-mint-200 px-1.5 py-0.5">
                            {lbl ? (isAr ? lbl.ar : lbl.en) : tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[10px] text-ink-muted leading-relaxed">
        {isAr
          ? 'الاقتراحات تتغير عند كل تحديث للصفحة. ليست بديلاً عن استشارة طبيبك أو أخصائي تغذية.'
          : 'Picks rotate on each page load. Not a substitute for your doctor or a registered dietitian.'}
      </p>
    </section>
  );
}

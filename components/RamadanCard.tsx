// RamadanCard — shown on the cycle dashboard during the holy month.
// Mirrors the religious nuance: women on their period don't fast; the
// card spells that out plainly so users get the right context without
// needing to look it up.
//
// Computed from a static 5-year date table (lib/ramadan.ts). Hidden
// outside the active Ramadan range.

import { Moon } from 'lucide-react';

export function RamadanCard({
  dayOfRamadan, lang = 'en',
}: {
  dayOfRamadan: number;
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  return (
    <section className="rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-coral-50 to-peach-50 p-5 flex items-start gap-3">
      <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
        <Moon className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'رمضان كريم' : 'Ramadan Mubarak'}
          </h3>
          <span className="inline-flex items-center rounded-full bg-lavender-100 text-lavender-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            {isAr ? `اليوم ${dayOfRamadan}` : `Day ${dayOfRamadan}`}
          </span>
        </div>
        <p className="text-xs text-ink mt-1 leading-relaxed">
          {isAr
            ? 'الاقتراحات اليومية تتضمن نصائح إفطار وسحور وترطيب طول الشهر. تذكير مهم: المرأة في دورتها الشهرية لا تصوم ولا تصلي، وتقضي الأيام الفائتة لاحقًا.'
            : "Today's ideas now include iftar/suhoor/hydration tips. Reminder: women on their period don't fast or pray during the period — make-up days (qada) come later."}
        </p>
      </div>
    </section>
  );
}

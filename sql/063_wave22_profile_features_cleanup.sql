-- 063: Wave 22 — profile rail + features picker cleanup
-- ============================================================================
-- No schema changes. Three UX fixes shipped together:
--
-- 1. /babies/[id]/edit right rail no longer shows "Next milestone" (baby
--    age progress) or "Growth Summary" (weight/height percentile) on
--    cycle or pregnancy profiles. Those KPIs read as nonsense pre-baby
--    (Age: 0 days, Next milestone: 1 month, empty sparklines).
--
-- 2. Features picker no longer lists "Doctors". The sidebar Doctors
--    entry lives in the Family category (always-on for parents); ticking
--    it in Features did nothing because that NavItem was never gated by
--    the picker. Removing it from the picker resolves the confusion.
--    The Care category's Appointments link still routes to /doctors for
--    the day-to-day workflow.
--
-- 3. "Maternal vitals" is no longer offered to cycle/planning profiles
--    — it's a prenatal-specific page (weight + BP captured during
--    prenatal visits). Pregnancy and baby stages still see it where
--    relevant.
--
-- Idempotent (no DDL).

select public.publish_app_update(
  p_title    => $t1$Profile cleanup: stage-relevant KPIs only$t1$,
  p_body     => $b1$Three small fixes from a recent profile audit. The Profile right rail now hides "Next milestone" and the Growth Summary card on cycle and pregnancy profiles — those were baby-mode KPIs that read as nonsense pre-baby (Age: 0 days, Next milestone: 1 month). The Features picker no longer lists "Doctors" since that entry always lived in the Family sidebar group regardless of the toggle — Care > Appointments still gets you there. And "Maternal vitals" is no longer offered on cycle profiles since it's a prenatal-specific page.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$تنظيف الملف الشخصي: مؤشرات تناسب كل مرحلة$ta1$,
  p_body_ar  => $ba1$ثلاثة إصلاحات صغيرة في الملف الشخصي. الشريط الجانبي الآن يخفي «المرحلة القادمة» وملخص النمو على ملفات الدورة والحمل — كانت مؤشرات خاصة بالطفل ولا معنى لها قبل الولادة (العمر: ٠ أيام، المرحلة القادمة: شهر واحد). قائمة الميزات لم تعد تعرض «الأطباء» لأن العنصر يظهر دائماً في مجموعة العائلة بالشريط الجانبي بغض النظر عن الإعداد — يمكنك الوصول إليه عبر الرعاية > المواعيد. كذلك «المؤشرات الحيوية للأم» لم تعد تظهر على ملفات الدورة لأنها صفحة خاصة بالحمل.$ba1$
);

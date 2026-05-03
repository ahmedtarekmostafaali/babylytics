-- 067: Wave 26 — stage-aware At-a-Glance on the profile rail
-- ============================================================================
-- Wave 22 hid the baby-only KPIs (Age, Next milestone, Zodiac, Growth
-- Summary) on cycle and pregnancy profiles, leaving just Blood type.
-- That was the right first step but left the rail mostly empty for
-- non-baby stages. This wave fills it in with stage-relevant facts:
--
--   - Pregnancy → Gestational age, Trimester, Estimated due date with
--     "in N days" / "today" / "N days overdue" countdown. All derived
--     from the existing edd / lmp columns on babies via the lifecycle.ts
--     helpers; no new fetches.
--
--   - Cycle (planning) → Current cycle day, next-period estimate
--     ("in 8 days" + the actual date below it). Computed from the
--     latest menstrual_cycles row server-side. If no cycles are logged
--     yet, prompts to open the planner.
--
--   - Baby → unchanged (Age, Next milestone, Zodiac, Blood type).
--
-- No schema changes — purely UI work over existing columns. All math
-- stays in lib/lifecycle.ts so the same helpers also feed the
-- pregnancy dashboard.
--
-- Idempotent (no DDL).

select public.publish_app_update(
  p_title    => $t1$Profile rail: cycle + pregnancy KPIs$t1$,
  p_body     => $b1$The "At a Glance" card on the profile page now reads relevant facts for whichever stage you're in. On pregnancy profiles you'll see your gestational age (e.g. "22w 4d"), trimester, and a countdown to your due date. On cycle profiles you'll see your current cycle day and the days until your next predicted period. Baby profiles are unchanged. No new data to enter — it all reads from what's already in your profile.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$ملخص الملف الشخصي: مؤشرات الدورة والحمل$ta1$,
  p_body_ar  => $ba1$بطاقة «نظرة سريعة» في صفحة الملف الشخصي تعرض الآن مؤشرات تناسب مرحلتك. على ملفات الحمل: عمر الحمل (مثل «٢٢ أسبوع و٤ أيام»)، الثلث، وعدّاد تنازلي للموعد المتوقع. على ملفات الدورة: يوم الدورة الحالي والأيام المتبقية للدورة القادمة. ملفات الأطفال لم تتغير. لا داعي لإدخال بيانات جديدة — كل شيء يُقرأ من ملفك.$ba1$
);

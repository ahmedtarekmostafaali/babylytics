-- 085: Wave 40B — admit 'cycle_dashboard' scope into dashboard_preferences
-- ============================================================================
-- The Wave 18 dashboard_preferences table had a check constraint
-- limited to {overview, daily_report, full_report}. A later migration
-- added 'pregnancy_dashboard'. This wave adds 'cycle_dashboard' so a
-- planning-stage profile can persist its hidden-widget preferences for
-- the new Cycle tab introduced in this wave's frontend changes.
--
-- Idempotent.

begin;

alter table public.dashboard_preferences
  drop constraint if exists dashboard_preferences_scope_check;

alter table public.dashboard_preferences
  add constraint dashboard_preferences_scope_check
  check (scope in ('overview','pregnancy_dashboard','cycle_dashboard','daily_report','full_report'));

commit;

select public.publish_app_update(
  p_title    => $t1$Dashboard preferences now relevant to your profile$t1$,
  p_body     => $b1$The dashboard preferences page used to show all four tabs (Overview / Pregnancy / Daily report / Full report) regardless of which profile you were on. Now it only shows the tabs that apply to the current profile''s stage. Cycle profiles get a new Cycle tab covering the planner widgets — phase today, energy forecast, red-flag patterns, doctor-ready questions, daily ideas, smart nutrition, AI companion, Ramadan card. Pregnancy profiles see the Pregnancy tab (no change). Baby profiles see Overview only. Daily/Full report tabs apply across all stages.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$تفضيلات لوحة المعلومات الآن حسب نوع الملف$ta1$,
  p_body_ar  => $ba1$صفحة تفضيلات لوحة المعلومات كانت تعرض كل التبويبات (نظرة عامة / حمل / تقرير يومي / تقرير شامل) لكل الملفات. الآن تعرض التبويبات المناسبة للمرحلة فقط. ملفات الدورة لها تبويب «دورة» جديد يغطي عناصر المخطط — مرحلة اليوم، توقع الطاقة، الأنماط التحذيرية، أسئلة الطبيبة، الأفكار اليومية، التغذية الذكية، المساعد، بطاقة رمضان. ملفات الحمل ترى تبويب الحمل (بدون تغيير). ملفات الطفل ترى تبويب «نظرة عامة». تبويبات التقارير تظهر في كل المراحل.$ba1$
);

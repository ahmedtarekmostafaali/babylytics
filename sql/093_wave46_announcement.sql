-- 093: Wave 46 — admin enrichment release note
-- ============================================================================
-- Pure announcement migration. The actual work is in sql/092 + the
-- admin/page.tsx + new admin/users/[userId]/page.tsx.

select public.publish_app_update(
  p_title    => $t1$Admin: funnel, AI breakdown, retention, geography, user detail$t1$,
  p_body     => $b1$The admin overview grew four new sections. (1) Adoption funnel: sign-ups → created profile → logged anything → invited a caregiver → called the AI, with conversion percentages on each step. (2) AI companion usage: today / 7d / 30d totals, a 30-day sparkline, and bar splits by mode (explain vs draft) and stage (cycle/pregnancy/baby). (3) Retention: rough D1 / D7 / D30 percentages computed from sign-up date vs last_seen_at on the cohort that signed up >30 days ago. (4) Geographic breakdown: user count by country code, top 12 with percentage bars. Plus stage-transition counts (active pregnancies, recent births) and a brand-new user detail page reachable by clicking a row in /admin/users — shows that user''s profiles, activity counts, AI usage, forum activity, mental-health screening severity buckets (counts only, never per-screening), and pumping log totals.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$الإدارة: قمع التحويل، استخدام الذكاء، الاحتفاظ، الجغرافيا، تفاصيل المستخدم$ta1$,
  p_body_ar  => $ba1$صفحة الإدارة الرئيسية أضافت أربعة أقسام. (١) قمع التبني: التسجيل → إنشاء ملف → أي تسجيل → دعوة راعي → استخدام الذكاء، مع نسبة التحويل لكل خطوة. (٢) استخدام المساعد الذكي: إجمالي اليوم / ٧ أيام / ٣٠ يوم، شارت ٣٠ يوم، وتقسيم حسب الوضع (شرح / صياغة) والمرحلة (دورة / حمل / طفل). (٣) الاحتفاظ: نسب D1 / D7 / D30 تقريبية مبنية على تاريخ التسجيل مقابل last_seen_at. (٤) التوزيع الجغرافي: عدد المستخدمين حسب الدولة. بالإضافة لعدد التحولات بين المراحل (حمل نشط، ولادات حديثة) وصفحة تفاصيل مستخدم جديدة تُفتح بالضغط على صف في /admin/users — تعرض ملفاته، نشاطه، استخدام الذكاء، نشاط المنتدى، فحوصات الصحة النفسية بالمستوى فقط (لا تفاصيل أبداً)، وعدد جلسات الشفط.$ba1$
);

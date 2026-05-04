-- 088: Wave 42 — QA + admin KPIs + user guide + homepage refresh + plan teaser
-- ============================================================================
-- Pure announcement migration. Wave 42 covered:
--   A. Codebase QA sweep (cross-checked Waves 33-41 for bugs)
--   B. Admin overview KPIs extended (forum, AI, mental health, pumping
--      counts) + last-login fix (bump_user_activity now fired from the
--      root layout, so users who never visit /dashboard still get
--      correctly tracked)
--   C. New /guide page — printable comprehensive feature documentation
--   D. Homepage features grid + AI co-pilot + Mental Health categories
--   E. New "Plan" section on the homepage (Free vs future Smart
--      subscription) + bigger Register CTA

select public.publish_app_update(
  p_title    => $t1$Wave 42: docs, admin polish, plan teaser$t1$,
  p_body     => $b1$Five small things together. (1) Codebase QA sweep — caught and confirmed clean across the recent waves. (2) Admin KPIs page now surfaces forum activity, AI usage, mental health screening counts, pumping log counts, and "active today" / "sessions started today" from the now-fixed last-login tracking (the bump RPC was only firing on /dashboard before — moved to the root layout so it triggers on every page). (3) New /guide page — comprehensive bilingual reference of every feature by stage, with a "Save as PDF" button that opens the print dialog with print-only styles. (4) Homepage features grid grew two new categories: "AI co-pilot" (risk detection, Claude companion, baby sleep predictions) and "Mental health & well-being" (EPDS, PHQ-2, crisis path, privacy framing). (5) New Plan section explains the model: everything Free during the beta, AI features will move to subscription at full launch, with a clear list of what stays free vs what becomes paid.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$الموجة ٤٢: التوثيق، تحسينات الإدارة، شرح الخطة$ta1$,
  p_body_ar  => $ba1$خمسة أشياء صغيرة معاً. (١) فحص شامل للكود — لا أخطاء حرجة في الموجات الأخيرة. (٢) صفحة KPI للإدارة الآن تعرض نشاط المنتدى، استخدام الذكاء الاصطناعي، عدد فحوصات الصحة النفسية، سجلات الشفط، و«نشط اليوم» / «جلسات بدأت اليوم» بعد إصلاح تتبع آخر دخول (دالة الزيادة كانت تشتغل من /dashboard فقط — انتقلت لـ root layout لتشتغل من كل صفحة). (٣) صفحة /guide جديدة — مرجع شامل بالعربي والإنجليزي لكل الميزات حسب المرحلة، مع زر «حفظ PDF» يفتح حوار الطباعة بأسلوب مخصص. (٤) شبكة ميزات الصفحة الرئيسية فيها فئتان جديدتان: «مساعد ذكي» (كشف المخاطر، مساعد Claude، توقعات نوم الطفل) و«الصحة النفسية والعافية» (EPDS، PHQ-2، مسار الأزمات، إطار الخصوصية). (٥) قسم خطة جديد يشرح النموذج: كل شيء مجاناً خلال البيتا، ميزات الذكاء ستصبح اشتراكاً عند الإطلاق الكامل، مع قائمة واضحة لما يبقى مجاناً وما يصبح مدفوعاً.$ba1$
);

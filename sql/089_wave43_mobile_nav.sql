-- 089: Wave 43 — mobile navigation overhaul
-- ============================================================================
-- Purely UI work — no schema changes. This migration just publishes
-- the user-facing release note.
--
-- Mobile users were one tap away from the hamburger drawer and two
-- taps away from any primary destination. Wave 43 adds an always-
-- visible bottom navigation bar with five primary destinations
-- (Profiles, Forum, centered Quick Log, Updates, Account). Safe-area
-- padding handles iOS home indicator + Android nav bar correctly. The
-- old bottom-right "Log feeding" FAB on baby profiles was retired —
-- the centered Quick Log on the new bar covers that job everywhere
-- in the app, not just on baby profiles.

select public.publish_app_update(
  p_title    => $t1$Mobile bottom nav: one-tap access everywhere$t1$,
  p_body     => $b1$Mobile got a proper bottom navigation bar. Before, every primary destination required opening the hamburger drawer first — two taps to get anywhere. Now the bottom bar shows five destinations always: Profiles, Forum, a centered Quick Log button, Updates, and Account. The bar respects the iOS home indicator and Android navigation bar via safe-area insets so nothing overlaps. The old "Log feeding" floating button on baby profiles was retired since the new Quick Log button covers it across the whole app.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$شريط تنقل سفلي للجوال: ضغطة واحدة للوصول$ta1$,
  p_body_ar  => $ba1$الموبايل حصل على شريط تنقل سفلي صحيح. قبل، كل وجهة رئيسية تتطلب فتح القائمة المنسدلة أولاً — ضغطتان للوصول لأي مكان. الآن الشريط السفلي يعرض خمس وجهات دائماً: الملفات، المنتدى، زر تسجيل سريع في المنتصف، التحديثات، والحساب. الشريط يحترم مؤشر الصفحة الرئيسية في iOS وشريط التنقل في Android عبر مساحات الأمان. زر «تسجيل رضعة» العائم القديم على ملفات الأطفال أُزيل لأن زر التسجيل السريع الجديد يغطيه عبر التطبيق كله.$ba1$
);

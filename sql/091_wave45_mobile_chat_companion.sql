-- 091: Wave 45 — mobile chat access + companion error diagnostics
-- ============================================================================
-- No schema changes. Two real bugs reported on mobile:
--
--   A. Group chat was hard to reach from mobile and the chat panel
--      had a fixed h-[600px] that placed the message input below the
--      new MobileBottomNav. Wave 45A: bottom nav now shows a Chat
--      shortcut in slot 4 when you're on a baby page (replaces the
--      Updates slot only on baby URLs); chat panels switch to a
--      viewport-aware h-[calc(100dvh-220px)] on mobile so the input
--      sits above the nav with safe-area room.
--
--   B. AI companion failed silently with "Something went wrong" on
--      mobile, hiding the actual cause. Wave 45B: error handling
--      surfaces the real failure — "API key not configured", network
--      error message, HTTP status, etc. — so the path forward is
--      obvious instead of guess-the-bug.
--
-- The most common companion failure is the API key only being set in
-- Vercel for Production. If you're testing from a Preview deployment
-- (any URL like babylytics-git-XXX.vercel.app), the env var won't be
-- there and the route will 503 with companion_unavailable. The new
-- error message tells you exactly that.

select public.publish_app_update(
  p_title    => $t1$Mobile fixes: chat + companion errors$t1$,
  p_body     => $b1$Two bugs reported on mobile, both fixed. (1) Group chat: when you''re on a baby page the bottom nav now shows a Chat shortcut in slot 4, and the chat panel uses a viewport-aware height on mobile so the message input sits above the nav (was hidden behind it before). (2) AI companion: errors now surface the real cause — missing API key, expired session, access denied, network error, HTTP status — instead of a useless "something went wrong". The most common cause of "companion not working" turns out to be the ANTHROPIC_API_KEY only being set for Production in Vercel; Preview deployments need it too. The new error message points directly at that fix when it''s the cause.$b1$,
  p_category => 'bug_fix',
  p_date     => current_date,
  p_title_ar => $ta1$إصلاحات الموبايل: الدردشة والمساعد الذكي$ta1$,
  p_body_ar  => $ba1$تم إصلاح خطأين على الموبايل. (١) دردشة المجموعة: عند تواجدك على صفحة طفل، الشريط السفلي يعرض اختصار الدردشة في الخانة الرابعة، ولوحة الدردشة تستخدم ارتفاعاً متناسباً مع الشاشة بحيث يبقى مربع الإدخال أعلى الشريط (كان مخفياً تحته من قبل). (٢) المساعد الذكي: الأخطاء الآن تُظهر السبب الحقيقي — مفتاح API ناقص، جلسة منتهية، صلاحية مرفوضة، خطأ شبكة، حالة HTTP — بدلاً من «حدث خطأ» العام. أكثر سبب شائع لـ«المساعد لا يعمل» هو ضبط ANTHROPIC_API_KEY على Production فقط في Vercel؛ نشرات Preview تحتاجه أيضاً.$ba1$
);

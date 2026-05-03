-- 066: Wave 25 — polish + dark-mode pass across recent waves
-- ============================================================================
-- No schema changes. This wave catches the dark-mode contrast gaps that
-- the new forum reactions, Apple Health importer, partner cycle view,
-- and ForumUnreadBanner introduced — all the components that landed
-- between Waves 19 and 24 used pastel borders (border-coral-200,
-- border-mint-200, border-lavender-200, etc.) and `border-slate-300`
-- that weren't yet mapped in the dark-mode CSS overrides. They were
-- rendering with light-mode pastel hex on the dark canvas, looking
-- like neon outlines.
--
-- The fix is in app/globals.css — desaturated dark-mode mappings for
-- the full pastel-100/200/300 border family across all five brand
-- hues, plus border-slate-300 → the same dark slate as -200, plus a
-- tuned ring-color override for the reaction chip's active state.
-- One CSS block covers every component without touching .tsx files.
--
-- Idempotent (no DDL).

select public.publish_app_update(
  p_title    => $t1$Polish pass: dark mode + forum + import edges$t1$,
  p_body     => $b1$A small but visible cleanup across the last few waves. The new forum reaction chips, the Apple Health import preview, the partner cycle hero card, and the unread-replies banner all had pastel borders that rendered as bright neon outlines on dark mode. Tuned every pastel border (coral / mint / lavender / peach / brand at the 100, 200, 300 stops) to a desaturated cousin so they read as soft accents against the dark canvas. The reaction chip's active ring got the same treatment. Light mode is unchanged.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$تحسينات: الوضع الليلي للمنتدى والاستيراد$ta1$,
  p_body_ar  => $ba1$تنظيف صغير لكنه مرئي عبر الموجات الأخيرة. أزرار التفاعل الجديدة في المنتدى، معاينة استيراد Apple Health، بطاقة الشريك للدورة، وشريط الردود غير المقروءة كانت كلها فيها حدود بألوان باستيل تظهر كخطوط نيون لامعة في الوضع الليلي. ضبطنا كل حدود الألوان الباستيل (مرجاني/نعناع/خزامي/خوخي/علامة تجارية بدرجات 100 و200 و300) لتصبح ألواناً أهدأ تقرأ كلمسات ناعمة على الخلفية الداكنة. الوضع الفاتح لم يتغير.$ba1$
);

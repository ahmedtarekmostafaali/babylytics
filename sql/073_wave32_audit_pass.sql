-- 073: Wave 32 — full app audit (parity, homepage, alignment)
-- ============================================================================
-- No schema changes. Three workstreams shipped:
--
--   1. Cross-stage feature parity audit — surfaced "Bulk import" in
--      every stage's records sidebar. It was an orphan feature (built
--      in Waves 27 + 28 but never linked from the sidebar). Now appears
--      under Records → Bulk import for parents on cycle, pregnancy,
--      and baby profiles.
--
--   2. Homepage features list refresh — added two new CategoryCards
--      to /app/page.tsx: "My Cycle" (covers Waves 12-23) and
--      "Community + Data" (covers Waves 19-30). Both are bilingual via
--      inline ternary so they ship without a new translation pass.
--
--   3. Layout + mobile alignment fixes — 7 high-impact issues
--      addressed: hero grid breakpoint (md instead of lg), features
--      grid (md+sm responsive), pregnancy mockup gain-bar overflow,
--      thread page reactions row stacking on mobile, /edit right-rail
--      width tightened, BulkFileUploader file-row dropdown sizing,
--      CsvBulkImporter category grid mobile fallback, sidebar mobile
--      RTL fix (ml-auto → ms-auto), landing nav gap responsive.
--
-- Idempotent (no DDL).

select public.publish_app_update(
  p_title    => $t1$Polish pass: parity, homepage, mobile fixes$t1$,
  p_body     => $b1$A small but visible cleanup across the whole app. Three changes: (1) "Bulk import" — the CSV + multi-file uploaders shipped in earlier waves — now appears in every profile's Records sidebar so it's actually discoverable. (2) Homepage features section grew two new categories: "My cycle" (cycle calendar, energy forecast, BBT, partner mode, pattern engine, Ramadan-aware suggestions) and "Community + data" (forum, reactions, search, digest, Apple Health + CSV + bulk file imports). (3) Mobile alignment: thread page reaction row no longer crushes on narrow screens, the landing-page hero + features grid use better breakpoints, the /edit right-rail collapses cleanly, and the bulk file uploader's per-file dropdown shrinks gracefully on small phones. Plus an RTL slip in the sidebar header (ml-auto → ms-auto) so the mobile close button mirrors correctly in Arabic.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$تنظيف شامل: التماثل، الصفحة الرئيسية، إصلاحات الموبايل$ta1$,
  p_body_ar  => $ba1$تنظيف صغير لكن مرئي عبر التطبيق كله. ثلاث تغييرات: (١) «استيراد جماعي» — أداة CSV + رفع الملفات المتعددة من الموجات السابقة — يظهر الآن في الشريط الجانبي تحت السجلات لكل ملف بحيث يمكن إيجاده فعلاً. (٢) قسم الميزات في الصفحة الرئيسية أصبح يحتوي على فئتين جديدتين: «دورتي» (تقويم الدورة، توقع الطاقة، BBT، وضع الشريك، محرك الأنماط، اقتراحات تحترم رمضان) و«المجتمع + البيانات» (المنتدى، التفاعلات، البحث، الملخص اليومي، استيراد Apple Health + CSV + رفع ملفات بالجملة). (٣) محاذاة الموبايل: صف التفاعلات في الموضوع لم يعد ينضغط على الشاشات الضيقة، شبكة الصفحة الرئيسية والميزات تستخدم نقاط فاصلة أفضل، الشريط الجانبي في /edit ينطوي بشكل أنظف، وقائمة نوع الملف في الرفع الجماعي تتقلص بشكل لطيف. بالإضافة إلى إصلاح RTL في رأس الشريط الجانبي (ml-auto → ms-auto) ليتطابق زر الإغلاق في العربية.$ba1$
);

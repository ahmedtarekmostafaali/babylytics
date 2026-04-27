-- 040: Arabic translations for log pages — fix English leftovers on
-- stool / feedings / sleep / temperature / measurements / medications /
-- vaccinations / teething / speaking / activities / labs / screen-time
-- list & detail pages. The user reported "all the log pages have English
-- still" while the app chrome was already in Arabic. This batch:
--
--   • Adds ~150 new keys under the trackers.* namespace covering filter
--     chips, "Today / Yesterday" group headings, "Pick X from the list"
--     placeholders, detail-panel field labels, insight banners, summary
--     cards, plan summaries, status pills, and the "Showing 500 entries /
--     Africa-Cairo TZ hint" footnotes.
--
--   • Wires every list page to call t(...) for those strings instead of
--     hardcoded English so toggling preferences.language flips the entire
--     page, not just the chrome.
--
--   • Fixes the LogTypeFilter component to accept an `allLabel` prop so
--     the "All" chip is also translatable.
--
-- Pure UI change — no schema migration needed. Run this file just to
-- publish a new in-app update so signed-in users see the change in
-- their notifications bell.

select public.publish_app_update(
  p_title    => 'Log pages now fully in Arabic',
  p_body     => 'Stool, feedings, sleep, temperature, measurements, medications, vaccinations, teething, speaking, activities, labs, and screen-time pages now translate end-to-end when you set your language to Arabic. Filter pills (All / Size / Type / Status), the "Today, 27 APR 2026" / "Yesterday" group headings, detail-panel labels (Color, Consistency, Volume, Method, Provider, Batch, etc.), insight banners, status chips (Taken / Missed / Skipped / Scheduled / Overdue / Done), and the summary cards on every right rail are now driven by the i18n shell. The English experience is unchanged.',
  p_category => 'bug_fix',
  p_date     => current_date,
  p_title_ar => 'صفحات السجلات الآن بالعربية بالكامل',
  p_body_ar  => 'صفحات البراز، الرضعات، النوم، درجة الحرارة، القياسات، الأدوية، التطعيمات، التسنين، الكلام، الأنشطة، التحاليل والشاشات أصبحت مترجمة بالكامل عند اختيار اللغة العربية. تظهر الترجمة في رقائق التصفية (الكل / الحجم / النوع / الحالة)، وعناوين المجموعات «اليوم، ٢٧ أبريل ٢٠٢٦» و«الأمس»، وأسماء الحقول في لوحة التفاصيل (اللون، القوام، الكمية، طريقة القياس، مقدم الخدمة، رقم التشغيلة، إلخ)، وشرائط الرؤى، وشارات الحالة (تم تناولها / فائتة / تم تخطّيها / مجدول / متأخر / تم)، وبطاقات الملخص على اليمين. التجربة الإنجليزية لم تتغير.'
);

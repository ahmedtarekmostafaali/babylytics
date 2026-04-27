-- 036: Bug-fix + Arabic-content batch.
--
-- Issues addressed (from QA screenshots):
--   * Notifications dropdown clipped by the pregnancy hero card's
--     overflow-hidden — fixed in NotificationsBell.tsx by rendering
--     the panel via React portal.
--   * Sidebar logo / wordmark click → goes to '/' (homepage) now,
--     not '/dashboard'.
--   * Home page (app/page.tsx) didn't translate to Arabic — fixed in
--     code by routing every string through tFor(). New i18n keys live
--     under `landing.*` in messages.{en,ar}.ts.
--   * /updates page rendered the changelog title + body in English
--     only. This migration adds optional `title_ar` + `body_ar`
--     columns to `app_updates`, extends publish_app_update() to
--     accept them, and backfills every existing entry with Arabic
--     copy so Arabic users see localised changelog from day one.
--   * Measurements "Growth trend" + "Growth so far" stayed stale
--     when the latest measurement was weight-only (or height-only) —
--     fixed in app/babies/[babyId]/measurements/page.tsx with a
--     per-field latest-non-null walk.
--
-- This migration is idempotent: re-running it on top of itself is
-- safe (alter table … if not exists, on-conflict updates).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ────────────────────────────────────────────────────────────────────────────

alter table public.app_updates
  add column if not exists title_ar text,
  add column if not exists body_ar  text;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Replace publish_app_update with a 6-arg version that accepts the
--    optional Arabic strings. We DROP the original 4-arg overload first
--    so callers using positional 3-arg syntax don't hit "is not unique"
--    (Postgres 42725) when both overloads coexist.
-- ────────────────────────────────────────────────────────────────────────────

drop function if exists public.publish_app_update(text, text, text, date);

create or replace function public.publish_app_update(
  p_title    text,
  p_body     text,
  p_category text,
  p_date     date default current_date,
  p_title_ar text default null,
  p_body_ar  text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_category not in ('bug_fix','new_feature','enhancement') then
    raise exception 'invalid category %', p_category;
  end if;

  insert into public.app_updates (title, body, category, published_at, title_ar, body_ar, created_by)
       values (p_title, p_body, p_category, p_date, p_title_ar, p_body_ar, auth.uid())
    on conflict (title, published_at) do update
       set body     = excluded.body,
           title_ar = coalesce(excluded.title_ar, public.app_updates.title_ar),
           body_ar  = coalesce(excluded.body_ar,  public.app_updates.body_ar)
     returning id into v_id;

  return v_id;
end; $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill Arabic copy for every existing changelog entry.
--    Safe to re-run — `update … where title_ar is null` keeps it idempotent.
-- ────────────────────────────────────────────────────────────────────────────

update public.app_updates set
  title_ar = 'حالة قراءة الإشعارات لكل مستخدم',
  body_ar  = 'الإشعارات العامة الآن تتذكر حالة القراءة لكل مستخدم على حدة — إغلاق إشعار من جهاز لا يخفيه عن باقي مقدمي الرعاية.'
 where title = 'Per-user notification reads' and title_ar is null;

update public.app_updates set
  title_ar = 'الشريط الجانبي يحافظ على قسم الطفل عند فتح التفضيلات',
  body_ar  = 'الانتقال إلى التفضيلات أو أي صفحة عامة لم يعد يطوي روابط متابعة الطفل — الشريط الجانبي يتذكر آخر طفل فتحته.'
 where title = 'Sidebar keeps per-baby section visible on Preferences' and title_ar is null;

update public.app_updates set
  title_ar = 'كود الـ QR لإعداد واتساب يظهر مجددًا',
  body_ar  = 'أضفنا مزود الـ QR للقائمة المسموح بها في سياسة الأمان حتى يظهر كود واتساب لمرة واحدة في صفحة التفضيلات.'
 where title = 'WhatsApp setup QR code renders again' and title_ar is null;

update public.app_updates set
  title_ar = 'واجهة ثنائية اللغة — العربية والإنجليزية',
  body_ar  = 'كل واجهة موجهة للأهل (لوحة التحكم، المتابعات، السكان الذكي، الملف الطبي، التقارير، تسجيل الدخول) تتحول للعربية عند تغيير اللغة. تدعم اتجاه النص (RTL) وتُحفظ بين الجلسات.'
 where title = 'Bilingual UI — English + Arabic' and title_ar is null;

update public.app_updates set
  title_ar = 'تبديل اللغة قبل تسجيل الدخول من الصفحة الرئيسية',
  body_ar  = 'الزوار يستطيعون التبديل بين الإنجليزية والعربية في الصفحة الرئيسية وشاشات تسجيل الدخول قبل إنشاء حساب. تفضيلك المحفوظ يسود بعد تسجيل الدخول.'
 where title = 'Pre-login language toggle on the home page' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة الجديد',
  body_ar  = 'هذه الصفحة — سجل مستمر لكل إصلاح خطأ وميزة وتحسين، مجمّعة ومؤرّخة، مع إشعار عند نزول جديد.'
 where title = 'Updates page' and title_ar is null;

update public.app_updates set
  title_ar = 'تذكيرات جرعات واتساب',
  body_ar  = 'الأدوية النشطة يمكن تفعيل تذكيرات واتساب لها قبل ١٥ دقيقة من كل جرعة، مع زر «سجّل الجرعة بعد الإعطاء».'
 where title = 'WhatsApp dose reminders' and title_ar is null;

update public.app_updates set
  title_ar = 'السكان الذكي يمتد لتحاليل المعمل والسونار',
  body_ar  = 'OCR يستخرج الآن صفوفًا منظمة من تقارير المعمل ومسوحات السونار بالإضافة إلى الرضعات والبراز والأدوية.'
 where title = 'Smart Scan extends to lab panels & ultrasounds' and title_ar is null;

update public.app_updates set
  title_ar = 'وضع الحمل',
  body_ar  = 'تابعي السونار، زيارات قبل الولادة، الركلات، علامات الأم الحيوية، والرؤى الأسبوعية. زر «تسجيل الولادة» يحوّل كل شيء لوضع الرضيع دون فقد بيانات.'
 where title = 'Pregnancy mode' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة الملف الطبي المجمع',
  body_ar  = 'سجل صحي محمول يجمع الحساسيات والحالات والإقامات بالمستشفى ونتائج المعمل والأدوية وفريق الرعاية في تصدير واحد قابل للمشاركة.'
 where title = 'Medical profile aggregate page' and title_ar is null;

update public.app_updates set
  title_ar = 'ترجمة شاملة عبر كل النماذج',
  body_ar  = 'كل النماذج (٢٠+)، كل صفحات القوائم والتفاصيل، شاشة مراجعة OCR، وتقرير القابل للطباعة الكامل تترجم بالكامل الآن.'
 where title = 'Comprehensive translations across every form' and title_ar is null;

update public.app_updates set
  title_ar = 'تخصيص لوحة التحكم لكل مستخدم',
  body_ar  = 'كل مستخدم يستطيع إخفاء بطاقات KPI أو أقسام بعينها من لوحة التحكم والتقرير الكامل بشكل مستقل عن مقدمي الرعاية الآخرين.'
 where title = 'Per-user dashboard customization' and title_ar is null;

update public.app_updates set
  title_ar = 'تصدير PDF وصورة من الموبايل',
  body_ar  = 'حفظ التقرير يعمل على آيفون وأندرويد — اختاري PDF (مقاس A4) أو PNG، مع زر مشاركة يفتح قائمة المشاركة الأصلية للنظام.'
 where title = 'Mobile PDF + image export' and title_ar is null;

-- Phase A–E backfill (the recent ones from this session).
update public.app_updates set
  title_ar = 'تتبع أعراض الحمل',
  body_ar  = 'سجلي الدوخة والغثيان والقيء والصداع والتورم والإرهاق والتقلصات وأكثر على مقياس شدة من ١ إلى ٥. الأعراض الأخيرة تظهر على لوحة الحمل.'
 where title = 'Pregnancy: maternal symptoms tracker' and title_ar is null;

update public.app_updates set
  title_ar = 'حجم الطفل اليومي خلال الحمل',
  body_ar  = 'لوحة الحمل تعرض الآن حجم طفلك تقريبًا ووزنه اليوم (بالاستيفاء بين الأسابيع) مع وزن السونار الأخير لمقارنة مدى تطابقه.'
 where title = 'Pregnancy: daily baby-size expectations' and title_ar is null;

update public.app_updates set
  title_ar = 'ما يمكن توقعه أسبوعيًا وشهريًا وكل ثلث',
  body_ar  = 'بطاقة الرؤية الأسبوعية على لوحة الحمل أصبحت تشمل ما يمكن توقعه على ثلاثة مقاييس زمنية — هذا الأسبوع، هذا الشهر، هذا الثلث — تغطي أعراض الأم وتطور الطفل والمهام.'
 where title = 'Pregnancy: what-to-expect by week, month, and trimester' and title_ar is null;

update public.app_updates set
  title_ar = 'سجل التتبع: من سجّل الإدخال ومن قام بتعديله',
  body_ar  = 'كل سجل يعرض الآن من أدخله أصلًا ومن قام بآخر تعديل (بالاسم، ليس بالبريد) مع التوقيت النسبي. مفيد عندما يشترك أكثر من مقدم رعاية في نفس الطفل.'
 where title = 'Audit trail: who logged it, who edited it' and title_ar is null;

update public.app_updates set
  title_ar = 'اختيار سريع للحساسية + دليل حساسية حليب البقر',
  body_ar  = 'نموذج الحساسية الآن به اختيارات سريعة لأكثر مسببات الحساسية شيوعًا (حليب البقر، الفول السوداني، البيض، الصويا، القمح، السمسم، الأسماك، القشريات، المكسرات، البنسلين، اللاتكس). عند تسجيل حساسية حليب البقر تظهر بطاقة إرشادية شاملة بالعربية والإنجليزية.'
 where title = 'Allergy quick-pick + cow''s milk allergy guide' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة رئيسية جديدة بعرض شامل للميزات',
  body_ar  = 'تم إعادة تصميم صفحة babylytics.org. جديد: شريط مراحل أربعة (حمل ← مولود ← رضيع ← دارج)، شبكة مصنفة للميزات، قسم أضواء على وضع الحمل بالحجم اليومي للجنين وشريط زيادة الوزن، قسم العائلة والأدوار يعرض سجل التتبع وتغذية مقدمي الرعاية، وشريط «الجديد» يربط بصفحة /updates.'
 where title = 'New home page with the full feature catalog' and title_ar is null;

update public.app_updates set
  title_ar = 'التسجيل الصوتي — تكلمي لتسجيل الرضعات والنوم والحفاضات وأكثر',
  body_ar  = 'اضغطي على أيقونة الميكروفون الجديدة بجوار الجرس على أي لوحة طفل، ثم تكلمي. أمثلة: «سجّل رضعة ١٢٠ مل زجاجة»، «حفاضة كبيرة»، «نام ٤٥ دقيقة»، «حرارة ٣٧.٥»، «ركلة». بيبيليتيكس يحلل ما سمعه ويعرض بطاقة تأكيد قبل الحفظ — لا مفاجآت. يعمل في كروم وإيدج وسفاري.'
 where title = 'Voice logging — speak to log feedings, sleep, diapers and more' and title_ar is null;

update public.app_updates set
  title_ar = 'التسجيل الصوتي أصبح ثنائي اللغة — يكتشف الإنجليزية والعربية تلقائيًا',
  body_ar  = 'لم تعد بحاجة لتغيير لغة التطبيق لتسجل صوتيًا باللغة الأخرى. بيبيليتيكس يشغّل محللين للنية بالإنجليزية والعربية على كل نص ويستخدم المطابق. نافذة الصوت بها زر EN / ع منفصل لمحرك التمييز الصوتي ويعرض شارة «EN/AR detected» على النص المسموع.'
 where title = 'Voice logging is now bilingual — auto-detects EN and AR' and title_ar is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Publish the changelog entry for THIS shipment (with Arabic).
-- ────────────────────────────────────────────────────────────────────────────

select public.publish_app_update(
  p_title    => 'Fixes + Arabic on home & changelog',
  p_body     => 'Five QA fixes shipped: (1) the notifications dropdown is no longer clipped by the pregnancy hero card; (2) clicking the Babylytics logo in the sidebar goes to the public homepage; (3) the home page now flips to Arabic when your language is set to العربية; (4) the /updates changelog now stores and shows Arabic title + body for every entry, past and future; (5) the Measurements "Growth trend" auto-refreshes when you log a weight-only or height-only update.',
  p_category => 'bug_fix',
  p_date     => current_date,
  p_title_ar => 'إصلاحات + عربية على الصفحة الرئيسية وسجل الجديد',
  p_body_ar  => 'خمسة إصلاحات: (١) قائمة الإشعارات لم تعد تُقطع بواسطة كرت لوحة الحمل؛ (٢) الضغط على شعار بيبيليتيكس في الشريط الجانبي ينقل للصفحة الرئيسية العامة؛ (٣) الصفحة الرئيسية تتحول للعربية عند ضبط اللغة على العربية؛ (٤) صفحة /updates أصبحت تحفظ وتعرض العنوان والمحتوى بالعربية لكل إدخال سابق وقادم؛ (٥) شريط نمو الوزن في صفحة القياسات يتحدث تلقائيًا عند تسجيل قياس وزن فقط أو طول فقط.'
);

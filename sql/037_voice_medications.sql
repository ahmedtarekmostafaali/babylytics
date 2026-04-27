-- 037: Medication logging by voice command. Pure UI feature — no
-- schema changes. Voice writes go through the same medication_logs
-- table as the manual form, with the same RLS + audit triggers.

select public.publish_app_update(
  p_title    => 'Log medication doses by voice',
  p_body     => 'The voice commander now understands medication doses. Say "gave 5ml of Augmentin", "took Panadol", "skipped the antibiotic", or "missed iron drops" and Babylytics fuzzy-matches against your active prescriptions, shows you the matching med (with up to 3 nearby candidates if there''s ambiguity), and only saves after you confirm. Egyptian Arabic also works — try «أعطيت ٥ مل أوجمنتين» or «تخطّيت جرعة بنادول». No auto-saves; you always pick the prescription before the dose lands in medication_logs.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'تسجيل جرعات الأدوية بالصوت',
  p_body_ar  => 'محرّك الأوامر الصوتية يفهم الآن جرعات الأدوية. قولي «أعطيت ٥ مل أوجمنتين»، «اتاخدت بنادول»، «تخطّيت أوجمنتين»، أو «نسيت دواء الكحة» وسيقوم بيبيليتيكس بمطابقة الاسم مع وصفاتك الفعّالة (يعرض حتى ٣ احتمالات قريبة عند الالتباس)، ولا يحفظ إلا بعد تأكيدك. تعمل الإنجليزية أيضًا: "gave 5ml of Augmentin" أو "skipped the antibiotic". لا حفظ تلقائي — تختارين الوصفة دائمًا قبل تسجيل الجرعة.'
);

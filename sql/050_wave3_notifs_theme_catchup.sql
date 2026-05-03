-- 050: Wave 3 — notification catchup + theme column + mark-all RPC
-- ============================================================================
-- 1. user_preferences.theme — 'system' | 'light' | 'dark'. Default 'system'
--    (follows OS preference). Picked in /preferences.
-- 2. mark_all_notifications_read() — bulk-insert notification_reads rows for
--    every currently-unread notification visible to the caller.
-- 3. Catchup publish_app_update calls for migrations 045–049 that didn't
--    fire one. Idempotent via the (title, published_at) unique index.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Theme preference
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.user_preferences
  add column if not exists theme text not null default 'system'
    check (theme in ('system','light','dark'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. mark_all_notifications_read — insert a read row for every notification
-- the caller can currently see and hasn't already marked. baby_id arg
-- narrows to a single profile if provided.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mark_all_notifications_read(p_baby uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare v_n int := 0;
begin
  if auth.uid() is null then return 0; end if;
  with target as (
    select n.id
    from public.notifications n
    where (p_baby is null or n.baby_id = p_baby)
      and (n.user_id = auth.uid() or n.user_id is null)
      and public.notification_unread_for_user(n, auth.uid())
  ),
  ins as (
    insert into public.notification_reads (notification_id, user_id, read_at)
    select t.id, auth.uid(), now() from target t
    on conflict do nothing
    returning 1
  )
  select count(*)::int into v_n from ins;
  return v_n;
end;
$$;
grant execute on function public.mark_all_notifications_read(uuid) to authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Catchup app updates — one per recent migration that didn't publish.
--    Each call is idempotent thanks to the (title, published_at) unique
--    index seeded in 029. Re-running this file is safe.
-- ─────────────────────────────────────────────────────────────────────────────
select public.publish_app_update(
  p_title    => 'Stool diaper photo + dosage units + formula autofill',
  p_body     => 'Three quality-of-life upgrades: (1) Add a diaper photo to any stool log — useful when colour or texture is hard to describe. (2) Medication dosage now uses an Amount + Unit picker (Drop, Tablet, Teaspoon 5 ml, Tablespoon 15 ml, ml, mg, Puff, Sachet, Application, Suppository, IU, Other). (3) Bottle feedings auto-fill the formula brand from your last entry — type "Similac Advance" once, every refill is one tap.',
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => 'صورة الحفاضة + وحدات الجرعات + تعبئة تلقائية لاسم الحليب',
  p_body_ar  => 'ثلاث تحسينات: (١) أضيفي صورة للحفاضة مع تسجيل البراز — مفيد عند صعوبة وصف اللون أو القوام. (٢) جرعة الدواء الآن "كمية + وحدة" (نقطة، قرص، ملعقة ٥ مل، ملعقة ١٥ مل، مل، ملج، إلخ). (٣) رضعات الزجاجة تعبّئ اسم الحليب الصناعي تلقائيًا من آخر إدخال.'
);

select public.publish_app_update(
  p_title    => 'Pharmacy caregiver role + planner unlocks meds & labs',
  p_body     => 'Two changes: (1) Invite a pharmacy as a caregiver — they only see your medication stock and dose history, nothing else. Useful for refill coordination. (2) The pre-pregnancy planner now opens medications, labs/scans, and your medical profile, so you can track folic acid, AMH bloodwork, HSG scans, etc. before conception.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'دور الصيدلية + فتح الأدوية والتحاليل في المخطط',
  p_body_ar  => 'تغييران: (١) ادعي صيدلية كمقدم رعاية — تشاهد فقط مخزون الأدوية وسجل الجرعات. (٢) مرحلة "تخطيط الحمل" أصبحت تشمل الأدوية والتحاليل والأشعة والملف الطبي.'
);

select public.publish_app_update(
  p_title    => 'Shopping list: Medication refills + one-tap add',
  p_body     => 'New "Medication refills" tab on the shopping list. From the medications page or the stock page, tap "Refill" to drop the medication into your shopping list with one tap. Pharmacy caregivers see only this tab, never the rest of your shopping plans.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'قائمة التسوق: تبويبة "إعادة صرف الأدوية" بضغطة',
  p_body_ar  => 'تبويبة جديدة "إعادة صرف الأدوية" في قائمة التسوق. من صفحة الأدوية أو المخزون، اضغطي "إعادة صرف" لإضافة الدواء بضغطة واحدة. الصيدلية ترى هذه التبويبة فقط.'
);

select public.publish_app_update(
  p_title    => 'My cycle (was Planning) + I''m pregnant transition + Doctor consultation coming soon',
  p_body     => 'The "Planning" stage is now called "My cycle" — use it before pregnancy, postpartum, or just for personal cycle tracking. New "I''m pregnant!" button transitions a cycle profile into a pregnancy without losing any history. Doctor consultation tile teased on every overview — book a verified specialist directly inside Babylytics, coming soon.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'دورتي (كان: تخطيط) + زر "أنا حامل" + استشارة طبية قريبًا',
  p_body_ar  => 'مرحلة "تخطيط" أصبحت "دورتي" — للاستخدام قبل الحمل أو بعد الولادة أو لمتابعة شخصية. زر "أنا حامل!" ينقل ملف الدورة إلى مرحلة الحمل بدون فقد أي سجلات. استشارة طبية مع متخصصين معتمدين قريبًا داخل التطبيق.'
);

select public.publish_app_update(
  p_title    => 'Per-area caregiver visibility + user feature picker',
  p_body     => 'Two privacy improvements: (1) When you invite a caregiver, you can now narrow what areas they see (Feedings, Stool, Sleep, Medications, etc.) — they get only what you tick. (2) Per-stage feature visibility lets each user hide categories they don''t need. Both edit-able later in Caregivers and Preferences.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'صلاحيات مخصصة لمقدمي الرعاية + اختيار الميزات لكل مستخدم',
  p_body_ar  => 'تحسينان للخصوصية: (١) عند دعوة مقدم رعاية، يمكنك تحديد ما يراه (الرضعات، البراز، النوم، الأدوية، إلخ). (٢) إخفاء الفئات لكل مستخدم. قابل للتعديل لاحقًا.'
);

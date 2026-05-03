-- 057: Wave 16 — partner caregiver role for cycle profiles
-- ============================================================================
-- A new caregiver role tuned for a spouse / supportive partner. They get
-- access to the profile but see a curated summary instead of raw cycle
-- logs and symptom detail by default. Granular per-area control still
-- works (set allowed_areas to widen what they see).
--
-- 1. Extend baby_users.role check to include 'partner'.
-- 2. Extend invite_caregiver's allowed-role list.
-- 3. publish_app_update.
--
-- Idempotent.

begin;

-- 1. baby_users role check — add 'partner'.
alter table public.baby_users
  drop constraint if exists baby_users_role_check;
alter table public.baby_users
  add  constraint baby_users_role_check
  check (role in (
    'owner','parent','editor','doctor','nurse','caregiver','viewer','pharmacy','partner'
  ));

-- 2. invite_caregiver — extend allowed roles. Pharmacy still has its
--    forced area scope; partner does NOT (they get the curated summary
--    via UI, not via RLS).
create or replace function public.invite_caregiver(
  p_baby uuid,
  p_email text,
  p_role text,
  p_areas text[] default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_actor uuid := auth.uid();
  v_areas text[] := p_areas;
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may invite caregivers';
  end if;
  if p_role not in ('owner','parent','doctor','nurse','caregiver','viewer','pharmacy','partner') then
    raise exception 'invalid role %', p_role;
  end if;
  if p_role = 'owner' and not public.is_baby_owner(p_baby) then
    raise exception 'only the current owner can transfer ownership';
  end if;
  if p_role = 'pharmacy' then
    v_areas := array['medications','medication_stock','shopping'];
  end if;

  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then raise exception 'no user with email %', p_email; end if;

  insert into public.baby_users(baby_id, user_id, role, invited_by, allowed_areas)
       values (p_baby, v_user, p_role, v_actor, v_areas)
  on conflict (baby_id, user_id) do update
       set role = excluded.role,
           allowed_areas = excluded.allowed_areas;
end; $$;
grant execute on function public.invite_caregiver(uuid, text, text, text[]) to authenticated;

commit;

-- 3. App update notification.
select public.publish_app_update(
  p_title    => $t1$Partner mode — curated cycle view for your spouse$t1$,
  p_body     => $b1$Invite your partner with the new "Partner" role. They see a friendly summary of your cycle — current phase, today\'s energy / focus / mood forecast, what tends to help this week, and when your next period is due — without any of the raw symptom logs. Reduces misunderstandings without oversharing. They keep regular caregiver chat access so you can talk in private.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$وضع الشريك — عرض دورة مختصر لزوجك$ta1$,
  p_body_ar  => $ba1$ادعي شريكك بالدور الجديد "شريك". يشاهد ملخصًا ودودًا لدورتك — المرحلة الحالية، توقع الطاقة/التركيز/المزاج اليوم، ما يساعدك هذا الأسبوع، وموعد الدورة القادمة — بدون السجلات التفصيلية للأعراض. يقلل سوء الفهم بدون مشاركة كل شيء. يحتفظ بصلاحية الدردشة الخاصة معك.$ba1$
);

-- 079: Wave 36C — partner mode for pregnancy profiles
-- ============================================================================
-- Lifts the Wave 16+23 cycle partner pattern to pregnancy. A partner
-- caregiver invited on a pregnancy profile gets a curated summary view
-- (gestational age, what's normal this week, how to support, when to
-- call the doctor) — never the raw symptom logs, BP readings, or
-- ultrasound notes. The RLS lockdown from Wave 23 (sensitive tables
-- blocked for partners) already covers measurements, vital_signs_logs,
-- blood_sugar_logs, sleep_logs, menstrual_cycles. This wave adds the
-- pregnancy-specific tables to that lockdown:
--
--   - fetal_movements    (kick counts)
--   - prenatal_visits    (visit notes from OB)
--   - ultrasounds        (scan summaries + biometry)
--   - pregnancy_profile  (pre-pregnancy weight, conception method)
--
-- And ships partner_pregnancy_summary(p_baby) — small SECURITY DEFINER
-- RPC returning just the safe fields the partner UI renders.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Restrictive deny-partner policies on pregnancy-specific tables.
--    Same pattern as Wave 23: AND'd on top of existing permissive
--    policies, leaves all other roles unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists deny_partner on public.fetal_movements;
create policy deny_partner on public.fetal_movements
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

drop policy if exists deny_partner on public.prenatal_visits;
create policy deny_partner on public.prenatal_visits
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

drop policy if exists deny_partner on public.ultrasounds;
create policy deny_partner on public.ultrasounds
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

drop policy if exists deny_partner on public.pregnancy_profile;
create policy deny_partner on public.pregnancy_profile
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. partner_pregnancy_summary — small curated payload.
--    Returns only what the partner view renders:
--      - gestational age + trimester
--      - estimated due date + days remaining
--      - "what's typical this week" copy hook (the trimester)
--    No symptoms, no vital readings, no scan notes, no ultrasound
--    biometry. SECURITY DEFINER to bypass the lockdown above.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.partner_pregnancy_summary(p_baby uuid)
returns table (
  baby_name        text,
  ga_weeks         numeric,
  ga_days_within   int,
  trimester        int,
  edd              date,
  days_to_edd      int,
  has_appointment  boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  record;
  v_total_days numeric;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then
    raise exception 'access denied';
  end if;

  select id, name, lmp, edd, lifecycle_stage
    into v_baby
    from public.babies where id = p_baby;
  if v_baby.lifecycle_stage <> 'pregnancy' then
    raise exception 'not_a_pregnancy_profile';
  end if;

  v_total_days := case
    when v_baby.lmp is not null then extract(epoch from (now() - v_baby.lmp::timestamptz)) / 86400.0
    when v_baby.edd is not null then 280 - extract(epoch from (v_baby.edd::timestamptz - now())) / 86400.0
    else null
  end;

  baby_name := v_baby.name;
  if v_total_days is not null then
    if v_total_days < 0 then v_total_days := 0; end if;
    if v_total_days > 315 then v_total_days := 315; end if;
    ga_weeks := floor(v_total_days / 7);
    ga_days_within := (v_total_days::int) % 7;
    trimester := case
      when v_total_days <= 91  then 1
      when v_total_days <= 195 then 2
      else 3
    end;
  end if;
  edd := v_baby.edd;
  days_to_edd := case
    when v_baby.edd is null then null
    else (v_baby.edd - current_date)
  end;
  has_appointment := exists (
    select 1 from public.prenatal_visits pv
    where pv.baby_id = p_baby
      and pv.scheduled_at > now()
      and pv.deleted_at is null
  );
  return next;
end;
$$;
grant execute on function public.partner_pregnancy_summary(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Partner mode now on pregnancy profiles$t1$,
  p_body     => $b1$The partner caregiver role (curated summary view, no raw logs) shipped on cycle profiles in Waves 16 + 23. It's now on pregnancy too. Invite your partner with the "partner" role and they see: your gestational age, your trimester, how many days to your due date, what's normal this week, and how to support — without your symptom logs, BP readings, ultrasound notes, or kick counts. Privacy enforced at the database level (per Wave 23 pattern) so even direct API access can't expose detail. The same partner caregiver works across cycle and pregnancy stages — no need to re-invite when you transition.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$وضع الشريك الآن في ملفات الحمل$ta1$,
  p_body_ar  => $ba1$دور الشريك (ملخص لطيف بدون السجلات الخام) شُحن في ملفات الدورة في موجات ١٦ و٢٣. الآن متاح في ملفات الحمل أيضاً. ادعي شريكك بدور «شريك» وسيرى: عمر الحمل، الثلث، الأيام المتبقية للموعد، ما هو طبيعي هذا الأسبوع، وكيف يدعم — بدون سجلات الأعراض، قراءات الضغط، ملاحظات السونار، أو عد الحركات. الخصوصية مفعّلة في قاعدة البيانات (نمط موجة ٢٣) — حتى الاستدعاءات المباشرة لا تكشف التفاصيل. نفس الشريك يعمل عبر مراحل الدورة والحمل — لا داعي لإعادة الدعوة عند الانتقال.$ba1$
);

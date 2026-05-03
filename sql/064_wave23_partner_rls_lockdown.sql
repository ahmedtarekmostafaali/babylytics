-- 064: Wave 23 — true RLS-level partner privacy lockdown
-- ============================================================================
-- Wave 16 introduced the 'partner' caregiver role with a curated
-- summary in PartnerCycleView. Privacy was UI-level only — the database
-- still allowed the partner to read every row via has_baby_access(). A
-- direct PostgREST call could expose raw symptom logs.
--
-- This wave moves privacy down to the DB:
--
--   1. New helper public.is_baby_partner_only(b) — returns true when the
--      caller's role on baby b is exactly 'partner'.
--
--   2. A single RESTRICTIVE policy per sensitive table that denies all
--      access to the partner role. Restrictive policies AND on top of
--      the existing permissive ones, so we don't have to know or
--      reconstruct what those existing policies look like — we just
--      layer on a "and not partner" filter. Affected tables:
--
--        - menstrual_cycles  (period entries, flow, symptoms[], notes)
--        - measurements      (BBT especially — fertility-tracking signal)
--        - vital_signs_logs  (BP, HR, SpO2)
--        - blood_sugar_logs  (glucose)
--        - sleep_logs        (less sensitive but it's personal data)
--
--      One policy per table, "for all" — covers SELECT/INSERT/UPDATE/
--      DELETE in one go. Existing role-tier write restrictions
--      (has_baby_write, etc.) keep functioning unchanged.
--
--   3. New RPC public.partner_cycle_summary(p_baby) returns the small
--      curated payload the PartnerCycleView needs — last period start,
--      cycle length, cycle_mode — via SECURITY DEFINER so it bypasses
--      RLS. Gated to anyone with baby access (so the owner can preview
--      what their partner sees, too).
--
-- Pregnancy partner mode wasn't shipped, so this primarily targets
-- cycle-stage access. If a partner is invited on a baby/pregnancy
-- profile the same lockdown still applies — they get curated summaries
-- via RPCs only.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. is_baby_partner_only — caller's role on this baby is exactly 'partner'.
--    SECURITY DEFINER so the inner select bypasses baby_users' own RLS.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_baby_partner_only(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid() and role = 'partner'
  );
$$;
grant execute on function public.is_baby_partner_only(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Restrictive deny-partner policies. One per sensitive table.
--
--    "as restrictive" means this policy is AND'd with the existing
--    permissive policies — a row is visible / writable only when both
--    the existing policy allows AND this policy returns true. So we
--    just need to ensure this returns false for the partner role and
--    true for everyone else. The "for all" clause covers
--    SELECT/INSERT/UPDATE/DELETE in one declaration.
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a. menstrual_cycles
drop policy if exists deny_partner on public.menstrual_cycles;
create policy deny_partner on public.menstrual_cycles
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- 2b. measurements (weight + height + head + Wave 20 BBT)
drop policy if exists deny_partner on public.measurements;
create policy deny_partner on public.measurements
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- 2c. vital_signs_logs (BP, HR, SpO2)
drop policy if exists deny_partner on public.vital_signs_logs;
create policy deny_partner on public.vital_signs_logs
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- 2d. blood_sugar_logs (glucose)
drop policy if exists deny_partner on public.blood_sugar_logs;
create policy deny_partner on public.blood_sugar_logs
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- 2e. sleep_logs (Apple Health import + manual logs)
drop policy if exists deny_partner on public.sleep_logs;
create policy deny_partner on public.sleep_logs
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. partner_cycle_summary — small curated payload for PartnerCycleView.
--    SECURITY DEFINER so it can read menstrual_cycles past the RLS
--    lockdown above. Returns only the fields the partner UI needs:
--    cycle_mode + the latest period start + cycle length + the implied
--    next-period date. No symptoms, no notes, no flow intensity.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.partner_cycle_summary(p_baby uuid)
returns table (
  cycle_mode          text,
  last_period_start   date,
  last_cycle_length   int,
  next_period_est     date
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then
    raise exception 'access denied';
  end if;
  return query
    with last as (
      select period_start, cycle_length
      from public.menstrual_cycles
      where baby_id = p_baby and deleted_at is null
      order by period_start desc
      limit 1
    )
    select
      (select cycle_mode from public.babies where id = p_baby) as cycle_mode,
      (select period_start from last)                          as last_period_start,
      (select cycle_length from last)                          as last_cycle_length,
      case
        when (select period_start from last) is null then null
        else (select period_start + coalesce(cycle_length, 28) from last)
      end                                                      as next_period_est;
end;
$$;
grant execute on function public.partner_cycle_summary(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Partner privacy: now enforced at the database$t1$,
  p_body     => $b1$When you invite a partner, the curated summary view was the only thing the UI surfaced — but the database still let a determined partner pull raw rows via direct API calls. That gap is now closed. The partner role can no longer read or write to menstrual_cycles, measurements, vital_signs_logs, blood_sugar_logs, or sleep_logs at all (enforced by a database-level restrictive policy that AND's on top of every existing rule). The Partner view continues to work via a new SECURITY DEFINER summary RPC that returns only the safe fields — no symptoms, no notes, no flow detail. If you want to widen what your partner sees, change their role from "partner" to a fuller caregiver role from the caregivers page.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$خصوصية الشريك: مفعّلة الآن في قاعدة البيانات$ta1$,
  p_body_ar  => $ba1$عند دعوة الشريك، كان الملخص في الواجهة فقط — قاعدة البيانات كانت لا تزال تسمح للشريك بقراءة السجلات الخام عبر استدعاءات مباشرة. تم إغلاق هذه الثغرة. دور الشريك لم يعد قادراً على قراءة أو تعديل جداول الدورة، القياسات، الضغط، السكر، أو النوم مباشرة (تطبيق على مستوى قاعدة البيانات). عرض الشريك يستمر بالعمل عبر دالة ملخص آمنة تُرجع فقط الحقول العامة — بدون أعراض أو ملاحظات أو تفاصيل التدفق. لتوسيع ما يراه الشريك، غيّري دوره من «شريك» إلى دور أعلى من صفحة الرعاة.$ba1$
);

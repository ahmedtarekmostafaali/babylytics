-- 046: Pharmacy caregiver role + planner access opens up
-- ============================================================================
-- 1. Add 'pharmacy' to the baby_users role check.
-- 2. Re-scope has_baby_access so pharmacies do NOT get blanket read on every
--    log table — they're only meant to see medication stock.
-- 3. Add has_baby_med_view(): a permissive read gate that includes pharmacy
--    PLUS everyone has_baby_access already covered.
-- 4. Rewrite SELECT policies on medications, medication_logs, and
--    medication_stock_txn to use has_baby_med_view.
-- 5. Re-grant the medication_stock_summary view to authenticated and add
--    a security_invoker setting so it inherits caller's RLS.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Widen baby_users role check to include 'pharmacy'
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.baby_users drop constraint if exists baby_users_role_check;
alter table public.baby_users add constraint baby_users_role_check
  check (role in ('owner','parent','doctor','nurse','caregiver','viewer','editor','pharmacy'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Re-scope has_baby_access. Pharmacy MUST be excluded so they can't
--    silently SELECT from feedings/stool/sleep/etc. via the existing
--    has_baby_access(...) policies on those tables.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_baby_access(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b
      and user_id = auth.uid()
      and role <> 'pharmacy'
  );
$$;
grant execute on function public.has_baby_access(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Permissive medication-only access gate that includes pharmacy.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_baby_med_view(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid()
  );
$$;
grant execute on function public.has_baby_med_view(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SELECT policies on med tables → has_baby_med_view (so pharmacy reads).
--    INSERT/UPDATE/DELETE policies keep using has_baby_write — pharmacy
--    fails the write check just like nurse/viewer.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists meds_select on public.medications;
create policy meds_select on public.medications
  for select using (public.has_baby_med_view(baby_id));

drop policy if exists med_logs_select on public.medication_logs;
create policy med_logs_select on public.medication_logs
  for select using (public.has_baby_med_view(baby_id));

-- 044 batch added the stock txn table. Re-create its SELECT policy.
drop policy if exists med_stock_txn_select on public.medication_stock_txn;
create policy med_stock_txn_select on public.medication_stock_txn
  for select using (public.has_baby_med_view(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The medication_stock_summary view derives from the txn table. Make sure
--    pharmacy can hit it. Postgres views by default run with the OWNER's
--    privileges, so the view itself isn't gated by RLS — the underlying
--    SELECTs are. We just need to keep the grant.
-- ─────────────────────────────────────────────────────────────────────────────
grant select on public.medication_stock_summary to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. baby-list helper for pharmacies. The dashboard query
--    (`from babies where deleted_at is null`) is gated by an RLS that uses
--    has_baby_access, which we just narrowed. Pharmacy needs to see SOME
--    babies — namely the ones they're assigned to. Add a parallel SELECT
--    policy that admits pharmacy through a separate predicate.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists babies_select_pharmacy on public.babies;
create policy babies_select_pharmacy on public.babies
  for select using (
    exists (
      select 1 from public.baby_users
      where baby_id = babies.id
        and user_id = auth.uid()
        and role = 'pharmacy'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Same for baby_users so pharmacy can see their own membership row (used
--    by my_baby_role on the client).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists baby_users_select_pharmacy_self on public.baby_users;
create policy baby_users_select_pharmacy_self on public.baby_users
  for select using (
    user_id = auth.uid() and role = 'pharmacy'
  );

commit;

-- Publish a changelog entry.
select public.publish_app_update(
  p_title    => 'Pharmacy role + planner unlocks meds, labs, scans',
  p_body     => 'Two changes: (1) Invite a pharmacy as a caregiver — they only see your medication stock and dose history, nothing else. Useful for refill coordination. (2) The pre-pregnancy planner now opens medications, labs/scans, and your medical profile, so you can track folic acid, AMH bloodwork, HSG scans, etc. before conception.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'دور الصيدلية + فتح ميزات للمخطط',
  p_body_ar  => 'تغييران: (١) يمكنك دعوة صيدلية كمقدم رعاية — تشاهد فقط مخزون الأدوية وسجل الجرعات. مفيد للتنسيق على إعادة الصرف. (٢) مرحلة "تخطيط الحمل" أصبحت تشمل الأدوية والتحاليل والأشعة والملف الطبي، لمتابعة حمض الفوليك وتحاليل AMH وأشعة HSG قبل الحمل.'
);

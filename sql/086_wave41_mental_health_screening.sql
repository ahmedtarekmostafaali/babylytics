-- 086: Wave 41 — mental health soft-screening (EPDS + PHQ-2)
-- ============================================================================
-- Postnatal depression (PND) is severely under-screened in MENA primary
-- care. Roughly 1 in 5 mothers experience clinically significant PND
-- symptoms in the first year after birth — most are never asked. This
-- wave adds a self-screening tool with strict safety framing:
--
--   * EPDS (Edinburgh Postnatal Depression Scale) — gold standard
--     10-item, 0-30 score. Threshold ≥13 = probable depression.
--     Item 10 (self-harm thoughts) ANY non-zero = urgent escalation.
--   * PHQ-2 (Patient Health Questionnaire-2) — 2-item, 0-6 score.
--     Threshold ≥3 = positive screen. Used as a lighter check for
--     cycle-stage profiles where full EPDS isn't appropriate.
--
-- This is SCREENING, not diagnosis. Every result is paired with:
--   - "discuss with your doctor" framing
--   - explicit "this isn't a diagnosis" disclaimer
--   - crisis resources when the score warrants escalation
--
-- Privacy: results are PRIVATE to the profile owner. Partner caregivers
-- are blocked at the RLS layer (Wave 23 deny-partner pattern). Even
-- regular caregivers (doctors / nurses) only see screenings if the
-- owner explicitly grants the mental-health area in their permissions
-- — by default the area is owner-only.
--
-- The schedule of when to prompt is rule-based:
--   - Pregnancy 1st trimester (≤13 weeks): one PHQ-2 baseline
--   - Pregnancy 3rd trimester (≥28 weeks): one EPDS at ~32 weeks
--   - Postpartum (baby <180 days): EPDS at 2w / 6w / 3mo / 6mo
--   - Cycle (planning): no automatic prompt — user can self-initiate
--
-- A screening "satisfies" the prompt for ~21 days (cooldown).
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. mental_health_screenings table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.mental_health_screenings (
  id            uuid primary key default gen_random_uuid(),
  baby_id       uuid not null references public.babies(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('epds','phq2')),
  -- Raw answers — array of int per question. EPDS = 10 items, PHQ-2 = 2 items.
  answers       jsonb not null,
  total_score   int not null,
  -- Self-harm-thoughts item (EPDS Q10). True when ≥1.
  self_harm_flag boolean not null default false,
  -- Severity bucket derived from kind + total_score.
  severity      text not null check (severity in ('low','moderate','high','urgent')),
  -- Optional free-text the user adds (e.g. "I've been having a hard week with the baby").
  notes         text,
  taken_at      timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists idx_mh_baby_taken
  on public.mental_health_screenings (baby_id, taken_at desc)
  where deleted_at is null;

create index if not exists idx_mh_user_taken
  on public.mental_health_screenings (user_id, taken_at desc)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — owner-only by default (caregiver/doctor/etc. access still
--    requires the user to grant the mental-health area in their per-
--    user feature picker — we don't open this up automatically).
--    Partner-deny restrictive policy from Wave 23.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.mental_health_screenings enable row level security;

drop policy if exists mh_screenings_select on public.mental_health_screenings;
create policy mh_screenings_select on public.mental_health_screenings
  for select using (user_id = auth.uid() and public.has_baby_access(baby_id));

drop policy if exists mh_screenings_insert on public.mental_health_screenings;
create policy mh_screenings_insert on public.mental_health_screenings
  for insert with check (user_id = auth.uid() and public.has_baby_access(baby_id));

drop policy if exists mh_screenings_update on public.mental_health_screenings;
create policy mh_screenings_update on public.mental_health_screenings
  for update using (user_id = auth.uid())
  with check    (user_id = auth.uid());

drop policy if exists mh_screenings_delete on public.mental_health_screenings;
create policy mh_screenings_delete on public.mental_health_screenings
  for delete using (user_id = auth.uid());

drop policy if exists deny_partner on public.mental_health_screenings;
create policy deny_partner on public.mental_health_screenings
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. submit_mental_health_screening RPC — atomic insert with score
--    + severity computation server-side so the client can't tamper.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.submit_mental_health_screening(
  p_baby     uuid,
  p_kind     text,
  p_answers  jsonb,
  p_notes    text default null
) returns table (
  id              uuid,
  total_score     int,
  severity        text,
  self_harm_flag  boolean
)
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_arr   int[];
  v_sum   int;
  v_self_harm boolean := false;
  v_severity text;
  v_id    uuid;
  v_n_expected int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;
  if p_kind not in ('epds','phq2') then raise exception 'invalid_kind'; end if;

  v_n_expected := case when p_kind = 'epds' then 10 else 2 end;

  -- Validate answers shape: jsonb array of v_n_expected ints in [0..3].
  select array_agg((value)::int order by ordinality)
    into v_arr
    from jsonb_array_elements_text(p_answers) with ordinality;
  if v_arr is null or array_length(v_arr, 1) <> v_n_expected then
    raise exception 'invalid_answers_length';
  end if;
  if exists (select 1 from unnest(v_arr) a where a < 0 or a > 3) then
    raise exception 'invalid_answer_value';
  end if;

  v_sum := (select sum(a)::int from unnest(v_arr) a);

  -- EPDS: item 10 (1-indexed) is self-harm thoughts. Any non-zero = urgent.
  if p_kind = 'epds' and v_arr[10] > 0 then
    v_self_harm := true;
  end if;

  -- Severity buckets (drawn from EPDS + PHQ-2 published cutoffs).
  v_severity := case
    when v_self_harm then 'urgent'
    when p_kind = 'epds' and v_sum >= 20 then 'urgent'
    when p_kind = 'epds' and v_sum >= 13 then 'high'
    when p_kind = 'epds' and v_sum >=  9 then 'moderate'
    when p_kind = 'phq2' and v_sum >=  5 then 'high'
    when p_kind = 'phq2' and v_sum >=  3 then 'moderate'
    else 'low'
  end;

  insert into public.mental_health_screenings
    (baby_id, user_id, kind, answers, total_score, self_harm_flag, severity, notes)
  values
    (p_baby, v_actor, p_kind, p_answers, v_sum, v_self_harm, v_severity, p_notes)
  returning mental_health_screenings.id into v_id;

  id              := v_id;
  total_score     := v_sum;
  severity        := v_severity;
  self_harm_flag  := v_self_harm;
  return next;
end;
$$;
grant execute on function public.submit_mental_health_screening(uuid, text, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. mental_health_prompt_due(p_baby) — when should we surface a prompt?
--    Returns one row per applicable prompt right now (or zero rows).
--    The frontend checks this and renders a soft "Quick check-in" card
--    on the overview when a prompt is due.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mental_health_prompt_due(p_baby uuid)
returns table (
  kind             text,    -- 'epds' | 'phq2'
  reason           text,    -- 'pregnancy_first_tri' | 'pregnancy_third_tri' | 'postpartum_2w' | etc.
  reason_label_en  text,
  reason_label_ar  text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  record;
  v_age_d int;
  v_total_days numeric;
  v_ga_weeks numeric;
  v_last_screening timestamptz;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then return; end if;

  select id, dob, lmp, edd, lifecycle_stage
    into v_baby
    from public.babies where id = p_baby;
  if v_baby.lifecycle_stage is null then return; end if;

  -- Cooldown: if user did ANY screening on this baby in the last 21 days,
  -- skip the prompt — don't nag.
  select max(taken_at) into v_last_screening
    from public.mental_health_screenings
    where baby_id = p_baby and user_id = v_actor and deleted_at is null;
  if v_last_screening is not null and v_last_screening > now() - interval '21 days' then
    return;
  end if;

  -- ── Pregnancy prompts ──────────────────────────────────────────────────
  if v_baby.lifecycle_stage = 'pregnancy' then
    v_total_days := case
      when v_baby.lmp is not null then extract(epoch from (now() - v_baby.lmp::timestamptz)) / 86400.0
      when v_baby.edd is not null then 280 - extract(epoch from (v_baby.edd::timestamptz - now())) / 86400.0
      else null
    end;
    if v_total_days is not null then
      v_ga_weeks := v_total_days / 7.0;
      if v_ga_weeks >= 6 and v_ga_weeks <= 13 then
        kind := 'phq2';
        reason := 'pregnancy_first_tri';
        reason_label_en := 'First-trimester baseline check-in';
        reason_label_ar := 'فحص أولي في الثلث الأول';
        return next;
        return;
      elsif v_ga_weeks >= 28 and v_ga_weeks <= 36 then
        kind := 'epds';
        reason := 'pregnancy_third_tri';
        reason_label_en := 'Third-trimester check-in';
        reason_label_ar := 'فحص الثلث الأخير';
        return next;
        return;
      end if;
    end if;
  end if;

  -- ── Postpartum prompts (baby <180 days) ───────────────────────────────
  if v_baby.dob is not null then
    v_age_d := extract(day from (now()::timestamp - v_baby.dob::timestamp))::int;
    if v_age_d >= 10 and v_age_d <= 21 then
      kind := 'epds';
      reason := 'postpartum_2w';
      reason_label_en := '2-week postpartum check-in';
      reason_label_ar := 'فحص بعد الولادة بأسبوعين';
      return next;
      return;
    elsif v_age_d >= 35 and v_age_d <= 56 then
      kind := 'epds';
      reason := 'postpartum_6w';
      reason_label_en := '6-week postpartum check-in';
      reason_label_ar := 'فحص بعد الولادة بـ ٦ أسابيع';
      return next;
      return;
    elsif v_age_d >= 80 and v_age_d <= 100 then
      kind := 'epds';
      reason := 'postpartum_3mo';
      reason_label_en := '3-month postpartum check-in';
      reason_label_ar := 'فحص بعد الولادة بـ ٣ أشهر';
      return next;
      return;
    elsif v_age_d >= 170 and v_age_d <= 200 then
      kind := 'epds';
      reason := 'postpartum_6mo';
      reason_label_en := '6-month postpartum check-in';
      reason_label_ar := 'فحص بعد الولادة بـ ٦ أشهر';
      return next;
      return;
    end if;
  end if;
  return;
end;
$$;
grant execute on function public.mental_health_prompt_due(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. last_mental_health_screening(p_baby) — for the timeline + "you
--    last checked in 3 weeks ago" UI.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.last_mental_health_screening(p_baby uuid)
returns table (
  id            uuid,
  kind          text,
  total_score   int,
  severity      text,
  self_harm_flag boolean,
  taken_at      timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then return; end if;
  return query
    select s.id, s.kind, s.total_score, s.severity, s.self_harm_flag, s.taken_at
      from public.mental_health_screenings s
      where s.baby_id = p_baby and s.user_id = v_actor and s.deleted_at is null
      order by s.taken_at desc
      limit 1;
end;
$$;
grant execute on function public.last_mental_health_screening(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Mental health check-in: EPDS + PHQ-2 self-screening$t1$,
  p_body     => $b1$Postnatal depression is one of the most under-screened conditions in maternal care — roughly 1 in 5 mothers experience it in the first year, and most are never asked. The new Mental Health Check-In offers self-screening at the right moments: a baseline PHQ-2 in the first trimester, a full EPDS in the third trimester, and EPDS at the standard postpartum follow-ups (2 weeks, 6 weeks, 3 months, 6 months). It''s self-screening, not diagnosis — every result includes the standard "discuss with your doctor" framing, a clear "this is not a diagnosis" disclaimer, and crisis resources when the score warrants escalation. Item 10 of EPDS (self-harm thoughts) triggers urgent crisis-line guidance regardless of total score. Results are private to you (the owner) — partners on partner-mode never see them, and other caregivers only see the area if you explicitly grant it.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$فحص الصحة النفسية: EPDS و PHQ-2$ta1$,
  p_body_ar  => $ba1$اكتئاب ما بعد الولادة من أكثر الحالات التي لا تُفحص في الرعاية الأمومية — حوالي ١ من ٥ أمهات يعانين منه في السنة الأولى، ومعظمهن لا يُسألن أبداً. فحص الصحة النفسية الجديد يقدم فحصاً ذاتياً في اللحظات المناسبة: PHQ-2 أساسي في الثلث الأول، EPDS كامل في الثلث الأخير، و EPDS في متابعات ما بعد الولادة المعتادة (٢ أسبوع، ٦ أسابيع، ٣ شهور، ٦ شهور). فحص ذاتي، ليس تشخيصاً — كل نتيجة تتضمن إطار «تحدثي مع طبيبتك»، تنبيه واضح «هذا ليس تشخيصاً»، وموارد الأزمات عند الحاجة. السؤال ١٠ من EPDS (أفكار إيذاء النفس) ينبه فوراً لخط المساعدة في الأزمات بغض النظر عن المجموع. النتائج خاصة بك — الشركاء في وضع الشريك لا يرونها أبداً، والرعاة الآخرون يرون المنطقة فقط إذا منحتِ الإذن صراحةً.$ba1$
);

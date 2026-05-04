-- 074: Wave 33A — pregnancy risk-pattern detection
-- ============================================================================
-- Rule-based detection of pregnancy red-flag patterns from existing
-- tracked data. No ML, no scoring models — explicit thresholds drawn
-- from published clinical guidelines (ACOG, ADA, NICE) so every signal
-- is defensible and traceable. The function is the source of truth;
-- the pregnancy overview renders the result as soft banners with a
-- "discuss with your doctor" CTA. This is screening, not diagnosis.
--
-- Signals detected (returned in priority order):
--
--   1. BP — preeclampsia screening (ACOG Hypertension in Pregnancy
--      guidelines): two or more readings ≥140/90 in the last 14 days
--      = elevated; any single reading ≥160/110 = severe / urgent.
--
--   2. BP trend — first-trimester baseline vs current 14-day mean: a
--      +20 mmHg systolic OR +10 mmHg diastolic rise over baseline (with
--      at least 3 baseline + 3 recent readings) = trending up.
--
--   3. Glucose — gestational diabetes screening (ADA): two or more
--      fasting readings >95 mg/dL OR two or more 1h post-meal readings
--      >140 mg/dL in the last 14 days = screening recommended.
--
--   4. Weight — sudden gain >2 kg in 7 days during 2nd or 3rd trimester
--      = preeclampsia signal (rapid fluid retention).
--
--   5. Fetal movements — after 28 weeks, any logged kick session with
--      <10 movements in ≥2 hours = follow the standard
--      "10 movements in 2 hours" rule and contact the doctor.
--
-- Each signal is returned with a stable kind code, severity band, and
-- bilingual messages ready to render. The frontend doesn't interpret
-- — it just displays.
--
-- Idempotent.

begin;

create or replace function public.pregnancy_risk_signals(p_baby uuid)
returns table (
  kind          text,    -- 'bp_elevated' | 'bp_severe' | 'bp_trending_up' |
                         -- 'glucose_fasting_high' | 'glucose_post_meal_high' |
                         -- 'weight_sudden_gain' | 'kicks_low'
  severity      text,    -- 'info' | 'warn' | 'urgent'
  message_en    text,
  message_ar    text,
  evidence      jsonb    -- e.g. {"readings": 4, "since": "2026-04-12", "max": "152/96"}
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_stage text;
  v_lmp   date;
  v_edd   date;
  v_ga_weeks numeric;

  -- BP working values
  v_bp_recent_high      int;
  v_bp_severe_max_sys   int;
  v_bp_severe_max_dia   int;
  v_bp_baseline_sys     numeric;
  v_bp_baseline_dia     numeric;
  v_bp_recent_sys       numeric;
  v_bp_recent_dia       numeric;
  v_bp_baseline_n       int;
  v_bp_recent_n         int;

  -- Glucose working values
  v_glu_fasting_high    int;
  v_glu_post_meal_high  int;

  -- Weight working values
  v_weight_recent       numeric;
  v_weight_prior        numeric;
  v_weight_jump_kg      numeric;
  v_weight_window_days  int;

  -- Kicks working values
  v_kicks_low_count     int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then
    raise exception 'access denied';
  end if;

  -- Only run on pregnancy-stage profiles. Caller should typically gate
  -- this too, but defensive.
  select lifecycle_stage, lmp, edd
    into v_stage, v_lmp, v_edd
    from public.babies where id = p_baby;
  if v_stage is null or v_stage <> 'pregnancy' then
    return;
  end if;

  -- Approximate gestational age in weeks from LMP, falling back to EDD.
  -- Used by the kicks rule (only after 28w) and weight rule (2nd+ tri).
  v_ga_weeks :=
    case
      when v_lmp is not null then extract(epoch from (now() - v_lmp::timestamptz)) / 86400.0 / 7.0
      when v_edd is not null then 40.0 - extract(epoch from (v_edd::timestamptz - now())) / 86400.0 / 7.0
      else null
    end;

  -- ─────────────────────────────────────────────────────────────────────
  -- 1 + 2. BP signals
  -- ─────────────────────────────────────────────────────────────────────
  -- 1a. Severe hypertension — any single reading ≥160 sys OR ≥110 dia
  --     in the last 14 days. ACOG threshold for "severe range".
  select count(*),
         max(bp_systolic),
         max(bp_diastolic)
    into v_bp_recent_high, v_bp_severe_max_sys, v_bp_severe_max_dia
    from public.vital_signs_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '14 days'
      and deleted_at is null
      and (bp_systolic >= 160 or bp_diastolic >= 110);
  if v_bp_recent_high > 0 then
    kind := 'bp_severe';
    severity := 'urgent';
    message_en := 'Your blood pressure has reached the severe range (' ||
                  coalesce(v_bp_severe_max_sys::text, '?') || '/' ||
                  coalesce(v_bp_severe_max_dia::text, '?') ||
                  ' mmHg). Contact your doctor today — this is the threshold for severe hypertension in pregnancy.';
    message_ar := 'ضغط الدم وصل إلى المستوى الشديد (' ||
                  coalesce(v_bp_severe_max_sys::text, '؟') || '/' ||
                  coalesce(v_bp_severe_max_dia::text, '؟') ||
                  ' mmHg). تواصلي مع طبيبك اليوم — هذا هو حد ارتفاع الضغط الشديد في الحمل.';
    evidence := jsonb_build_object(
      'readings', v_bp_recent_high,
      'since', (now() - interval '14 days')::date,
      'threshold', '≥160/110',
      'guideline', 'ACOG'
    );
    return next;
  end if;

  -- 1b. Elevated — 2 or more readings ≥140/90 in the last 14 days
  --     (and not already flagged as severe — otherwise we'd double-flag).
  select count(*) into v_bp_recent_high
    from public.vital_signs_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '14 days'
      and deleted_at is null
      and (bp_systolic >= 140 or bp_diastolic >= 90)
      and not (bp_systolic >= 160 or bp_diastolic >= 110);
  if v_bp_recent_high >= 2 then
    kind := 'bp_elevated';
    severity := 'warn';
    message_en := 'Multiple BP readings in the last 2 weeks have been at or above 140/90 mmHg (' ||
                  v_bp_recent_high::text ||
                  ' readings). Worth mentioning at your next prenatal visit — this can be an early preeclampsia signal.';
    message_ar := 'عدة قراءات للضغط في الأسبوعين الماضيين كانت ١٤٠/٩٠ أو أعلى (' ||
                  v_bp_recent_high::text ||
                  ' قراءات). يستحق ذكر ذلك في زيارتك القادمة للطبيب — يمكن أن يكون مؤشراً مبكراً لتسمم الحمل.';
    evidence := jsonb_build_object(
      'readings', v_bp_recent_high,
      'since', (now() - interval '14 days')::date,
      'threshold', '≥140/90',
      'guideline', 'ACOG'
    );
    return next;
  end if;

  -- 2. BP trend — first-trimester baseline (or earliest 3 readings) vs
  --    current 14-day mean. Need at least 3 baseline + 3 recent readings.
  select avg(bp_systolic), avg(bp_diastolic), count(*)
    into v_bp_baseline_sys, v_bp_baseline_dia, v_bp_baseline_n
    from (
      select bp_systolic, bp_diastolic
      from public.vital_signs_logs
      where baby_id = p_baby
        and bp_systolic is not null
        and deleted_at is null
        and (v_lmp is null or measured_at <= (v_lmp + interval '13 weeks'))
      order by measured_at asc
      limit 5
    ) baseline;
  select avg(bp_systolic), avg(bp_diastolic), count(*)
    into v_bp_recent_sys, v_bp_recent_dia, v_bp_recent_n
    from public.vital_signs_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '14 days'
      and bp_systolic is not null
      and deleted_at is null;
  if v_bp_baseline_n >= 3 and v_bp_recent_n >= 3
     and (
       (v_bp_recent_sys - v_bp_baseline_sys) >= 20
       or (v_bp_recent_dia - v_bp_baseline_dia) >= 10
     )
  then
    kind := 'bp_trending_up';
    severity := 'info';
    message_en := 'Your blood pressure has trended up from your earlier baseline (avg now ' ||
                  round(v_bp_recent_sys)::text || '/' || round(v_bp_recent_dia)::text ||
                  ' vs baseline ' || round(v_bp_baseline_sys)::text || '/' || round(v_bp_baseline_dia)::text ||
                  ' mmHg). Worth tracking — bring this comparison to your next visit.';
    message_ar := 'ضغط الدم في ارتفاع تدريجي مقارنة بالقراءات الأولى (المتوسط الآن ' ||
                  round(v_bp_recent_sys)::text || '/' || round(v_bp_recent_dia)::text ||
                  ' مقابل بداية ' || round(v_bp_baseline_sys)::text || '/' || round(v_bp_baseline_dia)::text ||
                  ' mmHg). يستحق المتابعة — أحضري هذه المقارنة لطبيبك في زيارتك القادمة.';
    evidence := jsonb_build_object(
      'baseline_sys', round(v_bp_baseline_sys),
      'baseline_dia', round(v_bp_baseline_dia),
      'recent_sys', round(v_bp_recent_sys),
      'recent_dia', round(v_bp_recent_dia),
      'baseline_n', v_bp_baseline_n,
      'recent_n', v_bp_recent_n
    );
    return next;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 3. Glucose signals (per ADA gestational diabetes screening cutoffs)
  -- ─────────────────────────────────────────────────────────────────────
  select count(*) into v_glu_fasting_high
    from public.blood_sugar_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '14 days'
      and meal_context = 'fasting'
      and value_mgdl > 95
      and deleted_at is null;
  if v_glu_fasting_high >= 2 then
    kind := 'glucose_fasting_high';
    severity := 'warn';
    message_en := 'Multiple fasting glucose readings in the last 2 weeks have been above 95 mg/dL (' ||
                  v_glu_fasting_high::text ||
                  ' readings). This is the ADA gestational diabetes screening threshold — ask your doctor about the OGTT test.';
    message_ar := 'عدة قراءات لسكر الصيام في الأسبوعين الماضيين كانت أعلى من ٩٥ mg/dL (' ||
                  v_glu_fasting_high::text ||
                  ' قراءات). هذا حد ADA لفحص سكري الحمل — اسألي طبيبك عن اختبار OGTT.';
    evidence := jsonb_build_object(
      'readings', v_glu_fasting_high,
      'threshold_mgdl', 95,
      'context', 'fasting',
      'guideline', 'ADA'
    );
    return next;
  end if;

  select count(*) into v_glu_post_meal_high
    from public.blood_sugar_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '14 days'
      and meal_context = 'after_meal'
      and value_mgdl > 140
      and deleted_at is null;
  if v_glu_post_meal_high >= 2 then
    kind := 'glucose_post_meal_high';
    severity := 'warn';
    message_en := 'Multiple post-meal glucose readings in the last 2 weeks have been above 140 mg/dL (' ||
                  v_glu_post_meal_high::text ||
                  ' readings). The 1-hour post-meal screening cutoff is 140 — worth raising at your next visit.';
    message_ar := 'عدة قراءات لسكر بعد الأكل في الأسبوعين الماضيين كانت أعلى من ١٤٠ mg/dL (' ||
                  v_glu_post_meal_high::text ||
                  ' قراءات). حد فحص ١٤٠ بعد الأكل بساعة — يستحق ذكر ذلك في زيارتك القادمة.';
    evidence := jsonb_build_object(
      'readings', v_glu_post_meal_high,
      'threshold_mgdl', 140,
      'context', 'after_meal',
      'guideline', 'ADA'
    );
    return next;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 4. Weight — sudden gain >2 kg in 7 days, 2nd or 3rd trimester only.
  --    Rapid weight gain in pregnancy can indicate fluid retention from
  --    early preeclampsia.
  -- ─────────────────────────────────────────────────────────────────────
  if v_ga_weeks is not null and v_ga_weeks >= 14 then
    select weight_kg
      into v_weight_recent
      from public.measurements
      where baby_id = p_baby
        and weight_kg is not null
        and deleted_at is null
      order by measured_at desc
      limit 1;
    select weight_kg, extract(day from (now() - measured_at))::int
      into v_weight_prior, v_weight_window_days
      from public.measurements
      where baby_id = p_baby
        and weight_kg is not null
        and deleted_at is null
        and measured_at <= now() - interval '5 days'
        and measured_at >= now() - interval '14 days'
      order by measured_at desc
      limit 1;
    if v_weight_recent is not null and v_weight_prior is not null then
      v_weight_jump_kg := v_weight_recent - v_weight_prior;
      if v_weight_jump_kg >= 2.0 and v_weight_window_days <= 10 then
        kind := 'weight_sudden_gain';
        severity := 'warn';
        message_en := 'Your weight has gone up by about ' ||
                      round(v_weight_jump_kg, 1)::text || ' kg in ' ||
                      v_weight_window_days::text ||
                      ' days. Sudden gain in the 2nd or 3rd trimester can be a fluid-retention signal — worth raising with your doctor.';
        message_ar := 'وزنك زاد بحوالي ' ||
                      round(v_weight_jump_kg, 1)::text || ' كجم في ' ||
                      v_weight_window_days::text ||
                      ' أيام. الزيادة المفاجئة في الثلث الثاني أو الثالث قد تكون مؤشراً لاحتباس السوائل — يستحق ذكر ذلك لطبيبك.';
        evidence := jsonb_build_object(
          'jump_kg', round(v_weight_jump_kg, 1),
          'window_days', v_weight_window_days,
          'recent_kg', v_weight_recent,
          'prior_kg', v_weight_prior,
          'ga_weeks', round(v_ga_weeks, 1)
        );
        return next;
      end if;
    end if;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- 5. Kick counts — after 28w, any session with <10 movements in ≥2hr.
  --    Standard "10 movements in 2 hours" rule.
  -- ─────────────────────────────────────────────────────────────────────
  if v_ga_weeks is not null and v_ga_weeks >= 28 then
    select count(*) into v_kicks_low_count
      from public.fetal_movements
      where baby_id = p_baby
        and counted_at >= now() - interval '7 days'
        and duration_min >= 120
        and movements < 10
        and deleted_at is null;
    if v_kicks_low_count > 0 then
      kind := 'kicks_low';
      severity := 'urgent';
      message_en := 'A recent kick count session logged fewer than 10 movements in 2+ hours (' ||
                    v_kicks_low_count::text ||
                    ' such session in the last 7 days). The standard rule is "if it ever happens, contact your doctor today" — please do.';
      message_ar := 'جلسة عد حركات حديثة سجلت أقل من ١٠ حركات في ساعتين أو أكثر (' ||
                    v_kicks_low_count::text ||
                    ' جلسة في الأسبوع الماضي). القاعدة المعتمدة "إذا حدث فاتصلي بالطبيب اليوم" — رجاءً افعلي.';
      evidence := jsonb_build_object(
        'sessions_under_10', v_kicks_low_count,
        'window_days', 7,
        'rule', '10 movements / 2 hours'
      );
      return next;
    end if;
  end if;

  return;
end;
$$;
grant execute on function public.pregnancy_risk_signals(uuid) to authenticated;

commit;

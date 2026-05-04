-- 077: Wave 35 — extend risk-pattern detection to cycle + baby
-- ============================================================================
-- Wave 33A shipped pregnancy_risk_signals(p_baby) with five rules
-- (BP severe / elevated / trending, glucose fasting / post-meal,
-- weight sudden gain, kicks low). This wave generalises to
-- ai_risk_signals(p_baby) which routes by lifecycle_stage and adds:
--
-- CYCLE (planning) signals:
--   * cycle_oligo (warn)         — 3 of last 4 cycles ≥35 days. Possible
--                                   PCOS / hormonal imbalance — worth an
--                                   OB-GYN screening conversation.
--   * cycle_severe_pain (info)   — 'severe_pain' tag in 2+ of last 3
--                                   cycles. Endometriosis / dysmenorrhea
--                                   screening hint.
--   * flow_heavy_persistent (warn) — 'heavy' flow in 3 of last 4
--                                   cycles. Menorrhagia / fibroid /
--                                   thyroid screening hint.
--
-- BABY signals:
--   * fever_under_3mo (urgent)   — ANY temperature ≥38.0°C in last 48h
--                                   while baby is under 90 days old.
--                                   AAP/NICE: in infants <3mo, fever is
--                                   ALWAYS a same-day evaluation.
--   * fever_high (urgent)        — ANY temperature ≥39.0°C in last 24h
--                                   regardless of age.
--   * fever_persistent (warn)    — ≥3 readings ≥38.0°C in last 24h
--                                   (regardless of age).
--   * vomiting_frequency (warn)  — ≥3 vomiting events in last 24h.
--                                   Dehydration risk; same-day call.
--   * vomiting_red_flag (urgent) — Any 'projectile' or 'bilious' or
--                                   'blood_streaked' vomiting in last
--                                   48h. Always escalate.
--
-- The pregnancy_risk_signals function stays unchanged — ai_risk_signals
-- delegates to it for the pregnancy branch so neither code path forks.
--
-- Returns an array of {kind, severity, message_en, message_ar, evidence}
-- with the same shape as Wave 33A, so the same banner component
-- (now generalised to AiRiskBanner) renders all three stages.
--
-- Idempotent.

begin;

create or replace function public.ai_risk_signals(p_baby uuid)
returns table (
  kind          text,
  severity      text,    -- 'info' | 'warn' | 'urgent'
  message_en    text,
  message_ar    text,
  evidence      jsonb
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_stage text;
  v_dob   date;
  v_age_days int;

  -- Cycle working values
  v_cycle_lengths int[];
  v_long_cycles   int;
  v_severe_pain_n int;
  v_heavy_n       int;
  v_total_cycles  int;

  -- Baby working values
  v_fever_under3   int;
  v_fever_high     int;
  v_fever_count    int;
  v_vomit_count    int;
  v_vomit_redflag  int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  select lifecycle_stage, dob into v_stage, v_dob
    from public.babies where id = p_baby;
  if v_stage is null then return; end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- PREGNANCY — delegate to the existing Wave 33A function so both code
  -- paths stay in sync.
  -- ─────────────────────────────────────────────────────────────────────
  if v_stage = 'pregnancy' then
    return query select * from public.pregnancy_risk_signals(p_baby);
    return;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- CYCLE (planning)
  -- ─────────────────────────────────────────────────────────────────────
  if v_stage = 'planning' then

    -- 1. Oligomenorrhea — 3 of last 4 cycles ≥35 days.
    select array_agg(cycle_length order by period_start desc), count(*)
      into v_cycle_lengths, v_total_cycles
      from (
        select period_start, cycle_length
        from public.menstrual_cycles
        where baby_id = p_baby and deleted_at is null and cycle_length is not null
        order by period_start desc
        limit 4
      ) c;
    if v_total_cycles >= 3 then
      select count(*) into v_long_cycles
        from unnest(v_cycle_lengths) as len
        where len >= 35;
      if v_long_cycles >= 3 then
        kind := 'cycle_oligo';
        severity := 'warn';
        message_en := v_long_cycles::text || ' of your last ' || v_total_cycles::text ||
                      ' cycles ran 35 days or longer. This is the threshold for ' ||
                      'oligomenorrhea — worth bringing up with your OB-GYN, especially ' ||
                      'if you''re planning a pregnancy.';
        message_ar := v_long_cycles::text || ' من آخر ' || v_total_cycles::text ||
                      ' دورات استمرت ٣٥ يوماً أو أكثر. هذا حد قلة الطمث — ' ||
                      'يستحق ذكره لطبيبة النساء، خصوصاً إذا كنتِ تخططين للحمل.';
        evidence := jsonb_build_object(
          'long_cycles', v_long_cycles,
          'total_cycles', v_total_cycles,
          'cycle_lengths', v_cycle_lengths,
          'threshold_days', 35
        );
        return next;
      end if;
    end if;

    -- 2. Persistent severe pain — 'severe_pain' symptom in 2+ of last 3 cycles.
    select count(*) into v_severe_pain_n
      from (
        select symptoms
        from public.menstrual_cycles
        where baby_id = p_baby and deleted_at is null
          and symptoms is not null
        order by period_start desc
        limit 3
      ) c
      where 'severe_pain' = any(symptoms);
    if v_severe_pain_n >= 2 then
      kind := 'cycle_severe_pain';
      severity := 'info';
      message_en := 'You''ve logged severe pain in ' || v_severe_pain_n::text ||
                    ' of your last 3 cycles. Recurring severe period pain ' ||
                    '(dysmenorrhea) is worth raising — sometimes there''s a treatable cause.';
      message_ar := 'سجلتِ ألماً شديداً في ' || v_severe_pain_n::text ||
                    ' من آخر ٣ دورات. الألم الشديد المتكرر يستحق المراجعة — ' ||
                    'أحياناً يوجد سبب يمكن علاجه.';
      evidence := jsonb_build_object(
        'severe_pain_cycles', v_severe_pain_n,
        'lookback_cycles', 3
      );
      return next;
    end if;

    -- 3. Persistent heavy flow — 'heavy' in 3 of last 4 cycles.
    select count(*) into v_heavy_n
      from (
        select flow_intensity
        from public.menstrual_cycles
        where baby_id = p_baby and deleted_at is null
          and flow_intensity is not null
        order by period_start desc
        limit 4
      ) c
      where flow_intensity = 'heavy';
    if v_heavy_n >= 3 then
      kind := 'flow_heavy_persistent';
      severity := 'warn';
      message_en := v_heavy_n::text || ' of your last 4 cycles had heavy flow. ' ||
                    'Persistent menorrhagia is worth investigating — common causes ' ||
                    'include fibroids, hormonal imbalance, or thyroid changes.';
      message_ar := v_heavy_n::text || ' من آخر ٤ دورات كانت غزيرة. ' ||
                    'غزارة الطمث المستمرة تستحق الفحص — أسبابها الشائعة تشمل ' ||
                    'الأورام الليفية، الاختلال الهرموني، أو تغيرات الغدة الدرقية.';
      evidence := jsonb_build_object(
        'heavy_cycles', v_heavy_n,
        'lookback_cycles', 4
      );
      return next;
    end if;

    return;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- BABY (newborn / infant / toddler / child)
  -- ─────────────────────────────────────────────────────────────────────
  v_age_days := case
    when v_dob is null then null
    else extract(day from (now()::timestamp - v_dob::timestamp))::int
  end;

  -- 1. Fever under 3 months — ALWAYS urgent. Any temp ≥38°C in last 48h.
  if v_age_days is not null and v_age_days < 90 then
    select count(*) into v_fever_under3
      from public.temperature_logs
      where baby_id = p_baby
        and measured_at >= now() - interval '48 hours'
        and temperature_c >= 38.0
        and deleted_at is null;
    if v_fever_under3 > 0 then
      kind := 'fever_under_3mo';
      severity := 'urgent';
      message_en := 'A temperature of 38°C or higher has been logged in the last 48 hours, ' ||
                    'and your baby is under 3 months old. In infants this young, ' ||
                    'any fever is treated as same-day evaluation by AAP and NICE — ' ||
                    'please contact your pediatrician today.';
      message_ar := 'سجلتِ حرارة ٣٨°م أو أكثر في آخر ٤٨ ساعة، وعمر الطفل ' ||
                    'أقل من ٣ أشهر. في هذا العمر، أي ارتفاع حرارة يستوجب ' ||
                    'فحصاً طبياً في نفس اليوم حسب إرشادات AAP و NICE — ' ||
                    'تواصلي مع طبيب الأطفال اليوم.';
      evidence := jsonb_build_object(
        'readings', v_fever_under3,
        'age_days', v_age_days,
        'threshold_c', 38.0,
        'guideline', 'AAP / NICE infant fever protocol'
      );
      return next;
    end if;
  end if;

  -- 2. High fever any age — ≥39°C in last 24h.
  select count(*), max(temperature_c)
    into v_fever_high, v_fever_count    -- reusing v_fever_count as max
    from public.temperature_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '24 hours'
      and temperature_c >= 39.0
      and deleted_at is null;
  if v_fever_high > 0 then
    kind := 'fever_high';
    severity := 'urgent';
    message_en := 'A high fever (≥39°C) has been logged in the last 24 hours. ' ||
                  'Worth contacting your pediatrician today — high fever often warrants ' ||
                  'a same-day check.';
    message_ar := 'سجلتِ حرارة مرتفعة (≥٣٩°م) في آخر ٢٤ ساعة. ' ||
                  'يستحق التواصل مع طبيب الأطفال اليوم — الحرارة المرتفعة عادة ' ||
                  'تحتاج فحصاً في نفس اليوم.';
    evidence := jsonb_build_object(
      'readings', v_fever_high,
      'threshold_c', 39.0
    );
    return next;
  end if;

  -- 3. Persistent fever — ≥3 readings ≥38°C in last 24h, any age.
  select count(*) into v_fever_count
    from public.temperature_logs
    where baby_id = p_baby
      and measured_at >= now() - interval '24 hours'
      and temperature_c >= 38.0
      and deleted_at is null;
  if v_fever_count >= 3 then
    kind := 'fever_persistent';
    severity := 'warn';
    message_en := v_fever_count::text || ' fever readings (≥38°C) in the last 24 hours. ' ||
                  'A persistent fever pattern is worth raising with your pediatrician.';
    message_ar := v_fever_count::text || ' قراءات حرارة (≥٣٨°م) في آخر ٢٤ ساعة. ' ||
                  'نمط حرارة مستمر يستحق المراجعة مع طبيب الأطفال.';
    evidence := jsonb_build_object(
      'readings', v_fever_count,
      'threshold_c', 38.0
    );
    return next;
  end if;

  -- 4. Vomiting frequency — ≥3 events in last 24h. Dehydration risk.
  select count(*) into v_vomit_count
    from public.vomiting_logs
    where baby_id = p_baby
      and vomited_at >= now() - interval '24 hours'
      and deleted_at is null;
  if v_vomit_count >= 3 then
    kind := 'vomiting_frequency';
    severity := 'warn';
    message_en := v_vomit_count::text || ' vomiting episodes in the last 24 hours. ' ||
                  'Watch for dehydration signs (fewer wet diapers, sunken fontanelle, ' ||
                  'unusual sleepiness) and consider calling your pediatrician.';
    message_ar := v_vomit_count::text || ' حالات قيء في آخر ٢٤ ساعة. ' ||
                  'انتبهي لعلامات الجفاف (قلة البلل في الحفاضات، انخفاض اليافوخ، ' ||
                  'نعاس غير معتاد) وفكري في التواصل مع طبيب الأطفال.';
    evidence := jsonb_build_object(
      'episodes', v_vomit_count,
      'lookback_hours', 24
    );
    return next;
  end if;

  -- 5. Red-flag vomiting — projectile, bilious, or blood-streaked in last 48h.
  select count(*) into v_vomit_redflag
    from public.vomiting_logs
    where baby_id = p_baby
      and vomited_at >= now() - interval '48 hours'
      and (severity = 'projectile' or content_type in ('bilious','blood_streaked'))
      and deleted_at is null;
  if v_vomit_redflag > 0 then
    kind := 'vomiting_red_flag';
    severity := 'urgent';
    message_en := 'Vomiting in the last 48 hours included a red-flag pattern (' ||
                  'projectile, bilious/green, or blood-streaked). These warrant ' ||
                  'same-day pediatric evaluation — please contact your doctor today.';
    message_ar := 'القيء في آخر ٤٨ ساعة تضمّن نمطاً تحذيرياً (' ||
                  'قذفي، مائل للأخضر، أو فيه دم). يستوجب فحصاً طبياً في نفس اليوم — ' ||
                  'تواصلي مع طبيب الأطفال اليوم.';
    evidence := jsonb_build_object(
      'red_flag_episodes', v_vomit_redflag,
      'lookback_hours', 48
    );
    return next;
  end if;

  return;
end;
$$;
grant execute on function public.ai_risk_signals(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Risk signals now on cycle + baby profiles$t1$,
  p_body     => $b1$The pregnancy risk-detection banner (Wave 33A) is now on every stage. Cycle profiles get screening signals for irregular cycles, persistent severe pain, and persistent heavy flow — drawing on standard OB-GYN screening criteria. Baby profiles get fever rules tuned to age (any fever under 3 months is treated as urgent per AAP/NICE), high-fever flags, persistent-fever patterns, and vomiting-frequency / red-flag-vomiting alerts (projectile, bilious, or blood-streaked). Same framing as before: screening signals, not diagnoses — every banner ends with a "discuss with your doctor" CTA and cites the underlying guideline.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$إشارات المخاطر الآن في ملفات الدورة والطفل$ta1$,
  p_body_ar  => $ba1$شريط كشف المخاطر للحمل (موجة ٣٣أ) متاح الآن في كل المراحل. ملفات الدورة تحصل على إشارات لعدم انتظام الدورة، الألم الشديد المستمر، والغزارة المستمرة — مبنية على معايير فحص طب النساء. ملفات الأطفال تحصل على قواعد حرارة حسب العمر (أي ارتفاع حرارة تحت ٣ شهور يُعامل كعاجل حسب AAP و NICE)، تنبيه الحرارة المرتفعة، نمط الحرارة المستمر، وتنبيهات تكرار القيء أو القيء التحذيري (قذفي، أو مائل للأخضر، أو فيه دم). نفس الإطار: إشارات فحص لا تشخيص — كل تنبيه ينتهي بـ«اخبري طبيبك» مع ذكر المرجع.$ba1$
);

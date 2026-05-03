-- 056: Wave 14 — personal pattern engine + doctor-ready questions
-- ============================================================================
-- Pattern detection on the user's own data only. No external lookups, no
-- cross-user learning. Three RPCs power the new UI:
--
-- 1. cycle_personal_baseline(p_baby) — your numbers at a glance:
--      median_cycle_length, median_period_length, cycle_count,
--      first_logged, regularity_score (1–5 derived from cycle-length stddev),
--      top_symptoms (most-reported symptom tokens across logs).
--
-- 2. cycle_doctor_questions(p_baby) — combines red flags + baseline into a
--    short list of "consider asking your doctor about…" questions, each
--    with the evidence (the actual numbers from your data) so the
--    conversation is concrete, not vague.
--
-- 3. doctor_caregivers_for(p_baby) — list of users who have role='doctor'
--    on this baby plus the optional doctors-table linkage. Used by the
--    "Send to my doctor" picker on the questions card.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. cycle_personal_baseline
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cycle_personal_baseline(p_baby uuid)
returns table (
  median_cycle_length   numeric,
  median_period_length  numeric,
  cycle_count           int,
  first_logged          date,
  regularity_score      int,    -- 1 (very irregular) to 5 (very regular)
  top_symptoms          text[]
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_stddev numeric;
begin
  if not public.has_baby_access(p_baby) then return; end if;

  -- Headline numbers — null when there isn't enough data.
  select percentile_cont(0.5) within group (order by cycle_length)
    into median_cycle_length
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null and cycle_length is not null;

  select percentile_cont(0.5) within group (order by (period_end - period_start) + 1)
    into median_period_length
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null and period_end is not null;

  select count(*), min(period_start)
    into cycle_count, first_logged
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null;

  -- Regularity = 5 - clamp(stddev / 4) — i.e. cycles within ±2 days of
  -- the median get 5; ±8 days gets 1. Null until we have 3+ cycles.
  if cycle_count >= 3 then
    select stddev_pop(cycle_length) into v_stddev
      from public.menstrual_cycles
     where baby_id = p_baby and deleted_at is null and cycle_length is not null;
    regularity_score := greatest(1, least(5,
      5 - round(coalesce(v_stddev, 0) / 2.0)::int
    ));
  else
    regularity_score := null;
  end if;

  -- Top 3 symptom tokens by frequency. unnest the symptoms array per
  -- cycle and tally.
  with sym as (
    select unnest(symptoms) as token
      from public.menstrual_cycles
     where baby_id = p_baby and deleted_at is null and symptoms is not null
  )
  select array_agg(token order by cnt desc, token)
    into top_symptoms
    from (
      select token, count(*) as cnt from sym
       group by token order by count(*) desc limit 3
    ) ranked;

  return next;
end;
$$;
grant execute on function public.cycle_personal_baseline(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cycle_doctor_questions — combines red flags + baseline into questions
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cycle_doctor_questions(p_baby uuid)
returns table (
  question  text,
  evidence  text,
  severity  text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_median  numeric;
  v_count   int;
  v_top     text[];
  v_long    int;
  v_pain    int;
  v_last    date;
  v_days    int;
begin
  if not public.has_baby_access(p_baby) then return; end if;

  select percentile_cont(0.5) within group (order by cycle_length),
         count(*)
    into v_median, v_count
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null and cycle_length is not null;

  with sym as (
    select unnest(symptoms) as token
      from public.menstrual_cycles
     where baby_id = p_baby and deleted_at is null and symptoms is not null
  )
  select array_agg(token order by cnt desc, token)
    into v_top
    from (select token, count(*) as cnt from sym group by token order by count(*) desc limit 5) r;

  -- Q1: irregular pattern.
  select count(*) into v_long
    from (select cycle_length from public.menstrual_cycles
           where baby_id = p_baby and deleted_at is null and cycle_length is not null
           order by period_start desc limit 6) sub
   where cycle_length > 35;
  if v_long >= 3 then
    question := 'Could the irregular pattern in my cycles be PCOS, thyroid, or another hormone cause?';
    evidence := v_long || ' of my last 6 cycles ran longer than 35 days. Median cycle length: '
                || coalesce(round(v_median)::text, '—') || ' days.';
    severity := 'warn';
    return next;
  end if;

  -- Q2: missed period.
  select max(period_start) into v_last
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null;
  v_days := case when v_last is null then null else (current_date - v_last) end;
  if v_days is not null and v_days > 50 and (v_median is null or v_median <= 40) then
    question := 'My period is well overdue — what should we rule out next?';
    evidence := v_days || ' days since my last period (started ' || v_last || '). Typical for me is ~'
                || coalesce(round(v_median)::text, '28') || ' days.';
    severity := 'warn';
    return next;
  end if;

  -- Q3: repeated severe pain.
  with recent as (
    select symptoms from public.menstrual_cycles
     where baby_id = p_baby and deleted_at is null
     order by period_start desc limit 3
  )
  select case when count(*) = 3 and bool_and('severe_pain' = any(symptoms)) then 1 else 0 end
    into v_pain from recent;
  if v_pain = 1 then
    question := 'Severe pain has been present every cycle for a while — could endometriosis or adenomyosis explain it?';
    evidence := 'Severe pain logged in my last 3 consecutive cycles.';
    severity := 'urgent';
    return next;
  end if;

  -- Q4: very heavy flow trend.
  select count(*) into v_long
    from (select flow_intensity from public.menstrual_cycles
           where baby_id = p_baby and deleted_at is null and flow_intensity is not null
           order by period_start desc limit 4) sub
   where flow_intensity = 'heavy';
  if v_long >= 3 then
    question := 'My periods have been heavy lately — could a ferritin / CBC + ultrasound rule out fibroids or anaemia?';
    evidence := v_long || ' of my last 4 periods were classified as heavy.';
    severity := 'warn';
    return next;
  end if;

  -- Q5: persistent symptom that's not pain. Highlight the most-frequent
  -- symptom if it appears in 4+ recent cycles.
  if v_top is not null and array_length(v_top, 1) >= 1 then
    declare v_freq int; v_token text := v_top[1];
    begin
      if v_token != 'severe_pain' then
        select count(*) into v_freq
          from (select symptoms from public.menstrual_cycles
                 where baby_id = p_baby and deleted_at is null
                 order by period_start desc limit 6) r
         where v_token = any(symptoms);
        if v_freq >= 4 then
          question := 'I keep logging "' || v_token || '" almost every cycle — is there an underlying cause worth investigating?';
          evidence := v_token || ' appeared in ' || v_freq || ' of my last 6 cycles.';
          severity := 'info';
          return next;
        end if;
      end if;
    end;
  end if;

  -- Q6: data sufficiency callout — if we have <3 cycles, encourage logging
  -- before the next visit so there's something to discuss.
  if v_count < 3 then
    question := 'I have just started tracking — could you note my baseline so we can compare next visit?';
    evidence := 'Cycles logged so far: ' || coalesce(v_count, 0)
                || '. Want a baseline reading.';
    severity := 'info';
    return next;
  end if;
end;
$$;
grant execute on function public.cycle_doctor_questions(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. doctor_caregivers_for — caregivers with role='doctor' on this baby,
-- plus their display_name + email + linked doctor record (if any). Drives
-- the "Send to my doctor" picker.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.doctor_caregivers_for(p_baby uuid)
returns table (
  user_id        uuid,
  display_name   text,
  email          text,
  doctor_name    text,
  doctor_specialty text
)
language sql stable security definer set search_path = public
as $$
  select
    bu.user_id,
    p.display_name,
    p.email,
    d.name      as doctor_name,
    d.specialty as doctor_specialty
  from public.baby_users bu
  left join public.profiles p on p.id = bu.user_id
  left join public.doctors d on d.baby_id = bu.baby_id
                             and d.user_id = bu.user_id
                             and d.deleted_at is null
  where bu.baby_id = p_baby and bu.role = 'doctor';
$$;
grant execute on function public.doctor_caregivers_for(uuid) to authenticated;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. App update notification
-- ─────────────────────────────────────────────────────────────────────────────
select public.publish_app_update(
  p_title    => $t1$Personal pattern engine + doctor-ready questions$t1$,
  p_body     => $b1$Two cycle upgrades on the planner: (1) Your baseline card shows median cycle length, median period length, regularity score, and your top 3 most-reported symptoms — computed entirely from your own data. (2) The pattern check now generates ready-to-send "consider asking your doctor about…" questions with the evidence inline (e.g. "5 of my last 6 cycles ran longer than 35 days"). One tap sends them as a private message to your doctor caregiver — no copy-paste, no rephrasing.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$محرك الأنماط الشخصي + أسئلة جاهزة للطبيب$ta1$,
  p_body_ar  => $ba1$تحديثان في المخطط: (١) بطاقة الأرقام الشخصية: متوسط طول الدورة، متوسط طول الحيض، درجة الانتظام، وأكثر ٣ أعراض تكررًا — كلها من بياناتك أنتِ فقط. (٢) فحص الأنماط الآن ينشئ أسئلة جاهزة "ربما اسألي طبيبك عن…" مع الدليل ("٥ من آخر ٦ دورات تجاوزت ٣٥ يومًا"). بضغطة واحدة ترسلين الأسئلة برسالة خاصة لطبيبك — بدون نسخ ولا إعادة صياغة.$ba1$
);

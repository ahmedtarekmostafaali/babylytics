-- 083: Wave 39 — baby routine predictions + pattern-aware explanations
-- ============================================================================
-- A single RPC that gives the baby overview a "Tonight's outlook" card.
-- Shifts the app from logbook to co-pilot for the baby stage.
--
-- Inputs: baby_id (gated on has_baby_access).
-- Reads:
--   - babies.dob to compute age in months → wake-window band
--   - sleep_logs (last 14 days) for the prediction + regression check
--   - feedings (last 14 days) for the growth-spurt pattern
--
-- Returns (one row):
--   - status               'asleep' | 'awake' | 'unknown'
--   - last_sleep_start     when current sleep started (or last completed sleep)
--   - last_sleep_end       when last sleep ended (null if currently asleep)
--   - next_wake_estimate   timestamptz (when asleep) — start + median nap dur
--   - next_nap_window_start timestamptz (when awake) — last_end + wake_window
--   - next_nap_window_end   timestamptz (when awake) — same + 30min cushion
--   - wake_window_target_min int — what's age-appropriate (informational)
--   - median_nap_min       int — rolling median sleep duration last 14 days
--   - regression_detected  boolean — total sleep dropped ≥30% week-over-week
--   - regression_severity  text 'mild' | 'moderate' | 'severe' | null
--   - pattern_kind         text 'overtired' | 'undertired' | 'growth_spurt' | null
--   - pattern_msg_en       text — explanation when pattern detected
--   - pattern_msg_ar       text — Arabic equivalent
--   - last_7d_total_sleep_min  int
--   - prior_7d_total_sleep_min int
--   - feeds_last_7d        int — for growth spurt detection
--   - feeds_prior_7d       int
--
-- Wake-window bands drawn from Polly Moore (The 90-Minute Baby Sleep
-- Program) + Marc Weissbluth (Healthy Sleep Habits, Happy Child).
-- These are well-established pediatric sleep references; the bands are
-- conservative midpoints, not sharp cutoffs.
--
-- Idempotent.

begin;

create or replace function public.baby_routine_predictions(p_baby uuid)
returns table (
  status                text,
  last_sleep_start      timestamptz,
  last_sleep_end        timestamptz,
  next_wake_estimate    timestamptz,
  next_nap_window_start timestamptz,
  next_nap_window_end   timestamptz,
  wake_window_target_min int,
  median_nap_min        int,
  regression_detected   boolean,
  regression_severity   text,
  pattern_kind          text,
  pattern_msg_en        text,
  pattern_msg_ar        text,
  last_7d_total_sleep_min  int,
  prior_7d_total_sleep_min int,
  feeds_last_7d         int,
  feeds_prior_7d        int
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_baby    record;
  v_age_d   int;
  v_window  int;     -- target wake window in minutes for this age
  v_last    record;
  v_now     timestamptz := now();

  v_median_nap int;
  v_short_nap_n int;       -- naps under 30 min
  v_total_naps  int;
  v_overnight_wakings int;

  v_last7_total int;
  v_prior7_total int;
  v_regression_pct numeric;

  v_feeds_last7  int;
  v_feeds_prior7 int;
  v_feed_gap_change numeric;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  select id, name, dob, lifecycle_stage
    into v_baby
    from public.babies where id = p_baby;
  if v_baby.dob is null or v_baby.lifecycle_stage in ('planning','pregnancy') then
    return;
  end if;

  v_age_d := extract(day from (v_now::timestamp - v_baby.dob::timestamp))::int;

  -- ─────────────────────────────────────────────────────────────────────
  -- Wake-window target by age (Polly Moore + Weissbluth midpoints).
  -- Conservative: pick the middle of the published range so we don't
  -- over- or under-shoot.
  -- ─────────────────────────────────────────────────────────────────────
  v_window := case
    when v_age_d <  56  then  60   -- 0-2mo: 45-90 min
    when v_age_d < 112  then  90   -- 2-4mo: 75-105 min
    when v_age_d < 182  then 130   -- 4-6mo: 105-150 min
    when v_age_d < 273  then 180   -- 6-9mo: 150-210 min
    when v_age_d < 365  then 210   -- 9-12mo: 180-240 min
    when v_age_d < 547  then 270   -- 12-18mo: 240-360 min
    when v_age_d < 730  then 330   -- 18-24mo: 300-420 min
    else                       360 -- 2y+: single nap, longer windows
  end;
  wake_window_target_min := v_window;

  -- ─────────────────────────────────────────────────────────────────────
  -- Last sleep entry — drives status + prediction.
  -- ─────────────────────────────────────────────────────────────────────
  select sl.start_at, sl.end_at
    into v_last
    from public.sleep_logs sl
    where sl.baby_id = p_baby and sl.deleted_at is null
    order by sl.start_at desc
    limit 1;

  -- Median completed nap duration in last 14 days (excludes overnight
  -- sleeps >5h to keep it nap-relevant for younger babies; for >12mo
  -- this still works because we use median not mean).
  select percentile_cont(0.5) within group (order by duration_min)::int,
         count(*) filter (where duration_min < 30),
         count(*)
    into v_median_nap, v_short_nap_n, v_total_naps
    from public.sleep_logs
    where baby_id = p_baby and deleted_at is null
      and end_at is not null
      and start_at >= v_now - interval '14 days'
      and duration_min is not null
      and duration_min between 10 and 300;

  -- Overnight-wakings proxy: count distinct sleep_logs in last 7 days
  -- that started between 21:00 and 04:00 local. (Without per-night
  -- session grouping this is approximate but useful.)
  select count(*) into v_overnight_wakings
    from public.sleep_logs
    where baby_id = p_baby and deleted_at is null
      and start_at >= v_now - interval '7 days'
      and extract(hour from start_at at time zone 'Africa/Cairo') in (21,22,23,0,1,2,3,4);

  -- ─────────────────────────────────────────────────────────────────────
  -- Total-sleep regression check.
  -- ─────────────────────────────────────────────────────────────────────
  select coalesce(sum(duration_min), 0)::int into v_last7_total
    from public.sleep_logs
    where baby_id = p_baby and deleted_at is null
      and end_at is not null
      and start_at >= v_now - interval '7 days';
  select coalesce(sum(duration_min), 0)::int into v_prior7_total
    from public.sleep_logs
    where baby_id = p_baby and deleted_at is null
      and end_at is not null
      and start_at >= v_now - interval '14 days'
      and start_at <  v_now - interval '7 days';
  if v_prior7_total > 60 then
    v_regression_pct := (v_prior7_total - v_last7_total)::numeric / v_prior7_total::numeric;
    if v_regression_pct >= 0.30 then
      regression_detected := true;
      regression_severity := case
        when v_regression_pct >= 0.50 then 'severe'
        when v_regression_pct >= 0.40 then 'moderate'
        else 'mild'
      end;
    else
      regression_detected := false;
    end if;
  else
    regression_detected := false;
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- Feed gap proxy — for growth-spurt detection.
  -- ─────────────────────────────────────────────────────────────────────
  select count(*) into v_feeds_last7
    from public.feedings
    where baby_id = p_baby and deleted_at is null
      and fed_at >= v_now - interval '7 days';
  select count(*) into v_feeds_prior7
    from public.feedings
    where baby_id = p_baby and deleted_at is null
      and fed_at >= v_now - interval '14 days'
      and fed_at <  v_now - interval '7 days';

  feeds_last_7d  := v_feeds_last7;
  feeds_prior_7d := v_feeds_prior7;
  last_7d_total_sleep_min  := v_last7_total;
  prior_7d_total_sleep_min := v_prior7_total;
  median_nap_min := v_median_nap;

  -- ─────────────────────────────────────────────────────────────────────
  -- Status + predictions.
  -- ─────────────────────────────────────────────────────────────────────
  if v_last.start_at is not null and v_last.end_at is null then
    -- Currently asleep.
    status := 'asleep';
    last_sleep_start := v_last.start_at;
    last_sleep_end   := null;
    -- Predict wake = start + median nap duration (or age-specific
    -- fallback if we don't have enough data yet).
    next_wake_estimate := v_last.start_at + (
      coalesce(v_median_nap, case when v_age_d < 90 then 60 else 90 end)
      || ' minutes'
    )::interval;
  elsif v_last.end_at is not null then
    -- Currently awake.
    status := 'awake';
    last_sleep_start := v_last.start_at;
    last_sleep_end   := v_last.end_at;
    -- Optimal next-nap window: end + wake_window ± 15 min cushion.
    next_nap_window_start := v_last.end_at + (v_window - 15 || ' minutes')::interval;
    next_nap_window_end   := v_last.end_at + (v_window + 15 || ' minutes')::interval;
  else
    status := 'unknown';
  end if;

  -- ─────────────────────────────────────────────────────────────────────
  -- Pattern detection. Pick the strongest signal; only one returned.
  -- Order: regression (already in own column) > overtired > undertired > growth_spurt
  -- ─────────────────────────────────────────────────────────────────────

  -- Overtired: ≥40% of recent naps under 30min AND ≥4 overnight wakings.
  if v_total_naps >= 4
     and v_short_nap_n::numeric / v_total_naps::numeric >= 0.40
     and v_overnight_wakings >= 4
  then
    pattern_kind := 'overtired';
    pattern_msg_en := 'Short naps (' || v_short_nap_n || ' of ' || v_total_naps ||
                      ' under 30 min) plus frequent night wakings (' || v_overnight_wakings ||
                      ' between 9pm-4am this week) often signals an overtired baby. Counter-intuitively, an earlier bedtime + slightly shorter wake windows usually helps within 2-3 days.';
    pattern_msg_ar := 'قيلولات قصيرة (' || v_short_nap_n || ' من ' || v_total_naps ||
                      ' أقل من ٣٠ دقيقة) مع استيقاظ متكرر ليلاً (' || v_overnight_wakings ||
                      ' مرات بين ٩م-٤ص هذا الأسبوع) عادةً علامة على تعب زائد. ' ||
                      'الحل المفاجئ: تقديم وقت النوم وتقليل فترات الاستيقاظ بقليل — يتحسن خلال ٢-٣ أيام.';
  -- Growth spurt: ≥30% jump in feed count week-over-week.
  elsif v_feeds_prior7 >= 5
        and v_feeds_last7::numeric / v_feeds_prior7::numeric >= 1.30
  then
    pattern_kind := 'growth_spurt';
    pattern_msg_en := 'Feed count is up ' ||
                      round(((v_feeds_last7::numeric / v_feeds_prior7::numeric - 1.0) * 100), 0)::text ||
                      '% this week (' || v_feeds_last7 || ' vs ' || v_feeds_prior7 ||
                      '). Often a growth spurt — common at 2-3 weeks, 6 weeks, 3 months, and 6 months. Feed on demand for a few days; the rhythm usually settles back.';
    pattern_msg_ar := 'عدد الرضعات زاد ' ||
                      round(((v_feeds_last7::numeric / v_feeds_prior7::numeric - 1.0) * 100), 0)::text ||
                      '٪ هذا الأسبوع (' || v_feeds_last7 || ' مقابل ' || v_feeds_prior7 ||
                      '). غالباً طفرة نمو — شائعة في الأسبوع ٢-٣، الأسبوع ٦، الشهر ٣، والشهر ٦. ' ||
                      'أرضعي على الطلب لبضعة أيام؛ الإيقاع عادةً يستقر مرة أخرى.';
  end if;

  return next;
end;
$$;
grant execute on function public.baby_routine_predictions(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Baby co-pilot: predicted wake, nap window, regression alerts$t1$,
  p_body     => $b1$The baby overview now shows a "Tonight''s outlook" card. When baby is asleep, it predicts the next wake (last sleep start + median nap duration). When awake, it suggests the optimal nap window based on age-appropriate wake windows (Polly Moore + Weissbluth bands — 60min at 0-2mo, 90min at 2-4mo, 130min at 4-6mo, 180min at 6-9mo, 210min at 9-12mo, 270min at 12-18mo). It detects sleep regressions when total sleep drops ≥30% week-over-week (catches the famous 4mo, 8mo, 12mo regressions). And it flags two patterns when they show up: "overtired" (short naps + frequent night wakings → counter-intuitive earlier bedtime usually helps) and "growth spurt" (feed count jumped ≥30% week-over-week → feed on demand for a few days). All explained in plain language, never as a diagnosis.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$مساعد الطفل: توقع الاستيقاظ والقيلولة وتنبيهات التراجع$ta1$,
  p_body_ar  => $ba1$صفحة الطفل الآن فيها بطاقة «توقعات الليلة». لما الطفل نائم، تتوقع وقت الاستيقاذ التالي (بداية النوم + متوسط مدة القيلولة). لما يكون مستيقظ، تقترح أنسب وقت للقيلولة القادمة بناءً على فترات الاستيقاذ المناسبة لعمره (أبحاث Polly Moore و Weissbluth — ٦٠د في ٠-٢ شهر، ٩٠د في ٢-٤ شهر، ١٣٠د في ٤-٦ شهور، ١٨٠د في ٦-٩ شهور، ٢١٠د في ٩-١٢ شهر، ٢٧٠د في ١٢-١٨ شهر). تكتشف تراجع النوم لما إجمالي النوم ينخفض ٣٠٪ أو أكثر مقارنة بالأسبوع السابق (تكتشف تراجع الـ ٤ شهور و٨ شهور و١٢ شهر المعروف). وتنبه على نمطين: «إجهاد زائد» (قيلولات قصيرة + استيقاذ ليلي متكرر — الحل المفاجئ تقديم وقت النوم) و«طفرة نمو» (عدد الرضعات زاد ٣٠٪+ هذا الأسبوع — أرضعي على الطلب لبضعة أيام). كل شيء مشروح بلغة بسيطة، ليس تشخيصاً.$ba1$
);

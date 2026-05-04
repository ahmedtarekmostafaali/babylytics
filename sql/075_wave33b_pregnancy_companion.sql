-- 075: Wave 33B — AI pregnancy companion (rate-limit + context RPCs)
-- ============================================================================
-- Two server-side helpers that the Next.js /api/pregnancy-companion
-- route uses:
--
--   1. pregnancy_companion_log — one row per AI call. Used to enforce
--      a per-user daily rate limit (5 calls/day default) so a single
--      mother can't accidentally rack up a $50 Claude bill in an
--      afternoon. Cheap inserts, single user_id index.
--
--   2. record_companion_call(p_baby, p_mode) RPC — atomic
--      "is this user under their daily limit, and if so increment
--      the count". Returns calls_today + daily_limit so the UI can
--      render "3 / 5 today". Raises 'companion_rate_limited' when
--      blocked.
--
--   3. pregnancy_companion_context(p_baby) RPC — returns a structured
--      jsonb snapshot of the recent data the AI needs to give a useful
--      answer: gestational age, last 5 BP readings, last 5 glucose
--      readings, last 3 weights, recent symptoms (last 14 days), and
--      any active risk signals from pregnancy_risk_signals (Wave 33A).
--      SECURITY DEFINER + has_baby_access gate.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pregnancy_companion_log
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pregnancy_companion_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  baby_id     uuid not null references public.babies(id) on delete cascade,
  mode        text not null check (mode in ('explain','draft_question')),
  prompt_excerpt text,                         -- first 200 chars for support
  response_excerpt text,                       -- first 400 chars for support
  created_at  timestamptz not null default now()
);

create index if not exists idx_pregnancy_companion_log_user_day
  on public.pregnancy_companion_log (user_id, created_at desc);

alter table public.pregnancy_companion_log enable row level security;

drop policy if exists pregnancy_companion_log_select on public.pregnancy_companion_log;
create policy pregnancy_companion_log_select on public.pregnancy_companion_log
  for select using (user_id = auth.uid());

drop policy if exists pregnancy_companion_log_insert on public.pregnancy_companion_log;
create policy pregnancy_companion_log_insert on public.pregnancy_companion_log
  for insert with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. record_companion_call — atomic rate-limit + insert.
--    Returns rows: { calls_today, daily_limit, log_id }.
--    Raises 'companion_rate_limited' when calls_today >= daily_limit.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_companion_call(
  p_baby uuid,
  p_mode text,
  p_prompt_excerpt text default null,
  p_response_excerpt text default null
) returns table (
  calls_today int,
  daily_limit int,
  log_id      uuid
)
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_calls int;
  v_limit int := 5;             -- per-user per-day cap
  v_id    uuid;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then
    raise exception 'access denied';
  end if;
  if p_mode not in ('explain','draft_question') then
    raise exception 'invalid_mode';
  end if;

  select count(*) into v_calls
    from public.pregnancy_companion_log
    where user_id = v_actor
      and created_at >= date_trunc('day', now());
  if v_calls >= v_limit then
    raise exception 'companion_rate_limited';
  end if;

  insert into public.pregnancy_companion_log
    (user_id, baby_id, mode, prompt_excerpt, response_excerpt)
  values
    (v_actor, p_baby, p_mode, left(p_prompt_excerpt, 200), left(p_response_excerpt, 400))
  returning id into v_id;

  calls_today := v_calls + 1;
  daily_limit := v_limit;
  log_id      := v_id;
  return next;
end;
$$;
grant execute on function public.record_companion_call(uuid, text, text, text) to authenticated;

-- Helper used by the UI to show "X / 5 today" without making a call.
create or replace function public.companion_calls_today(p_baby uuid)
returns table (calls_today int, daily_limit int)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_calls int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select count(*) into v_calls
    from public.pregnancy_companion_log
    where user_id = v_actor
      and created_at >= date_trunc('day', now());
  calls_today := v_calls;
  daily_limit := 5;
  return next;
end;
$$;
grant execute on function public.companion_calls_today(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pregnancy_companion_context — structured snapshot for the AI.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.pregnancy_companion_context(p_baby uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  record;
  v_ga_weeks numeric;
  v_bp_recent jsonb;
  v_glu_recent jsonb;
  v_weight_recent jsonb;
  v_symptoms jsonb;
  v_signals jsonb;
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

  v_ga_weeks :=
    case
      when v_baby.lmp is not null then extract(epoch from (now() - v_baby.lmp::timestamptz)) / 86400.0 / 7.0
      when v_baby.edd is not null then 40.0 - extract(epoch from (v_baby.edd::timestamptz - now())) / 86400.0 / 7.0
      else null
    end;

  -- Last 5 BP readings
  select coalesce(jsonb_agg(jsonb_build_object(
    'measured_at', measured_at,
    'systolic',    bp_systolic,
    'diastolic',   bp_diastolic,
    'heart_rate',  heart_rate_bpm
  ) order by measured_at desc), '[]'::jsonb)
  into v_bp_recent
  from (
    select * from public.vital_signs_logs
    where baby_id = p_baby and deleted_at is null
      and (bp_systolic is not null or bp_diastolic is not null)
    order by measured_at desc limit 5
  ) bp;

  -- Last 5 glucose readings
  select coalesce(jsonb_agg(jsonb_build_object(
    'measured_at', measured_at,
    'value_mgdl',  value_mgdl,
    'meal_context', meal_context
  ) order by measured_at desc), '[]'::jsonb)
  into v_glu_recent
  from (
    select * from public.blood_sugar_logs
    where baby_id = p_baby and deleted_at is null
    order by measured_at desc limit 5
  ) g;

  -- Last 3 weights
  select coalesce(jsonb_agg(jsonb_build_object(
    'measured_at', measured_at,
    'weight_kg',   weight_kg
  ) order by measured_at desc), '[]'::jsonb)
  into v_weight_recent
  from (
    select * from public.measurements
    where baby_id = p_baby and deleted_at is null and weight_kg is not null
    order by measured_at desc limit 3
  ) w;

  -- Recent symptoms (last 14 days). Symptoms live on a few tables; we
  -- pull from the prenatal symptoms table via a generic select. Skip if
  -- the table doesn't exist (defensive).
  begin
    execute $sym$
      select coalesce(jsonb_agg(jsonb_build_object(
        'logged_at', logged_at,
        'kind',      kind,
        'severity',  severity
      ) order by logged_at desc), '[]'::jsonb)
      from public.prenatal_symptoms
      where baby_id = $1
        and logged_at >= now() - interval '14 days'
        and deleted_at is null
    $sym$ into v_symptoms using p_baby;
  exception when undefined_table then
    v_symptoms := '[]'::jsonb;
  end;

  -- Active risk signals (Wave 33A). Returns array of {kind, severity, ...}.
  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
  into v_signals
  from public.pregnancy_risk_signals(p_baby) s;

  return jsonb_build_object(
    'baby_name',  v_baby.name,
    'ga_weeks',   case when v_ga_weeks is null then null else round(v_ga_weeks, 1) end,
    'lmp',        v_baby.lmp,
    'edd',        v_baby.edd,
    'recent_bp',       v_bp_recent,
    'recent_glucose',  v_glu_recent,
    'recent_weight',   v_weight_recent,
    'recent_symptoms', v_symptoms,
    'risk_signals',    v_signals
  );
end;
$$;
grant execute on function public.pregnancy_companion_context(uuid) to authenticated;

commit;

-- App update notification covering both 33A and 33B.
select public.publish_app_update(
  p_title    => $t1$Pregnancy: risk signals + AI companion (safe-mode)$t1$,
  p_body     => $b1$Two big upgrades on the pregnancy side. (1) Risk-pattern detection now scans your tracked data (BP, glucose, weight, kicks) against ACOG and ADA thresholds and surfaces soft "worth raising with your doctor" banners on your overview when it sees a pattern — preeclampsia screening signals, gestational diabetes screening, sudden weight gain, low fetal movement. Screening, not diagnosis: every banner cites the guideline and ends with a "tell your doctor" CTA. (2) AI pregnancy companion: ask it to explain a recent reading in plain language, or to draft a precise question for your next visit. It reads only your tracked data, never gives treatment advice, and always recommends discussing with your doctor. Limited to 5 calls per day per account.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$الحمل: إشارات المخاطر + المساعد الذكي (وضع آمن)$ta1$,
  p_body_ar  => $ba1$تحسينان كبيران في جانب الحمل. (١) كشف أنماط المخاطر يفحص بياناتك (الضغط، السكر، الوزن، الحركات) مقابل حدود ACOG و ADA، ويعرض تنبيهات لطيفة على صفحتك الرئيسية عند ملاحظة نمط — إشارات تسمم الحمل، فحص سكري الحمل، الزيادة المفاجئة في الوزن، قلة الحركة. فحص لا تشخيص: كل تنبيه يذكر المرجع وينتهي بـ«اخبري طبيبك». (٢) مساعد الحمل الذكي: اطلبي شرحاً لقراءة حديثة بلغة بسيطة، أو صياغة سؤال دقيق لزيارتك القادمة. يقرأ فقط بياناتك، لا يعطي نصيحة علاجية أبداً، ويوصي دائماً بمراجعة طبيبك. ٥ استدعاءات في اليوم لكل حساب.$ba1$
);

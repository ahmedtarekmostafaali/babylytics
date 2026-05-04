-- 076: Wave 34 — extend AI companion to cycle + baby stages
-- ============================================================================
-- Wave 33B shipped the companion only on pregnancy profiles. This wave
-- generalises:
--
--   1. Add `stage` column to pregnancy_companion_log so we can audit
--      which stage each call came from. Existing rows get back-filled
--      to 'pregnancy' (safe default — that's all that existed before).
--
--   2. New ai_companion_context(p_baby) RPC routes by lifecycle_stage
--      internally and returns a stage-tagged jsonb the route handler
--      can hand to Claude. Three branches:
--        - pregnancy → unchanged from Wave 33B (calls existing helper)
--        - planning  → cycle data: last 3 cycles, BBT, cycle mode,
--                      phase, vital signs
--        - baby      → recent feedings, stool, sleep, temperature,
--                      measurements, vaccinations
--
--   3. record_companion_call accepts an optional p_stage too so the
--      log row carries the source. Backwards-compatible: callers that
--      don't pass it still work.
--
--   4. The original pregnancy_companion_context stays as-is (so the
--      Wave 33B route handler also keeps working), but the route is
--      switching to ai_companion_context on the same wave for a single
--      code path.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. stage column on the log table
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pregnancy_companion_log
  add column if not exists stage text not null default 'pregnancy'
    check (stage in ('planning','pregnancy','baby'));

create index if not exists idx_companion_log_stage
  on public.pregnancy_companion_log (stage, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. record_companion_call — accept optional stage
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.record_companion_call(
  p_baby uuid,
  p_mode text,
  p_prompt_excerpt text default null,
  p_response_excerpt text default null,
  p_stage text default null
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
  v_limit int := 5;
  v_id    uuid;
  v_stage text;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;
  if p_mode not in ('explain','draft_question') then raise exception 'invalid_mode'; end if;

  -- Resolve the stage if caller didn't provide one.
  v_stage := p_stage;
  if v_stage is null then
    select case
      when lifecycle_stage = 'planning'  then 'planning'
      when lifecycle_stage = 'pregnancy' then 'pregnancy'
      else 'baby'
    end into v_stage
    from public.babies where id = p_baby;
  end if;
  if v_stage not in ('planning','pregnancy','baby') then
    raise exception 'invalid_stage';
  end if;

  select count(*) into v_calls
    from public.pregnancy_companion_log
    where user_id = v_actor
      and created_at >= date_trunc('day', now());
  if v_calls >= v_limit then
    raise exception 'companion_rate_limited';
  end if;

  insert into public.pregnancy_companion_log
    (user_id, baby_id, mode, stage, prompt_excerpt, response_excerpt)
  values
    (v_actor, p_baby, p_mode, v_stage, left(p_prompt_excerpt, 200), left(p_response_excerpt, 400))
  returning id into v_id;

  calls_today := v_calls + 1;
  daily_limit := v_limit;
  log_id      := v_id;
  return next;
end;
$$;
grant execute on function public.record_companion_call(uuid, text, text, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ai_companion_context — generic, stage-aware. Returns:
--      { stage, baby_name, ...stage-specific fields }
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ai_companion_context(p_baby uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  record;
  v_stage text;
  v_age_days int;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  select id, name, dob, lmp, edd, lifecycle_stage, cycle_mode, blood_type
    into v_baby
    from public.babies where id = p_baby;

  v_stage := case
    when v_baby.lifecycle_stage = 'planning'  then 'planning'
    when v_baby.lifecycle_stage = 'pregnancy' then 'pregnancy'
    else 'baby'
  end;

  -- Pregnancy branch reuses the existing rich helper.
  if v_stage = 'pregnancy' then
    return jsonb_set(
      public.pregnancy_companion_context(p_baby),
      '{stage}',
      to_jsonb('pregnancy'::text)
    );
  end if;

  -- Planning (cycle) branch.
  if v_stage = 'planning' then
    return jsonb_build_object(
      'stage',         'planning',
      'baby_name',     v_baby.name,
      'cycle_mode',    v_baby.cycle_mode,
      'recent_cycles',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'period_start',   period_start,
            'period_end',     period_end,
            'cycle_length',   cycle_length,
            'flow_intensity', flow_intensity,
            'symptoms',       symptoms
          ) order by period_start desc)
          from (
            select * from public.menstrual_cycles
            where baby_id = p_baby and deleted_at is null
            order by period_start desc limit 3
          ) c
        ), '[]'::jsonb),
      'recent_bbt',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'measured_at', measured_at,
            'celsius',     bbt_celsius
          ) order by measured_at desc)
          from (
            select * from public.measurements
            where baby_id = p_baby and deleted_at is null and bbt_celsius is not null
            order by measured_at desc limit 14
          ) b
        ), '[]'::jsonb),
      'recent_bp',
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'measured_at', measured_at,
            'systolic',    bp_systolic,
            'diastolic',   bp_diastolic
          ) order by measured_at desc)
          from (
            select * from public.vital_signs_logs
            where baby_id = p_baby and deleted_at is null
              and (bp_systolic is not null or bp_diastolic is not null)
            order by measured_at desc limit 5
          ) v
        ), '[]'::jsonb)
    );
  end if;

  -- Baby branch (newborn / infant / toddler / child treated as one).
  v_age_days := case
    when v_baby.dob is null then null
    else extract(day from (now()::timestamp - v_baby.dob::timestamp))::int
  end;

  return jsonb_build_object(
    'stage',       'baby',
    'baby_name',   v_baby.name,
    'age_days',    v_age_days,
    'blood_type',  v_baby.blood_type,
    'recent_feedings',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'fed_at',      fed_at,
          'quantity_ml', quantity_ml,
          'duration_min',duration_min,
          'milk_type',   milk_type
        ) order by fed_at desc)
        from (
          select * from public.feedings
          where baby_id = p_baby and deleted_at is null
          order by fed_at desc limit 8
        ) f
      ), '[]'::jsonb),
    'recent_stool',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'logged_at',   logged_at,
          'consistency', consistency,
          'color',       color
        ) order by logged_at desc)
        from (
          select * from public.stool_logs
          where baby_id = p_baby and deleted_at is null
          order by logged_at desc limit 5
        ) s
      ), '[]'::jsonb),
    'recent_sleep',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'start_at',    start_at,
          'end_at',      end_at,
          'duration_min', extract(epoch from (end_at - start_at)) / 60
        ) order by start_at desc)
        from (
          select * from public.sleep_logs
          where baby_id = p_baby and deleted_at is null and end_at is not null
          order by start_at desc limit 5
        ) sl
      ), '[]'::jsonb),
    'recent_temperature',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'measured_at', measured_at,
          'celsius',     celsius
        ) order by measured_at desc)
        from (
          select * from public.temperature_logs
          where baby_id = p_baby and deleted_at is null
          order by measured_at desc limit 5
        ) t
      ), '[]'::jsonb),
    'recent_measurements',
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'measured_at', measured_at,
          'weight_kg',   weight_kg,
          'height_cm',   height_cm,
          'head_circ_cm', head_circ_cm
        ) order by measured_at desc)
        from (
          select * from public.measurements
          where baby_id = p_baby and deleted_at is null
            and (weight_kg is not null or height_cm is not null or head_circ_cm is not null)
          order by measured_at desc limit 3
        ) m
      ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.ai_companion_context(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$AI companion now on cycle + baby profiles$t1$,
  p_body     => $b1$The pregnancy AI companion (explain a reading, draft a doctor question — never gives medical advice) shipped last wave for pregnancy profiles. It's now on every stage. On a cycle profile it reads your last 3 cycles, BBT, and vital signs to help you ask your OB-GYN sharper questions. On a baby profile it reads recent feedings, stool, sleep, temperature, and measurements to help you frame what to bring up at the pediatrician. Same 5/day per-user limit applies across all stages combined. Same safety rails — no diagnoses, no treatment advice, always points back to your doctor.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$المساعد الذكي الآن في ملفات الدورة والطفل$ta1$,
  p_body_ar  => $ba1$مساعد الحمل الذكي (شرح قراءة، صياغة سؤال للطبيب — لا يعطي نصيحة علاجية أبداً) شُحن الموجة السابقة لملفات الحمل فقط. الآن متاح لكل المراحل. على ملف الدورة يقرأ آخر ٣ دورات، BBT، والمؤشرات الحيوية ليساعدك تسألي طبيب النساء أسئلة أدق. على ملف الطفل يقرأ آخر الرضعات، البراز، النوم، الحرارة، والقياسات ليساعدك تصيغي ما تذكرينه لطبيب الأطفال. نفس حد ٥ استدعاءات يومياً لكل مستخدم عبر كل المراحل. نفس قواعد الأمان — لا تشخيص، لا نصيحة علاجية، يحيل دائماً لطبيبك.$ba1$
);

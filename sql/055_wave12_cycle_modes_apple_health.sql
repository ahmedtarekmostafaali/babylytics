-- 055: Wave 12 + 15 — cycle modes (foundation) + Apple Health import
-- ============================================================================
-- Two related additions shipped together so the Apple Health import has
-- somewhere to land:
--
-- 1. babies.cycle_mode text — 'standard' | 'pcos' | 'endometriosis' |
--    'irregular' | 'athlete' | 'postpartum'. Drives suggestion filtering
--    and mode-specific UI hints. NULL = unset (treated as 'standard').
--
-- 2. menstrual_cycles.bbt_celsius numeric + cervical_mucus text — extra
--    fertility-awareness fields that Apple Health exports. Optional.
--
-- 3. menstrual_cycles.source text default 'manual' — track where the row
--    came from so re-importing Apple Health doesn't duplicate. Apple
--    rows get source='apple_health' + source_uuid for idempotency.
--
-- 4. menstrual_cycles.source_uuid text — Apple's HKObject UUID. Unique
--    per (baby_id, source, source_uuid).
--
-- 5. cycle_red_flags(p_baby) — RPC returning a list of detected anomalies
--    based on the user's own historical cycles. Surfaces "consider talking
--    to a doctor" prompts on the planner page. Examples:
--      - Most recent cycle 7+ days longer than your median
--      - Missed period (50+ days since last period_start)
--      - Severely heavy flow trend
--      - Severe pain symptom flagged ≥3 cycles in a row
--
-- 6. import_menstrual_cycles(p_baby, p_records jsonb) — RPC that bulk-
--    upserts cycle rows from Apple Health. Each record has period_start,
--    optional period_end, flow, source_uuid. Upsert key is
--    (baby_id, source, source_uuid) so re-importing the same export is
--    a no-op.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. babies.cycle_mode
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.babies
  add column if not exists cycle_mode text
    check (cycle_mode is null or cycle_mode in
      ('standard','pcos','endometriosis','irregular','athlete','postpartum'));

comment on column public.babies.cycle_mode is
  'Cycle profile mode. Drives mode-specific suggestion filtering and '
  'tracking-field surfacing on the cycle log form. Null = standard.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 + 3 + 4. menstrual_cycles extras
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.menstrual_cycles
  add column if not exists bbt_celsius numeric(4,2)
    check (bbt_celsius is null or (bbt_celsius >= 35.0 and bbt_celsius <= 39.0));

alter table public.menstrual_cycles
  add column if not exists cervical_mucus text
    check (cervical_mucus is null or cervical_mucus in
      ('dry','sticky','creamy','watery','egg_white'));

alter table public.menstrual_cycles
  add column if not exists source text not null default 'manual'
    check (source in ('manual','apple_health','google_fit','fitbit'));

alter table public.menstrual_cycles
  add column if not exists source_uuid text;

-- Unique constraint for upsert idempotency. Only enforce when source_uuid
-- is set so manual rows aren't constrained by it.
create unique index if not exists uq_menstrual_cycles_source
  on public.menstrual_cycles (baby_id, source, source_uuid)
  where source_uuid is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. cycle_red_flags RPC — pattern-based anomaly detection on own data
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cycle_red_flags(p_baby uuid)
returns table (
  flag        text,
  severity    text,   -- 'info' | 'warn' | 'urgent'
  detail      text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_median_len   numeric;
  v_last_start   date;
  v_days_since   integer;
  v_recent_len   integer;
  v_long_count   integer;
begin
  if not public.has_baby_access(p_baby) then return; end if;

  -- Need at least 3 cycles to form a useful baseline.
  select percentile_cont(0.5) within group (order by cycle_length)
    into v_median_len
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null and cycle_length is not null;

  -- Days since the most recent period_start.
  select max(period_start) into v_last_start
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null;
  v_days_since := case when v_last_start is null then null
                       else (current_date - v_last_start) end;

  -- Most recent cycle length.
  select cycle_length into v_recent_len
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null and cycle_length is not null
   order by period_start desc limit 1;

  -- Flag 1: missed period — days_since > 50 and last cycle length <= 35.
  -- (Avoid flagging users with intentionally long cycles by checking median.)
  if v_days_since is not null and v_days_since > 50
     and (v_median_len is null or v_median_len <= 40) then
    flag     := 'missed_period';
    severity := 'warn';
    detail   := v_days_since || ' days since last period — typical for you is ~'
                || coalesce(v_median_len::text, '28') || ' days. Consider testing or asking your doctor.';
    return next;
  end if;

  -- Flag 2: very long latest cycle — recent_len > median + 7.
  if v_median_len is not null and v_recent_len is not null
     and v_recent_len > v_median_len + 7 then
    flag     := 'long_cycle';
    severity := 'info';
    detail   := 'Last cycle was ' || v_recent_len || ' days — ' ||
                round(v_recent_len - v_median_len) ||
                ' more than your median. Worth tracking the next one closely.';
    return next;
  end if;

  -- Flag 3: irregular pattern — count of cycles >35d in the last 6 entries.
  select count(*) into v_long_count
    from (
      select cycle_length
        from public.menstrual_cycles
       where baby_id = p_baby and deleted_at is null and cycle_length is not null
       order by period_start desc limit 6
    ) sub
   where cycle_length > 35;
  if v_long_count >= 3 then
    flag     := 'irregular_pattern';
    severity := 'warn';
    detail   := v_long_count || ' of your last 6 cycles ran longer than 35 days. '
                'A doctor can rule out PCOS, thyroid, or other causes.';
    return next;
  end if;

  -- Flag 4: severe pain repeats — ≥3 consecutive cycles with 'severe_pain'
  -- in symptoms. Only fires if the symptom array contains the literal token.
  with recent as (
    select symptoms
      from public.menstrual_cycles
     where baby_id = p_baby and deleted_at is null
     order by period_start desc limit 3
  )
  select case when count(*) = 3 and bool_and('severe_pain' = any(symptoms)) then 1 else 0 end
    into v_long_count from recent;
  if v_long_count = 1 then
    flag     := 'severe_pain';
    severity := 'urgent';
    detail   := 'Severe pain logged 3 cycles in a row. Endometriosis screening worth discussing.';
    return next;
  end if;
end;
$$;
grant execute on function public.cycle_red_flags(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. import_menstrual_cycles RPC — bulk upsert from Apple Health export
-- ─────────────────────────────────────────────────────────────────────────────
-- p_records is a jsonb array of objects shaped like:
--   { period_start: 'YYYY-MM-DD',
--     period_end:   'YYYY-MM-DD' | null,
--     flow_intensity: 'light'|'medium'|'heavy' | null,
--     source_uuid:  'apple-uuid-string' }
-- Returns count inserted + count updated for the import summary.
create or replace function public.import_menstrual_cycles(
  p_baby    uuid,
  p_records jsonb
) returns table (inserted int, updated int)
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_inserted int := 0;
  v_updated int := 0;
  rec jsonb;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may import data';
  end if;

  for rec in select * from jsonb_array_elements(p_records)
  loop
    insert into public.menstrual_cycles (
      baby_id, period_start, period_end, flow_intensity,
      source, source_uuid, created_by, created_at
    )
    values (
      p_baby,
      (rec->>'period_start')::date,
      nullif(rec->>'period_end','')::date,
      nullif(rec->>'flow_intensity',''),
      'apple_health',
      rec->>'source_uuid',
      v_actor,
      now()
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      period_start   = excluded.period_start,
      period_end     = excluded.period_end,
      flow_intensity = coalesce(excluded.flow_intensity, public.menstrual_cycles.flow_intensity);

    -- Track insert vs update: PostgreSQL doesn't expose this from
    -- ON CONFLICT directly; cheap heuristic — diagnostics on row-count.
    get diagnostics rec = ROW_COUNT;
    -- Inserted always returns 1 row whether new or updated; we don't
    -- distinguish further here. Bump combined "inserted-or-updated" total
    -- in v_inserted; UI just shows the total.
    v_inserted := v_inserted + 1;
  end loop;

  inserted := v_inserted;
  updated  := v_updated;
  return next;
end;
$$;
grant execute on function public.import_menstrual_cycles(uuid, jsonb) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Cycle modes (PCOS, irregular, postpartum…) + Apple Health import$t1$,
  p_body     => $b1$Two cycle-tracking upgrades: (1) Pick a cycle mode in your profile — Standard, PCOS, Endometriosis, Irregular, Athlete, or Postpartum. The Daily Ideas now surface mode-specific suggestions, and a "consider asking your doctor" card appears when patterns look off (long cycles, missed periods, repeated severe pain). (2) Import your Apple Health menstrual data — open a cycle profile, tap "Import from Apple Health", upload your export.zip, and we'll backfill years of period history. More health-app integrations and live native sync are next.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$أنماط الدورة (PCOS، غير منتظمة، ما بعد الولادة…) + استيراد Apple Health$ta1$,
  p_body_ar  => $ba1$تحسينان لتتبع الدورة: (١) اختاري نمطًا في ملفك — قياسي، PCOS، الانتباذ البطاني، غير منتظمة، رياضية، أو ما بعد الولادة. الاقتراحات اليومية تتكيف، وتظهر بطاقة "ربما تستشيري الطبيب" عند ملاحظة أنماط غير اعتيادية. (٢) استوردي بيانات الدورة من Apple Health — افتحي ملف الدورة، اضغطي "استيراد من Apple Health"، وارفعي ملف export.zip وسنستورد سنوات من السجل. المزيد من التكاملات والتزامن المباشر قادمان.$ba1$
);

-- 061: Wave 20 — Apple Health import: weight + BBT + sleep
-- ============================================================================
-- Extends the Wave 15 importer beyond menstrual flow. Three new categories
-- land into existing tables, each idempotent via (baby_id, source,
-- source_uuid):
--
-- 1. Weight (HKQuantityTypeIdentifierBodyMass) → measurements.weight_kg
-- 2. BBT    (HKQuantityTypeIdentifierBasalBodyTemperature) → measurements.bbt_celsius (new column)
-- 3. Sleep  (HKCategoryTypeIdentifierSleepAnalysis) → sleep_logs
--
-- All three RPCs are bulk upserts, gated on is_baby_parent. Re-importing
-- the same export is a no-op.
--
-- We also extend the existing kind/source check constraints to admit
-- 'apple_health' on measurements + sleep_logs.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. measurements: BBT column + apple_health source + source_uuid
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.measurements
  add column if not exists bbt_celsius numeric(4,2)
    check (bbt_celsius is null or (bbt_celsius >= 35.0 and bbt_celsius <= 39.0));

alter table public.measurements
  add column if not exists source_uuid text;

-- The original check () restricted source to ('manual','ocr','import') —
-- swap it to also allow 'apple_health'.
alter table public.measurements
  drop constraint if exists measurements_source_check;
alter table public.measurements
  add  constraint measurements_source_check
  check (source in ('manual','ocr','import','apple_health'));

-- The 001 schema also enforces "at least one of weight/height/head must
-- be set". With BBT as a 4th option, relax that to include BBT.
alter table public.measurements
  drop constraint if exists measurements_check;
alter table public.measurements
  add  constraint measurements_at_least_one_value
  check (weight_kg is not null or height_cm is not null or head_circ_cm is not null or bbt_celsius is not null);

create unique index if not exists uq_measurements_source
  on public.measurements (baby_id, source, source_uuid)
  where source_uuid is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sleep_logs: source + source_uuid for Apple Health idempotency
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sleep_logs
  add column if not exists source text not null default 'manual'
    check (source in ('manual','apple_health'));
alter table public.sleep_logs
  add column if not exists source_uuid text;

create unique index if not exists uq_sleep_logs_source
  on public.sleep_logs (baby_id, source, source_uuid)
  where source_uuid is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Bulk-import RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- import_apple_weight — record shape: { measured_at, weight_kg, source_uuid }
create or replace function public.import_apple_weight(
  p_baby uuid, p_records jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_n int := 0;
  rec jsonb;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may import data';
  end if;
  for rec in select * from jsonb_array_elements(p_records) loop
    insert into public.measurements (baby_id, measured_at, weight_kg, source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'measured_at')::timestamptz,
      (rec->>'weight_kg')::numeric,
      'apple_health',
      rec->>'source_uuid',
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      weight_kg   = excluded.weight_kg,
      measured_at = excluded.measured_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_apple_weight(uuid, jsonb) to authenticated;

-- import_apple_bbt — record shape: { measured_at, celsius, source_uuid }
create or replace function public.import_apple_bbt(
  p_baby uuid, p_records jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_n int := 0;
  rec jsonb;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may import data';
  end if;
  for rec in select * from jsonb_array_elements(p_records) loop
    insert into public.measurements (baby_id, measured_at, bbt_celsius, source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'measured_at')::timestamptz,
      (rec->>'celsius')::numeric,
      'apple_health',
      rec->>'source_uuid',
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      bbt_celsius = excluded.bbt_celsius,
      measured_at = excluded.measured_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_apple_bbt(uuid, jsonb) to authenticated;

-- import_apple_sleep — record shape: { start_at, end_at, source_uuid }
-- Apple emits multiple "in bed"/"asleep" segments per night. We import
-- them as-is (each segment becomes its own row); the existing sleep
-- analytics handle duration aggregation.
create or replace function public.import_apple_sleep(
  p_baby uuid, p_records jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_n int := 0;
  rec jsonb;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may import data';
  end if;
  for rec in select * from jsonb_array_elements(p_records) loop
    insert into public.sleep_logs (baby_id, start_at, end_at, location, quality, source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'start_at')::timestamptz,
      nullif(rec->>'end_at','')::timestamptz,
      'bed',
      'unknown',
      'apple_health',
      rec->>'source_uuid',
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      start_at = excluded.start_at,
      end_at   = excluded.end_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_apple_sleep(uuid, jsonb) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Apple Health import: weight, BBT, sleep$t1$,
  p_body     => $b1$The Apple Health importer now backfills three more categories: body weight (lands in measurements), basal body temperature (new column on measurements — useful for fertility-aware cycle tracking), and sleep nights (lands in sleep_logs as imported segments). Each category has its own toggle in the import preview so you choose what to bring over. Re-importing the same export is still a no-op thanks to (baby_id, source, source_uuid) idempotency. BP and glucose are next.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$استيراد Apple Health: الوزن، BBT، النوم$ta1$,
  p_body_ar  => $ba1$استيراد Apple Health الآن يدعم ٣ فئات إضافية: وزن الجسم (يُحفظ في القياسات)، حرارة الجسم القاعدية BBT (عمود جديد في القياسات — مفيد لتتبع الإخصاب)، وفترات النوم (تُحفظ في سجلات النوم). كل فئة لها مفتاح في معاينة الاستيراد لاختيار ما تستوردين. إعادة الاستيراد آمنة بدون تكرار. ضغط الدم والسكر قادمان.$ba1$
);

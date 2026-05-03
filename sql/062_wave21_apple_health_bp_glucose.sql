-- 062: Wave 21 — Apple Health import: blood pressure + blood glucose
-- ============================================================================
-- Closes the loop on the Apple Health importer. Two more categories now
-- land into existing tables, each idempotent via (baby_id, source,
-- source_uuid):
--
-- 1. BP      → vital_signs_logs (systolic + diastolic paired by start time)
-- 2. Glucose → blood_sugar_logs (mg/dL; mmol/L auto-converted client-side)
--
-- Both RPCs are bulk upserts, gated on is_baby_parent. Re-importing the
-- same export is a no-op.
--
-- We also add a `source` text column to both tables (default 'manual') so
-- existing UI keeps working, and a `source_uuid` text column for
-- idempotency. The unique partial index only covers rows that actually
-- carry a source_uuid — manual entries (NULL source_uuid) stay free of
-- the constraint.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. vital_signs_logs: source + source_uuid for Apple Health idempotency
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.vital_signs_logs
  add column if not exists source text not null default 'manual'
    check (source in ('manual','apple_health'));
alter table public.vital_signs_logs
  add column if not exists source_uuid text;

create unique index if not exists uq_vital_signs_source
  on public.vital_signs_logs (baby_id, source, source_uuid)
  where source_uuid is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. blood_sugar_logs: source + source_uuid for Apple Health idempotency
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.blood_sugar_logs
  add column if not exists source text not null default 'manual'
    check (source in ('manual','apple_health'));
alter table public.blood_sugar_logs
  add column if not exists source_uuid text;

create unique index if not exists uq_blood_sugar_source
  on public.blood_sugar_logs (baby_id, source, source_uuid)
  where source_uuid is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Bulk-import RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- import_apple_bp — record shape:
--   { measured_at, systolic, diastolic, source_uuid }
-- Apple emits BP as paired systolic+diastolic records with the same start
-- time. The client merges the pair and submits a single row per reading;
-- we simply upsert. Either value may be null when one side is missing,
-- but the existing chk_vital_signs_at_least_one constraint enforces at
-- least one is set, which paired BP always satisfies.
create or replace function public.import_apple_bp(
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
    insert into public.vital_signs_logs
      (baby_id, measured_at, bp_systolic, bp_diastolic, source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'measured_at')::timestamptz,
      nullif(rec->>'systolic','')::int,
      nullif(rec->>'diastolic','')::int,
      'apple_health',
      rec->>'source_uuid',
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      bp_systolic  = excluded.bp_systolic,
      bp_diastolic = excluded.bp_diastolic,
      measured_at  = excluded.measured_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_apple_bp(uuid, jsonb) to authenticated;

-- import_apple_glucose — record shape:
--   { measured_at, value_mgdl, source_uuid }
-- The client normalises mmol/L → mg/dL (× 18.0182) before submission so
-- the server only stores mg/dL — matching the existing schema.
create or replace function public.import_apple_glucose(
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
    insert into public.blood_sugar_logs
      (baby_id, measured_at, value_mgdl, meal_context, method, source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'measured_at')::timestamptz,
      (rec->>'value_mgdl')::numeric,
      'random',     -- Apple doesn't tag meal context; user can edit later.
      'finger_stick',
      'apple_health',
      rec->>'source_uuid',
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      value_mgdl  = excluded.value_mgdl,
      measured_at = excluded.measured_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_apple_glucose(uuid, jsonb) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Apple Health import: blood pressure + glucose$t1$,
  p_body     => $b1$Two more categories now flow in from your Apple Health export. Blood pressure pairs (systolic + diastolic at the same reading) land in vital signs. Blood glucose readings land in your sugar log — mmol/L auto-converts to mg/dL on the way in. With this wave the importer now covers periods, weight, BBT, sleep, BP, and glucose. Re-importing the same export is still a no-op thanks to (baby_id, source, source_uuid) idempotency. Live device sync (HealthKit, Google Fit) is the next chapter.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$استيراد Apple Health: ضغط الدم والسكر$ta1$,
  p_body_ar  => $ba1$استيراد Apple Health الآن يدعم فئتين إضافيتين: قراءات ضغط الدم (الانقباضي والانبساطي معاً تُحفظ في سجل المؤشرات الحيوية)، وقراءات سكر الدم (تُحفظ في سجل السكر — وحدات mmol/L تُحوَّل تلقائياً إلى mg/dL). الاستيراد يغطي الآن: الدورة، الوزن، BBT، النوم، الضغط، والسكر. إعادة الاستيراد آمنة بدون تكرار. المزامنة المباشرة من الأجهزة قادمة لاحقاً.$ba1$
);

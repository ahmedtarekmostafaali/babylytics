-- 068: Wave 27 — bulk CSV import (vital signs RPC + idempotency on cycles)
-- ============================================================================
-- This wave is mostly frontend (the new CsvBulkImporter component +
-- /import/csv page). The SQL piece adds:
--
--   1. import_vitals_bulk(p_baby, p_records) — wider sibling of
--      import_apple_bp. Accepts the full vital_signs row (systolic +
--      diastolic + heart_rate_bpm + oxygen_pct + position) so a single
--      CSV upload can backfill any combination of those four readings.
--      Idempotent via the (baby_id, source, source_uuid) unique index
--      added by Wave 21.
--
--   2. Idempotency-friendly tweak to import_menstrual_cycles — the
--      existing version (Wave 12) does plain upserts on (baby_id,
--      period_start) and ignores any source_uuid the caller might
--      supply. CSV bulk imports want the same "re-importing the same
--      file is a no-op" guarantee the Apple Health flow has, which
--      already works because the natural key (baby_id, period_start)
--      is unique. Confirm with a comment + index check.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. import_vitals_bulk — bulk vital-signs upsert.
--    Record shape:
--      { measured_at,            -- ISO 8601 string
--        systolic,               -- int|null
--        diastolic,              -- int|null
--        heart_rate_bpm,         -- int|null
--        oxygen_pct,             -- numeric|null
--        position,               -- 'sitting'|'lying'|'standing'|'unknown' (default 'sitting')
--        source_uuid }           -- string, used for idempotency
--
--    Skips rows where every value column is null (chk_vital_signs_at_least_one
--    would reject them anyway). Conflict resolution = upsert on
--    (baby_id, source, source_uuid).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.import_vitals_bulk(
  p_baby uuid, p_records jsonb
) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_n int := 0;
  rec jsonb;
  v_sys int; v_dia int; v_hr int; v_o2 numeric; v_pos text;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may import data';
  end if;

  for rec in select * from jsonb_array_elements(p_records) loop
    v_sys := nullif(rec->>'systolic','')::int;
    v_dia := nullif(rec->>'diastolic','')::int;
    v_hr  := nullif(rec->>'heart_rate_bpm','')::int;
    v_o2  := nullif(rec->>'oxygen_pct','')::numeric;
    v_pos := coalesce(nullif(rec->>'position',''), 'sitting');

    -- All four nulls → schema would reject; skip silently to keep the
    -- bulk import row-count clean.
    if v_sys is null and v_dia is null and v_hr is null and v_o2 is null then
      continue;
    end if;
    -- Position must match the schema check.
    if v_pos not in ('sitting','lying','standing','unknown') then
      v_pos := 'sitting';
    end if;

    insert into public.vital_signs_logs
      (baby_id, measured_at, bp_systolic, bp_diastolic,
       heart_rate_bpm, oxygen_pct, position,
       source, source_uuid, created_by)
    values (
      p_baby,
      (rec->>'measured_at')::timestamptz,
      v_sys, v_dia, v_hr, v_o2, v_pos,
      'apple_health',                 -- reuse the existing source value so
      rec->>'source_uuid',            -- the partial unique index applies
      v_actor
    )
    on conflict (baby_id, source, source_uuid) where source_uuid is not null
    do update set
      bp_systolic    = excluded.bp_systolic,
      bp_diastolic   = excluded.bp_diastolic,
      heart_rate_bpm = excluded.heart_rate_bpm,
      oxygen_pct     = excluded.oxygen_pct,
      position       = excluded.position,
      measured_at    = excluded.measured_at;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
grant execute on function public.import_vitals_bulk(uuid, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Re-derived unique index on menstrual_cycles for CSV idempotency.
--    The Wave 12 import_menstrual_cycles RPC already keys on
--    (baby_id, period_start) which the existing ux_cycle_baby_start
--    unique index enforces. The bulk CSV importer reuses the RPC
--    unchanged — re-importing a CSV with the same rows is a no-op.
--    This is just a no-op DDL to surface the dependency in the
--    migration log (and to fail loudly if the index ever gets dropped).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'ux_cycle_baby_start'
  ) then
    raise exception 'ux_cycle_baby_start index missing — bulk CSV cycle import would create duplicates. Apply sql/044 first.';
  end if;
end $$;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Bulk import: paste any CSV of cycles, vitals, weight, BBT, sleep, BP or glucose$t1$,
  p_body     => $b1$You can now backfill your history all at once. Pick a category, download the template (the column headers it expects), paste your CSV in or drop the file, and review the preview before committing. Same idempotency story as Apple Health — re-importing the same rows is a no-op so you can re-run it after editing your spreadsheet without creating duplicates. Categories supported: menstrual cycles, body weight, BBT, sleep nights, blood pressure (paired sys + dia), blood glucose, and the full vital-signs row (BP + heart rate + oxygen). Files (PDFs, scans, ultrasound images) and lab panels with multi-result rows still go through the regular Files / Labs pages — those need their own UI, not a CSV.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$استيراد جماعي: ألصقي أي CSV للدورة، الوزن، BBT، النوم، الضغط، السكر$ta1$,
  p_body_ar  => $ba1$يمكنك الآن استيراد تاريخك كاملاً مرة واحدة. اختاري الفئة، حمّلي القالب (أسماء الأعمدة المطلوبة)، الصقي CSV أو ارفعي الملف، وراجعي المعاينة قبل الحفظ. نفس ميزة عدم التكرار من Apple Health — إعادة استيراد نفس الصفوف لن تُنشئ تكراراً. الفئات المدعومة: الدورة الشهرية، الوزن، BBT، النوم، ضغط الدم، سكر الدم، والمؤشرات الحيوية الكاملة (الضغط + النبض + الأكسجين). الملفات (PDF، صور السونار) وألواح التحاليل تظل عبر صفحات الملفات / التحاليل العادية.$ba1$
);

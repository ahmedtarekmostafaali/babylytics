-- 069: Wave 28 — bulk multi-file upload (release-note only)
-- ============================================================================
-- No schema changes. The medical_files table already supports every
-- kind the bulk uploader exposes (prescription, report, lab_report,
-- ultrasound, prenatal_lab, maternal_vitals, genetic_screening,
-- birth_plan, admission_report, discharge_report, daily_note, other —
-- via the constraint set by sql/015). Storage RLS already gates
-- writes by has_baby_access(baby_id_from_storage_path).
--
-- All work is in the new BulkFileUploader component +
-- /babies/[id]/import/files page route.
--
-- Idempotent (no DDL).

select public.publish_app_update(
  p_title    => $t1$Bulk file upload: drag a folder of scans, labs, or reports$t1$,
  p_body     => $b1$Drop a stack of files onto one screen and Babylytics handles the rest. Drag a folder of ultrasound PDFs, lab reports, or prescriptions, or pick them via the file picker — up to 50 files per batch. Each file's kind (ultrasound / lab / prescription / etc.) is auto-guessed from the filename and you can override per-file before committing. Files upload sequentially with per-file progress and a final summary. OCR is NOT run automatically on bulk uploads — open any file's page later to trigger OCR if you want the contents extracted. This keeps the bulk path fast even with 50 files. Tabular data (cycles, vitals, weight, BBT, sleep, BP, glucose) still goes through the Bulk CSV import page.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$رفع ملفات بالجملة: اسحبي مجلد سونار أو تحاليل أو تقارير$ta1$,
  p_body_ar  => $ba1$ارفعي عدة ملفات دفعة واحدة. اسحبي مجلد ملفات سونار، تحاليل، أو روشتات (حتى ٥٠ ملف في الدفعة الواحدة). نوع كل ملف يُخمَّن تلقائياً من الاسم ويمكنك تعديله قبل الحفظ. الرفع يتم بالتسلسل مع شريط تقدم لكل ملف وملخص نهائي. لا يتم تشغيل OCR تلقائياً في الرفع الجماعي للحفاظ على السرعة — افتحي صفحة الملف لتشغيل OCR عليه لاحقاً إذا أردت. البيانات الجدولية (الدورة، الوزن، الضغط، إلخ) تظل عبر صفحة الاستيراد الجماعي بصيغة CSV.$ba1$
);

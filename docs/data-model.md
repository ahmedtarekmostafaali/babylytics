# Data model

```
auth.users ───┬── profiles (1:1)
              │
              └── baby_users (M:N) ─── babies ──┬── feedings            (TIMESTAMPTZ)
                                                 ├── stool_logs         (TIMESTAMPTZ)
                                                 ├── medications
                                                 │     └── medication_logs (TIMESTAMPTZ)
                                                 ├── measurements       (TIMESTAMPTZ)
                                                 ├── medical_files
                                                 │     └── extracted_text (OCR output, never auto-applied)
                                                 └── notifications
                          audit_log (append-only, per-column history)
```

## Conventions

- **All time fields are `TIMESTAMPTZ`**. Never `DATE`. This enables multiple events per day and hourly analytics.
- **Soft delete** via `deleted_at TIMESTAMPTZ` on everything user-editable. Partial indexes filter `WHERE deleted_at IS NULL`.
- **Audit** via `updated_at` trigger + per-column `audit_log` trigger on mutable tables.
- **Source tracking** — every log row carries `source IN ('manual','ocr','import')` and a nullable `source_file_id` so you can trace an OCR-originated feeding back to the file and the extraction that produced it.
- **Money / quantities** — numeric with explicit scale. `weight_kg numeric(5,3)`, `quantity_ml numeric(6,1)`, `head_circ_cm numeric(5,2)`, …

## Key tables

### babies
- `feeding_factor_ml_per_kg_per_day numeric default 150` — per-baby tunable.
- `dob timestamptz` — exact birth time matters for first-day feeding math.

### baby_users
- Composite PK `(baby_id, user_id)`.
- `role IN ('owner','editor','viewer')`.
- This is the authorization table — every RLS policy eventually routes through it.

### feedings / stool_logs / medication_logs / measurements
- `(baby_id, <event_time>) DESC` partial index `WHERE deleted_at IS NULL` — lights up every dashboard query.
- `source_file_id` FK to `medical_files(id) ON DELETE SET NULL`.

### medications
- Prescription-level. `frequency_hours` + `starts_at` + `ends_at` drive the *expected doses* calculation in `medication_kpis`.

### medical_files
- Path convention: `babies/{baby_id}/{kind}/{filename}`. Storage RLS uses this.
- `ocr_status IN ('pending','processing','extracted','reviewed','confirmed','failed')`.

### extracted_text
- One row per OCR attempt. Multiple attempts per file are fine — latest wins in the UI but all history is kept.
- `structured_data jsonb` — edited payload is saved back on confirm, so you can always compare against earlier attempts.
- `flag_low_confidence` is a generated column (`< 0.7`) for cheap filtering.
- `status IN ('extracted','reviewed','confirmed','discarded')` tracks the lifecycle.

### audit_log
- Append-only. One row per `(table_name, row_id, column_name)` change.
- Used by the UI to show "changed from X to Y" if we ever need a field-level history view.

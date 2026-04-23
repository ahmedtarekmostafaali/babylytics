# OCR pipeline

The OCR path is: **upload → extract → review → confirm → domain tables**. The review step is mandatory — nothing ever lands in `feedings / stool_logs / medications / medication_logs / measurements` without a human confirmation.

## Sequence

```
UI (UploadForm)
  │ 1. Supabase Storage upload → babies/{baby}/{kind}/{token}_{filename}
  │ 2. insert into medical_files (ocr_status='pending')
  │ 3. invoke('ocr-extract', { file_id })
  ▼
Edge Function: ocr-extract
  │ 4. verify access by reading medical_files with caller's JWT (RLS)
  │ 5. flip medical_files.ocr_status = 'processing'
  │ 6. download bytes with service-role key
  │ 7. call provider (Anthropic by default)
  │ 8. insert extracted_text (status='extracted')
  │ 9. flip medical_files.ocr_status = 'extracted'
  │ 10. if confidence < 0.7 → insert notifications('low_ocr_confidence')
  ▼
UI (OcrReview)
  │ 11. load extracted_text + structured_data
  │ 12. user edits rows freely
  │ 13. CONFIRM → rpc confirm_extracted_text(extracted_id, payload)
  ▼
Postgres (confirm_extracted_text)
  │ 14. insert feedings / stool_logs / measurements / medication_logs
  │ 15. mark extracted_text.status = 'confirmed'
  │ 16. flip medical_files.ocr_status = 'confirmed'
```

## Providers

Configured via the Edge Function's `OCR_PROVIDER` secret and overridable per-request by passing `{ provider: "google" | "anthropic" }` in the invoke body.

| Provider     | Best for                    | Handwriting | Arabic | Structured JSON |
|--------------|-----------------------------|:----------:|:-----:|:---------------:|
| `anthropic`  | handwriting, mixed language |     ✅      |   ✅   |       ✅         |
| `google`     | printed scans, large volume |     △      |   ✅   |       ❌ (text only) |
| `tesseract`  | not supported in Edge Fn    |     —      |   —   |       —          |

## Prompt design (Anthropic)

The Claude prompt does three things in one call:

1. Transcribes all visible text verbatim into `raw_text` (keeps the original script, so Arabic numerals stay Arabic until the UI standardizes).
2. Extracts structured events (`feedings`, `stools`, `measurements`, `medication_logs`) with ISO-8601 timestamps and ml/kg/cm units. Converts oz → ml.
3. Self-reports `confidence_score ∈ [0,1]` and `is_handwritten`.

The prompt is tuned for English + Arabic + French + code-switching daily care notes — typical in Middle-Eastern pediatric settings and trilingual households.

## Low-confidence handling

- `extracted_text.flag_low_confidence` is a generated column = `confidence_score < 0.7`.
- The Edge Function pushes a `low_ocr_confidence` notification to all caregivers.
- The dashboard surfaces an amber banner with a direct link to the review screen.
- In the review UI, rows are styled with warning tone when the overall confidence is low.

## Auditability

Even after confirmation the domain rows remain fully editable. Every change creates one audit row per changed column in `audit_log` with `original_value`, `edited_value`, `edited_by`, `edited_at`. The original OCR attempt remains in `extracted_text` with `structured_data` holding the edited version the user confirmed — you can always compare against earlier attempts on the same file.

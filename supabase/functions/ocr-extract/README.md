# Edge Function: `ocr-extract`

Turns an uploaded `medical_files` row into a reviewable `extracted_text` row.
Never writes to domain tables — that only happens when the user hits
**Confirm** in the OCR review screen (calls `confirm_extracted_text` RPC).

## Deploy

```bash
# once per project
supabase link --project-ref <your-ref>

# deploy
supabase functions deploy ocr-extract --no-verify-jwt=false

# secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OCR_PROVIDER=anthropic            # or "google"
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-6 # optional
# optional fallback:
supabase secrets set GOOGLE_VISION_API_KEY=AIza...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## Invoke

```ts
const { data } = await supabase.functions.invoke('ocr-extract', {
  body: { file_id: '<uuid from medical_files>' }
});
// -> { ok, extracted_id, confidence_score, flag_low_confidence, provider }
```

## Security

Caller's JWT is forwarded to a user-scoped Supabase client that reads
`medical_files` under RLS — so if the caller does not have access to the
baby, the file is "not found" and nothing further happens. Storage bytes
are read by the service role because RLS doesn't apply to bytes streams;
the user-scoped read above is what proves access.

## Providers

- `anthropic` (default) — Claude vision; strong on handwriting + Arabic;
  returns both raw transcript *and* structured JSON in one call.
- `google` — Google Cloud Vision DOCUMENT_TEXT_DETECTION; transcript only.
  Good for printed prescription scans. User fills structured fields by hand
  or re-runs with Anthropic.
- `tesseract` — stubbed; Edge Functions are Deno and don't ship Tesseract
  binaries. Run it yourself on a separate worker if you want it.

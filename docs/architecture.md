# Architecture

```
  ┌────────────┐     HTTPS       ┌────────────────────────┐
  │  Browser   │ ───────────────▶│   Next.js on Vercel    │
  │ (mobile or │                 │  - Server Components   │
  │  desktop)  │◀────────────────│  - Server Actions      │
  └────────────┘   user session  │  - /api edge functions │
                                  └──────────┬─────────────┘
                                             │ SSR Supabase client
                                             ▼
                               ┌──────────────────────────┐
                               │        Supabase          │
                               │  - Postgres + RLS        │
                               │  - Auth (email/password) │
                               │  - Storage (medical-files)
                               │  - Edge Fn: ocr-extract  │
                               └──────────┬───────────────┘
                                          │ HTTPS + API key
                                          ▼
                               ┌──────────────────────────┐
                               │ Anthropic Claude vision  │
                               │ (swappable: Google, …)   │
                               └──────────────────────────┘
```

## Request paths

- **Page render** — a Server Component calls `createClient()` from `lib/supabase/server.ts`, which pulls the Supabase session from cookies. All DB queries then run under RLS as the signed-in user.
- **Mutation from a form** — the form is a Client Component calling `createClient()` from `lib/supabase/client.ts`. Anon key + session cookies + RLS enforce access.
- **File upload** — the browser uploads directly to Supabase Storage under `babies/{baby_id}/{kind}/…`. Storage RLS derives `baby_id` from the path and checks `baby_users`.
- **OCR** — the browser calls the `ocr-extract` Edge Function with `file_id`. The function verifies access by reading `medical_files` with the caller's JWT, then downloads the bytes with the service role, calls the provider, and writes an `extracted_text` row with `status='extracted'`. **It never writes to domain tables.**
- **OCR confirm** — when the user hits *Confirm* in the review UI, the client calls the `confirm_extracted_text(p_extracted, p_payload)` RPC. This is one transaction: it inserts the edited rows, marks the extraction `confirmed`, and flips the file's `ocr_status`.

## Data model summary

- **profiles** — 1 row per user, mirrors `auth.users`.
- **babies** — the tracked subject. Soft-deletable.
- **baby_users** — the authorization table. `(baby_id, user_id) → role`. Every RLS policy on domain tables fans out to `public.has_baby_access(baby_id)` / `public.has_baby_write(baby_id)`.
- **Domain tables** — `feedings`, `stool_logs`, `medications`, `medication_logs`, `measurements`. Everything time-series is `TIMESTAMPTZ` so we can support multiple events per day and hourly analytics.
- **medical_files** — Storage pointers (bucket + path).
- **extracted_text** — one row per OCR attempt. Stores raw transcript and structured JSON. `status` goes `extracted → reviewed → confirmed` (or `discarded`). **Never auto-applied.**
- **notifications** — in-app banner feed (medication due, low OCR confidence).
- **audit_log** — per-column change history for domain tables; the *source of truth* for `(original_value, edited_value, edited_at, edited_by)`.

## Observability and hardening

- `updated_at` triggers on every mutable table.
- Per-column audit trigger writes to `audit_log` on every `INSERT / UPDATE / DELETE`.
- Soft delete (`deleted_at`) on all user-owned data so nothing is ever truly lost.
- All RPCs are `SECURITY DEFINER` but start with a `has_baby_access` / `has_baby_write` / `is_baby_owner` check, so RLS is never bypassed silently.

## Scale assumption (v1)

< 100 babies, < 500 users. Single Supabase project, no partitioning. Views are live (not materialized). At > ~10k feedings per baby, convert `feeding_daily` and `stool_daily` to materialized views with a refresh cron.

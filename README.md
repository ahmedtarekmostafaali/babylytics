# Babylytics

Production-grade baby health tracking SaaS. Next.js on Vercel, Supabase for Postgres + Auth + Storage, with a Claude-powered OCR pipeline for handwritten daily reports in English, Arabic, and mixed notes.

## Feature surface (v1)

- Email/password auth via Supabase
- Multiple babies per user, multiple caregivers per baby with **owner / editor / viewer** roles
- Time-series logs: feeding, stool, medication, measurements (weight / height / head)
- File uploads: prescriptions, medical reports, stool images, handwritten daily notes
- OCR pipeline (Claude vision) → structured JSON → **mandatory human review** → save
- Full post-save editability with **per-field audit log** (original vs edited)
- Dashboard KPIs computed server-side via SQL RPCs (feeding %, recommended ml, stool summary, medication adherence, weight trend)
- Charts: feeding vs recommended, weight trend, stool trend
- In-app notification center (medication due, low-confidence OCR)
- All time fields are `TIMESTAMPTZ` — multiple events per day, hourly analytics
- Row Level Security on every table, access gated through `baby_users`

## Architecture

```
User → Next.js (Vercel) → Supabase (Postgres + Auth + Storage)
                                ↓
                         Edge Function: ocr-extract
                                ↓
                         Anthropic Claude vision
```

## Repo layout

```
/app            Next.js App Router pages
/components     React UI (shadcn-style primitives + feature components)
/lib            Supabase clients, types, KPI helpers, units, validators
/supabase       Edge Functions + migration symlinks
/sql            Numbered DDL migrations (schema, audit, RLS, functions, views, seed)
/docs           Architecture, RLS policy, OCR pipeline, KPI logic, deployment
middleware.ts   Auth gate for protected routes
```

## Quick start

```bash
# 1. Clone and install
git clone <your-fork> && cd Babylytics
npm install

# 2. Create a Supabase project (free tier is fine)
#    - copy Project URL and anon key into .env.local
cp .env.example .env.local
# fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# 3. Apply the schema
#    Paste each file in /sql in order into the Supabase SQL editor,
#    or use the Supabase CLI:
supabase db push

# 4. Create the Storage bucket
#    In Supabase Studio → Storage → New bucket → name: "medical-files",
#    private (not public). Policies are created by /sql/003_rls.sql.

# 5. Deploy the OCR Edge Function
supabase functions deploy ocr-extract
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 6. Run
npm run dev
```

See `/docs/deployment.md` for the full Vercel + Supabase deploy walkthrough.

## What ships vs what's phased

**In v1 (this repo):** every item in the spec — schema, RLS, OCR with human review, post-save editing with audit, KPI RPCs, dashboard, charts, role-based caregiver access, production-grade hardening (audit, soft delete, rate limit hook, observability).

**Phased for later:** multi-env CI/CD pipeline (v1 has single-env Vercel deploy), Arabic-first UI mirroring (strings work today, full RTL CSS in v2), ML growth prediction (the KPI layer already exposes the history endpoint it needs), push/email notifications (in-app banner is live).

## License

MIT — see LICENSE.

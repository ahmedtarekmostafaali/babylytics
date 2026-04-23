# Deployment

## 1. Create the Supabase project

- https://supabase.com → New project.
- Copy **Project URL** and **anon key** from *Project Settings → API*.
- Copy the **service_role** key too — needed for the Edge Function secret, not for the Next.js app.

## 2. Apply the schema

Either:

```bash
supabase link --project-ref <ref>
supabase db push     # pushes /sql migrations in order
```

or paste each file in `/sql` in order into the Supabase SQL Editor:

1. `001_schema.sql`
2. `002_audit.sql`
3. `003_rls.sql`
4. `004_functions.sql`
5. `005_views.sql`
6. `006_seed.sql` (optional, dev only)

## 3. Create the Storage bucket

- Supabase Studio → *Storage* → *New bucket*.
- Name: `medical-files`.
- **Private** (not public).
- Policies are created by `003_rls.sql` — they derive `baby_id` from the path and gate by `baby_users`.

## 4. Deploy the OCR Edge Function

```bash
supabase functions deploy ocr-extract
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OCR_PROVIDER=anthropic
# optional:
supabase secrets set GOOGLE_VISION_API_KEY=AIza...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-6
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

## 5. Deploy the Next.js app to Vercel

```bash
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel deploy --prod
```

Or push to GitHub and import the repo in the Vercel dashboard. `next.config.js` already whitelists `*.supabase.co` for image previews.

## 6. Wire up auth redirects (optional)

In Supabase → *Authentication → URL configuration* add:

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** `https://<your-app>.vercel.app/**`, `http://localhost:3000/**`

## 7. Smoke test

1. Register an account.
2. Create a baby.
3. Add a measurement (so `current_weight_kg` is non-zero and feeding recommendations are meaningful).
4. Log a feeding — check the dashboard updates.
5. Upload a handwritten daily note — you should land on the OCR review screen automatically.
6. Edit an extracted row and confirm — check the row appears in the feeding / stool / measurement list.
7. Invite a second user as `viewer` — log in as them and confirm they can see but not edit.

## CI/CD

A minimal GitHub Actions workflow that runs `npm ci && npm run lint && npm run typecheck && npm run build` on pull requests is enough for v1. Vercel's Git integration handles deploys. Multi-environment (staging + prod) is a v2 concern.

## Secrets hygiene

- Only `NEXT_PUBLIC_*` variables go into Vercel env + the client bundle.
- `SUPABASE_SERVICE_ROLE_KEY` lives only in Supabase secrets (Edge Function) and **never in Vercel**.
- `ANTHROPIC_API_KEY` lives only in Supabase secrets (Edge Function), **never in the Next.js app**.

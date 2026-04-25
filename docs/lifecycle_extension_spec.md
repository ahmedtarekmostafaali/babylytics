# Babylytics — Pregnancy → Newborn → Infant Lifecycle Extension

Design spec for extending the existing Babylytics schema (migrations 001–014) to support a pregnancy-tracking phase that evolves into newborn/infant on the same `baby_id`. Backward-compatible. Ships in 4 phases.

## Assumptions (so we can move fast)

- **Singleton pregnancy.** Twins/triplets deferred to Phase 5.
- **One row per fetus/baby across the lifecycle.** A pregnancy profile and the resulting newborn profile share the same `babies.id`. All prenatal data carries forward via `baby_id` FK.
- **Maternal data sits in a sidecar table** (`pregnancy_profile`) so `babies` doesn't bloat with mother-vs-baby ambiguity.
- **All post-birth tables** (feedings, stool, sleep, medications, measurements, temperature, vaccinations, lab_panels, doctors, appointments, comments, medical_files) **are reused unchanged**. They simply have zero rows during pregnancy.
- **Prenatal-specific tables** are added only where reuse is awkward (visits, ultrasounds, kick counts).

---

## 1. Minimal database changes

### 1.1 Modify `babies` (delta against `001_schema.sql` + `009_sleep_roles_doctor.sql`)

```sql
-- 015_pregnancy_lifecycle.sql

-- a) make dob nullable for pregnancy-stage profiles (CRITICAL)
alter table public.babies alter column dob drop not null;

-- b) lifecycle stage column
alter table public.babies
  add column if not exists lifecycle_stage text not null default 'infant'
    check (lifecycle_stage in ('pregnancy','newborn','infant','toddler','child','archived'));

-- c) prenatal-only fields kept lightweight (rest lives on pregnancy_profile)
alter table public.babies
  add column if not exists edd date,                        -- estimated due date
  add column if not exists lmp date,                        -- last menstrual period
  add column if not exists conception_method text
    check (conception_method in ('natural','ivf','iui','icsi','other') or conception_method is null);

-- d) index for stage filtering on the dashboard
create index if not exists idx_babies_lifecycle_stage on public.babies(lifecycle_stage)
  where deleted_at is null;
```

### 1.2 New tables

```sql
-- 1) pregnancy_profile — sidecar 1:1 with babies, holds maternal context
create table if not exists public.pregnancy_profile (
    baby_id              uuid primary key references public.babies(id) on delete cascade,
    mother_dob           date,
    mother_blood_type    text,
    gravida              integer check (gravida >= 0 and gravida <= 30),
    para                 integer check (para    >= 0 and para    <= 30),
    pre_pregnancy_weight_kg numeric(5,2),
    pre_pregnancy_height_cm numeric(5,1),
    risk_factors         text,    -- free text: GDM, preeclampsia, RH-, etc.
    notes                text,
    updated_by           uuid references auth.users(id),
    updated_at           timestamptz not null default now()
);

-- 2) prenatal_visits — every OB / midwife appointment with vitals captured
create table if not exists public.prenatal_visits (
    id                   uuid primary key default gen_random_uuid(),
    baby_id              uuid not null references public.babies(id) on delete cascade,
    visited_at           timestamptz not null,
    gestational_week     integer check (gestational_week between 0 and 45),
    gestational_day      integer check (gestational_day between 0 and 6),
    maternal_weight_kg   numeric(5,2),
    bp_systolic          integer check (bp_systolic between 50 and 260),
    bp_diastolic         integer check (bp_diastolic between 30 and 180),
    fetal_heart_rate_bpm integer check (fetal_heart_rate_bpm between 50 and 250),
    fundal_height_cm     numeric(4,1),
    doctor_id            uuid references public.doctors(id) on delete set null,
    file_id              uuid references public.medical_files(id) on delete set null,
    notes                text,
    created_by           uuid not null references auth.users(id),
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    deleted_at           timestamptz
);
create index if not exists idx_prenatal_visits_baby on public.prenatal_visits(baby_id, visited_at desc)
  where deleted_at is null;

-- 3) ultrasounds — biometrics from each scan
create table if not exists public.ultrasounds (
    id                   uuid primary key default gen_random_uuid(),
    baby_id              uuid not null references public.babies(id) on delete cascade,
    scanned_at           timestamptz not null,
    gestational_week     integer check (gestational_week between 0 and 45),
    gestational_day      integer check (gestational_day between 0 and 6),
    bpd_mm               numeric(5,1),     -- biparietal diameter
    hc_mm                numeric(5,1),     -- head circumference
    ac_mm                numeric(5,1),     -- abdominal circumference
    fl_mm                numeric(5,1),     -- femur length
    efw_g                numeric(7,1),     -- estimated fetal weight
    fhr_bpm              integer check (fhr_bpm between 50 and 250),
    placenta_position    text,
    amniotic_fluid       text,             -- normal / oligo / poly + AFI when known
    sex_predicted        text check (sex_predicted in ('male','female','undetermined') or sex_predicted is null),
    anomalies            text,
    summary              text,
    file_id              uuid references public.medical_files(id) on delete set null,
    created_by           uuid not null references auth.users(id),
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now(),
    deleted_at           timestamptz
);
create index if not exists idx_ultrasounds_baby on public.ultrasounds(baby_id, scanned_at desc)
  where deleted_at is null;

-- 4) fetal_movements — kick counter sessions
create table if not exists public.fetal_movements (
    id                   uuid primary key default gen_random_uuid(),
    baby_id              uuid not null references public.babies(id) on delete cascade,
    counted_at           timestamptz not null,
    duration_min         integer not null check (duration_min > 0 and duration_min <= 240),
    movements            integer not null check (movements >= 0 and movements <= 999),
    notes                text,
    created_by           uuid not null references auth.users(id),
    created_at           timestamptz not null default now(),
    deleted_at           timestamptz
);
create index if not exists idx_fetal_movements_baby on public.fetal_movements(baby_id, counted_at desc)
  where deleted_at is null;
```

### 1.3 Extend reused tables for clean scoping

```sql
-- distinguish maternal vs baby meds without a separate table
alter table public.medications add column if not exists for_party text
  check (for_party in ('mother','baby')) default 'baby';

-- prenatal labs reuse lab_panels but flag clearly
alter table public.lab_panels add column if not exists is_prenatal boolean not null default false;

-- new file kinds for prenatal docs
alter table public.medical_files drop constraint if exists medical_files_kind_check;
alter table public.medical_files add constraint medical_files_kind_check
  check (kind in (
    'prescription','report','stool_image','daily_note','other',
    'admission_report','discharge_report','lab_report',
    -- prenatal additions
    'ultrasound','prenatal_lab','maternal_vitals','genetic_screening','birth_plan'
  ));
```

### 1.4 RLS — same model as migration 014 (parent-write, member-read)

```sql
alter table public.pregnancy_profile enable row level security;
alter table public.prenatal_visits   enable row level security;
alter table public.ultrasounds       enable row level security;
alter table public.fetal_movements   enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['pregnancy_profile','prenatal_visits','ultrasounds','fetal_movements']) loop
    execute format('drop policy if exists %1$s_member_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_parent_write on public.%1$s', t);
    execute format('create policy %1$s_member_select on public.%1$s for select using (public.has_baby_access(baby_id))', t);
    execute format('create policy %1$s_parent_write on public.%1$s for all using (public.is_baby_parent(baby_id)) with check (public.is_baby_parent(baby_id))', t);
  end loop;
end $$;
```

### 1.5 Triggers

`touch_updated_at` on all four new tables. `audit_row_change` on every table **except `pregnancy_profile`** (PK = baby_id, would null-violate `audit_log.row_id` — same gotcha as `care_plan`).

---

## 2. Lifecycle logic

### Stages

| Stage | Trigger | dob? | Notes |
|---|---|---|---|
| `pregnancy` | user picks "I'm pregnant" on creation | NULL | EDD/LMP required |
| `newborn` | `mark_as_born` RPC | set | age ≤ 28 days |
| `infant` | auto from dob | set | 29 d – 12 mo |
| `toddler` | auto from dob | set | 12 – 36 mo (future UI; data lives) |
| `child` | auto from dob | set | 36 + mo (future UI) |
| `archived` | manual; pregnancy ended without live birth | nullable | sensitive UX, design separately |

### Transition rules

- `pregnancy → newborn` is the **only explicit transition** (user clicks "Mark as born").
- `newborn → infant → toddler → child` is **derived from dob age at read time**. No cron needed.
- Stored `lifecycle_stage` is the highest stage the user has acknowledged. Effective stage is computed live by an RPC.

```sql
create or replace function public.effective_lifecycle_stage(p_baby uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when b.lifecycle_stage = 'pregnancy' then 'pregnancy'
    when b.lifecycle_stage = 'archived'  then 'archived'
    when b.dob is null                   then 'pregnancy'
    when (current_date - b.dob) <= 28    then 'newborn'
    when (current_date - b.dob) <= 365   then 'infant'
    when (current_date - b.dob) <= 1095  then 'toddler'
    else 'child'
  end
  from public.babies b where b.id = p_baby;
$$;
grant execute on function public.effective_lifecycle_stage(uuid) to authenticated;
```

### "Mark as Born" — single transactional RPC

```sql
create or replace function public.mark_baby_born(
  p_baby uuid,
  p_dob timestamptz,
  p_birth_weight_kg numeric default null,
  p_birth_height_cm numeric default null,
  p_head_circ_cm numeric default null,
  p_gender text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'forbidden';
  end if;

  update public.babies set
    dob              = p_dob::date,
    birth_weight_kg  = coalesce(p_birth_weight_kg, birth_weight_kg),
    birth_height_cm  = coalesce(p_birth_height_cm, birth_height_cm),
    gender           = coalesce(p_gender, gender),
    lifecycle_stage  = 'newborn',
    updated_at       = now()
  where id = p_baby and deleted_at is null;

  -- seed an initial measurement so growth charts have a starting point
  if p_birth_weight_kg is not null or p_birth_height_cm is not null or p_head_circ_cm is not null then
    insert into public.measurements(baby_id, measured_at, weight_kg, height_cm, head_circ_cm, created_by)
      values (p_baby, p_dob, p_birth_weight_kg, p_birth_height_cm, p_head_circ_cm, auth.uid());
  end if;
end $$;
grant execute on function public.mark_baby_born(uuid, timestamptz, numeric, numeric, numeric, text) to authenticated;
```

### Required-at-transition fields

When the user clicks "Mark as Born":
- **Required:** dob (default = now), gender (was optional before; some schools of thought require it for newborn growth charts — keep optional, default 'unspecified').
- **Recommended (UI nudge, not enforced):** birth weight, birth height, head circumference. These seed the first row in `measurements`.

### What changes vs. what stays

- **Changes:** `babies.lifecycle_stage`, `babies.dob`, optionally birth measurements / gender.
- **Stays:** `pregnancy_profile`, `prenatal_visits`, `ultrasounds`, `fetal_movements`, prenatal `medications` (`for_party='mother'`), prenatal `lab_panels` (`is_prenatal=true`), prenatal `medical_files`, `comments`, `doctors`, `appointments`. Same `baby_id`, all queryable post-birth from the Pregnancy archive.

---

## 3. Data model integration

### Reuse map

| Use case | Existing table | Schema change |
|---|---|---|
| Maternal medications | `medications` | + `for_party text` (default `'baby'`) |
| Prenatal labs | `lab_panels`, `lab_panel_items` | + `is_prenatal boolean` |
| OB / midwife as a doctor | `doctors` | none |
| Prenatal appointments | `appointments` | none |
| Comments / journal | `comments` | none |
| Documents (US PDFs, lab scans, birth plan) | `medical_files` | + 5 new `kind` values |
| OCR | `extracted_text` | none — classifier learns new kinds |

### New domain — minimum needed

- `pregnancy_profile` — maternal context (one row per baby).
- `prenatal_visits` — what `appointments` doesn't capture: BP, weight, FHR, fundal height (these are *measurements taken at* a visit; storing them on `appointments` would muddy that table).
- `ultrasounds` — specialized biometrics (BPD/HC/AC/FL/EFW); don't fit `measurements` and don't fit `lab_panels` cleanly.
- `fetal_movements` — kick counts; small & high-write, deserves its own table.

### Document linkage

```
medical_files
 ├─ kind='ultrasound'         → ultrasounds.file_id
 ├─ kind='prenatal_lab'       → lab_panels.file_id (is_prenatal=true)
 ├─ kind='maternal_vitals'    → prenatal_visits.file_id
 ├─ kind='genetic_screening'  → lab_panels.file_id
 ├─ kind='birth_plan'         → standalone (linked via comments/notes)
 └─ kind='admission/discharge_report' → admissions/discharges.file_id (existing)
```

OCR pipeline (Anthropic edge function) gets two new doc-type prompts: `ultrasound` and `prenatal_lab`. Output structures map 1:1 to `ultrasounds` columns / `lab_panel_items` rows for review-and-confirm pre-fill.

---

## 4. UI / UX adaptation

### Onboarding (`/babies/new`)

Current: name → dob → gender → birth weight.
New step 0: **stage picker** — "I'm pregnant" or "Already born".

- **Pregnancy path:** name (optional), EDD or LMP (EDD = LMP + 280d if EDD missing), conception_method (optional), pre-pregnancy weight (optional). No DOB.
- **Born path:** unchanged.

### Sidebar nav — switches by `effective_lifecycle_stage(baby_id)`

| Group | Pregnancy | Newborn / Infant / Toddler |
|---|---|---|
| HOME | Dashboard | Dashboard |
| TRACK | Prenatal visits, Ultrasounds, Maternal vitals (BP, weight), Kick counter, Medications (mother), Lab panels (prenatal) | Feedings, Stool, Medications, Measurements, Temperature, Sleep, Vaccinations |
| TOOLS | Smart Scan, Medical Profile (incl. Pregnancy archive section), Reports | (unchanged) |
| SETTINGS | Doctors, Caregivers, Profile | (unchanged) |

The sidebar reads stage once on baby switch (already does for role); nav items map by a `byStage[]` config.

### Dashboard adaptation

**Pregnancy dashboard** replaces the KPI grid:
- Gestational age (weeks + days) · trimester pill
- Days until EDD · countdown
- Maternal weight gain since first visit · IOM band overlay (Phase 4)
- Latest BP · color-coded
- Latest fetal HR · last visit or US
- Kick count today · alert if low after 28w
- "Mark as Born" CTA (always present; prominent in last 4 weeks before EDD)
- Sparklines: maternal weight, BP, fundal height, EFW
- Latest ultrasound thumbnail
- Next appointment card (existing component, just filtered)

**Newborn / Infant dashboard:** unchanged. Add small "Pregnancy archive" tile if `pregnancy_profile` row exists.

### Empty states

Pregnancy first-load: 3 inline cards prompting "Add first prenatal visit", "Add first ultrasound", "Set EDD if not yet". Use the same `WelcomeCard` pattern as the post-birth flow.

### Pregnancy history post-birth

- Sidebar → Tools → Medical Profile → new "Pregnancy history" section, read-only, includes pregnancy_profile, all prenatal_visits, all ultrasounds, kick-count chart, prenatal labs, maternal medications.
- Included in the Medical Profile PDF/PNG export.

### Display-layer guards (touch every place that reads `dob`)

- `lib/dates.ts: ageInDays`, `prettyAge`, `fmtDate(dob)` — all need null-safe wrappers.
- New helper `prettyStage(baby): string` returns `"Expecting · 22w 4d · EDD Jul 12"` or `"3m 4d"` depending on stage.
- `Sidebar` baby card → renders `prettyStage`.
- `BabyHeader` → renders `prettyStage`.
- Any chart/KPI with a `dob`-derived axis must check `effective_lifecycle_stage` first.

---

## 5. KPIs & trackers

### Pregnancy KPIs (dashboard cards)

1. **Gestational age** — `weeks + days` from EDD (or LMP). Trimester chip.
2. **EDD countdown** — days remaining (negative = past due).
3. **Maternal weight gain** — Δkg vs. pre-pregnancy weight (or first visit). IOM band overlay (Phase 4).
4. **Latest BP** — color-coded: <120/<80 normal · 120–139 / 80–89 elevated · ≥140/≥90 hypertensive.
5. **Latest fetal HR** — most recent of (last visit, last US).
6. **Kick count today** — sum from `fetal_movements`. Flag if GA ≥ 28w and any 2-h window < 10.

### Pregnancy trends

- Maternal weight over time vs. recommended band (line chart).
- BP over time (systolic + diastolic, threshold lines at 120/80 and 140/90).
- Fundal height vs. gestational week (rule of thumb: ≈1 cm per week).
- Ultrasound EFW progression (g) with growth percentiles (Phase 4 — needs reference curves).

### Newborn / Infant KPIs

Reuse existing — feeding totals, stool count, sleep hours, weight percentile, vaccination adherence. Add **"Days since birth"** card on the newborn dashboard (replaces gestational age card).

### Passive alerts (via existing `notifications` table)

- Missed prenatal visit · no visit in last 4 weeks after week 12.
- Reduced fetal movement · today's kicks below threshold for current GA.
- BP elevated · ≥140/90 latest reading → "Contact your provider".
- EDD passed without "Mark as born" · after 41w prompt.

---

## 6. Migration plan

### Phase 0 — backward compat (day 0 deploy)

1. Run migration 015 (sections 1.1–1.5).
2. Backfill `lifecycle_stage` for existing babies:
   ```sql
   update public.babies
     set lifecycle_stage = case
       when dob is null                  then 'pregnancy'
       when (current_date - dob) <= 28   then 'newborn'
       when (current_date - dob) <= 365  then 'infant'
       when (current_date - dob) <= 1095 then 'toddler'
       else 'child'
     end
     where lifecycle_stage = 'infant';   -- only the default-set rows
   ```
3. Existing UI keeps working — every code path still treats `dob` as present (only newly created pregnancy rows have null).

### Phase 1 — pregnancy onboarding

- Stage picker on `/babies/new`.
- New pages under `/babies/[id]/prenatal/...`.
- Sidebar nav reads `effective_lifecycle_stage`.
- Pregnancy dashboard.

### Phase 2 — Mark as Born

- Wire `mark_baby_born` RPC behind a server action / API route.
- "Mark as Born" CTA + post-transition birth-details prompt.

### Phase 3 — post-birth archive

- Pregnancy history section under Medical Profile.
- Included in PDF export.

### Phase 4 — smart additions

- OCR classifier prompts for `ultrasound` + `prenatal_lab`.
- Week-by-week static copy.
- IOM weight gain bands.

### Backward-compatibility checklist

| Concern | Status |
|---|---|
| Existing rows missing `lifecycle_stage` | Default `infant`, then backfilled to correct stage in step 2 above. |
| Existing code reads `babies.dob` as non-null | All existing rows have dob; only newly created pregnancy rows are null. Add null guards in `lib/dates.ts` regardless. |
| Existing reports / exports | Untouched for stages `newborn`/`infant`/`toddler`/`child`. New "Pregnancy archive" added at the bottom of Medical Profile only when a pregnancy_profile row exists. |
| RLS on existing tables | Untouched. New tables follow the same `is_baby_parent / has_baby_access` pattern. |
| OCR pipeline | Reused. Phase 4 adds two new doc-type prompts. |
| Mobile / cached clients | Old responses lack `lifecycle_stage`; client-side default = `'infant'`. |

---

## 7. API changes

Babylytics is Next.js + Supabase, so most CRUD is direct Supabase row access via RLS. New surface:

### Supabase RPCs

```
mark_baby_born(p_baby, p_dob, p_birth_weight_kg, p_birth_height_cm, p_head_circ_cm, p_gender)
  → void
  Atomic transition. Updates babies, seeds first measurement.

effective_lifecycle_stage(p_baby) → text
  Reads stored stage, auto-promotes by dob age.

prenatal_summary(p_baby) → record
  → { gestational_week_days, edd_distance_days, latest_bp_systolic,
      latest_bp_diastolic, latest_fhr, latest_weight_kg, weight_gain_kg,
      kicks_today, ultrasound_count }
  Used by the pregnancy dashboard so we don't N+1-query.
```

### Direct Supabase tables (gated by RLS)

- `pregnancy_profile`, `prenatal_visits`, `ultrasounds`, `fetal_movements`
- `medications` with new `for_party`
- `lab_panels` with new `is_prenatal`

### Next.js routes (new)

```
GET  /babies/[id]/prenatal                              — pregnancy dashboard
GET  /babies/[id]/prenatal/visits                       — list + add
GET  /babies/[id]/prenatal/visits/new                   — form
GET  /babies/[id]/prenatal/visits/[id]                  — edit
GET  /babies/[id]/prenatal/ultrasounds                  — list + add
GET  /babies/[id]/prenatal/ultrasounds/new
GET  /babies/[id]/prenatal/ultrasounds/[id]
GET  /babies/[id]/prenatal/kicks                        — kick counter UI
GET  /babies/[id]/prenatal/maternal-vitals              — BP + weight log
POST /api/babies/[id]/mark-as-born                      — wraps mark_baby_born RPC
```

### Example payloads

**`POST /api/babies/[id]/mark-as-born`**
```json
{
  "dob": "2026-04-25T13:42:00Z",
  "birth_weight_kg": 3.4,
  "birth_height_cm": 51,
  "head_circ_cm": 35,
  "gender": "female"
}
→ 200 { "ok": true, "baby_id": "f41f...", "lifecycle_stage": "newborn" }
```

**`POST` to `prenatal_visits` (via supabase-js)**
```json
{
  "baby_id": "f41f...",
  "visited_at": "2026-04-15T10:00:00Z",
  "gestational_week": 28,
  "gestational_day": 3,
  "maternal_weight_kg": 68.4,
  "bp_systolic": 118,
  "bp_diastolic": 76,
  "fetal_heart_rate_bpm": 142,
  "fundal_height_cm": 28.5,
  "doctor_id": "...",
  "notes": "OGTT ordered."
}
```

**`POST` to `ultrasounds`**
```json
{
  "baby_id": "f41f...",
  "scanned_at": "2026-04-20T14:00:00Z",
  "gestational_week": 29,
  "gestational_day": 1,
  "bpd_mm": 75.2, "hc_mm": 270.4, "ac_mm": 245.0, "fl_mm": 55.1,
  "efw_g": 1350, "fhr_bpm": 144,
  "placenta_position": "anterior fundal",
  "amniotic_fluid": "normal (AFI 14)",
  "sex_predicted": "female",
  "anomalies": null,
  "summary": "Growth on the 50th percentile, no anomalies.",
  "file_id": "..."
}
```

---

## 8. Smart extensions (optional, Phase 4)

### OCR classification for prenatal docs

Extend the existing Anthropic-backed `ocr-extract` edge function with two new doc types:

- **`ultrasound`** — extracts `{scan_date, GA, BPD, HC, AC, FL, EFW, FHR, placenta_position, amniotic_fluid, sex_predicted, anomalies, summary}` → pre-fills an `ultrasounds` row in the existing OCR review screen.
- **`prenatal_lab`** — extracts `{panel_name, sample_at, result_at, lab_name, abnormal, summary, items[]}` → pre-fills `lab_panels` (with `is_prenatal=true`) and `lab_panel_items[]`.

UX is unchanged — same review-and-confirm flow that prescription/discharge OCR uses today.

### Insights — low-effort, high-signal

- **Trimester pill** — 1st (≤13w), 2nd (14–27w), 3rd (28w+). Pure math.
- **Week-by-week copy** — 40 short paragraphs in `lib/pregnancy_weeks.ts` (e.g. "Week 28: baby's eyes can open and close. Weight ~1 kg."). Render the current week on the pregnancy dashboard.
- **IOM weight-gain band** — pre-pregnancy BMI → recommended total gain (e.g. normal BMI 18.5–24.9 → 11.5–16 kg). Show today's gain on a small bar with the band overlaid.
- **Reduced-movement watcher** — if GA ≥ 28w and today's kick count < 10 in any 2-h window, fire a notification ("Call your provider"). Threshold tunable per profile.

### Deferred (not Phases 1–4)

- **Multiples** (twins/triplets) — needs a 1:N pregnancy-to-baby model. Reasonable lift; design separately.
- **Pregnancy loss** — sensitive UX; needs its own design pass. The `archived` stage exists but the UI flow does not.
- **Postpartum tracking for the mother** — out of scope for a baby-tracking app, but the `pregnancy_profile` sidecar would extend cleanly.

---

## File-level change summary

```
sql/015_pregnancy_lifecycle.sql                          NEW
lib/lifecycle.ts                                          NEW   (effectiveStage, prettyStage helpers)
lib/dates.ts                                              EDIT  (gestationalAge, eddFromLmp, null-safe wrappers)
lib/validators.ts                                         EDIT  (PrenatalVisit, Ultrasound, FetalMovement, PregnancyProfile, MarkAsBorn schemas)
components/Sidebar.tsx                                    EDIT  (switch nav by effective stage)
components/PregnancyDashboard.tsx                         NEW
components/forms/PrenatalVisitForm.tsx                    NEW
components/forms/UltrasoundForm.tsx                       NEW
components/forms/KickCounter.tsx                          NEW   (live timer, client component)
components/forms/PregnancyProfileForm.tsx                 NEW
components/MarkAsBornDialog.tsx                           NEW
app/babies/new/page.tsx                                   EDIT  (stage picker step)
app/babies/[babyId]/page.tsx                              EDIT  (stage-aware dashboard switch)
app/babies/[babyId]/prenatal/page.tsx                     NEW
app/babies/[babyId]/prenatal/visits/...                   NEW
app/babies/[babyId]/prenatal/ultrasounds/...              NEW
app/babies/[babyId]/prenatal/kicks/page.tsx               NEW
app/babies/[babyId]/prenatal/maternal-vitals/page.tsx     NEW
app/api/babies/[babyId]/mark-as-born/route.ts             NEW
```

**Estimated effort:** 4–6 days for Phase 1 + Phase 2 (delivers the core pregnancy-to-newborn flow). +1–2 days each for Phase 3 (archive) and Phase 4 (smart extensions).

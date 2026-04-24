-- ============================================================================
-- Babylytics — migration 014
-- Total Medical Profile: a sharable, portable health record for the baby.
--
--   * admissions          - hospital/NICU admit events (separate from discharges)
--   * discharges          - discharge events (date, summary, file)
--   * lab_panels          - one row per lab/analysis result (CBC, urine, etc.)
--   * lab_panel_items     - optional structured rows under a panel
--   * allergies           - allergens, reactions, severity
--   * medical_conditions  - chronic / diagnosed conditions
--   * care_plan           - one row per baby: medical plan, feeding plan, labs
--                          needed (free text editable inline)
--
-- All tables are parent-write, with read access for any caregiver tied to the
-- baby (mirrors existing reports). Doctors-with-access can read but never
-- write — they comment instead.
-- ============================================================================

-- Add the medical-profile-specific file kinds. We keep the existing ones so
-- old uploads still pass the check.
alter table public.medical_files drop constraint if exists medical_files_kind_check;
alter table public.medical_files add constraint medical_files_kind_check
  check (kind in (
    'prescription','report','stool_image','daily_note','other',
    'admission_report','discharge_report','lab_report'
  ));

-- 1. admissions ---------------------------------------------------------------
create table if not exists public.admissions (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    admitted_at   timestamptz not null,
    hospital      text,
    department    text,                                    -- e.g. NICU, ER, ward
    reason        text,
    diagnosis     text,
    notes         text,
    file_id       uuid references public.medical_files(id) on delete set null,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_admissions_baby on public.admissions(baby_id, admitted_at desc)
  where deleted_at is null;

-- 2. discharges ---------------------------------------------------------------
create table if not exists public.discharges (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    admission_id  uuid references public.admissions(id) on delete set null,
    discharged_at timestamptz not null,
    hospital      text,
    diagnosis     text,
    treatment     text,
    follow_up     text,
    notes         text,
    file_id       uuid references public.medical_files(id) on delete set null,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_discharges_baby on public.discharges(baby_id, discharged_at desc)
  where deleted_at is null;

-- 3. lab_panels ---------------------------------------------------------------
-- A "panel" is one analysis result — a CBC, a urine analysis, a stool culture,
-- etc. The user can attach a file (quick path) or fill in structured rows
-- (lab_panel_items) for queryable values.
create table if not exists public.lab_panels (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    panel_kind    text not null check (panel_kind in (
                    'blood','urine','stool','culture','imaging','genetic','other')),
    panel_name    text not null,                           -- e.g. "CBC with diff"
    sample_at     timestamptz,                             -- when sample taken
    result_at     timestamptz not null,                    -- when result issued
    lab_name      text,                                    -- where it was run
    summary       text,                                    -- one-line takeaway
    abnormal      boolean not null default false,          -- panel-level flag
    file_id       uuid references public.medical_files(id) on delete set null,
    notes         text,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_lab_panels_baby on public.lab_panels(baby_id, result_at desc)
  where deleted_at is null;

-- 4. lab_panel_items ----------------------------------------------------------
-- Optional structured rows. Empty if user only attached a scan.
create table if not exists public.lab_panel_items (
    id            uuid primary key default gen_random_uuid(),
    panel_id      uuid not null references public.lab_panels(id) on delete cascade,
    test_name     text not null,                           -- e.g. "Hemoglobin"
    value         text,                                    -- text so we can store ranges/qualifiers
    unit          text,                                    -- e.g. "g/dL"
    reference     text,                                    -- e.g. "11.0 - 14.0"
    is_abnormal   boolean not null default false,
    flag          text check (flag in ('low','high','critical','positive','negative') or flag is null),
    notes         text,
    created_at    timestamptz not null default now()
);
create index if not exists idx_lab_panel_items_panel on public.lab_panel_items(panel_id);

-- 5. allergies ----------------------------------------------------------------
create table if not exists public.allergies (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    allergen      text not null,
    category      text check (category in (
                    'food','drug','environmental','contact','latex','other') or category is null),
    reaction      text,
    severity      text not null default 'mild'
                  check (severity in ('mild','moderate','severe','life_threatening')),
    diagnosed_at  date,
    status        text not null default 'active'
                  check (status in ('active','resolved','suspected')),
    notes         text,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_allergies_baby on public.allergies(baby_id, severity)
  where deleted_at is null;

-- 6. medical_conditions -------------------------------------------------------
create table if not exists public.medical_conditions (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    name          text not null,
    icd_code      text,                                    -- optional, doctors love these
    diagnosed_at  date,
    status        text not null default 'active'
                  check (status in ('active','resolved','chronic','suspected')),
    treatment     text,
    notes         text,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_medical_conditions_baby on public.medical_conditions(baby_id)
  where deleted_at is null;

-- 7. care_plan ----------------------------------------------------------------
-- One editable row per baby. Holds free-text plan fields. Upserted from the
-- profile page. Not deleted — just blanked when not set.
create table if not exists public.care_plan (
    baby_id        uuid primary key references public.babies(id) on delete cascade,
    medical_plan   text,
    feeding_plan   text,
    labs_needed    text,
    blood_type     text,                                   -- mirrored from babies for convenience
    updated_by     uuid references auth.users(id),
    updated_at     timestamptz not null default now()
);

-- Updated-at triggers ---------------------------------------------------------
drop trigger if exists trg_touch_admissions on public.admissions;
create trigger trg_touch_admissions before update on public.admissions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_discharges on public.discharges;
create trigger trg_touch_discharges before update on public.discharges
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_lab_panels on public.lab_panels;
create trigger trg_touch_lab_panels before update on public.lab_panels
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_allergies on public.allergies;
create trigger trg_touch_allergies before update on public.allergies
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_medical_conditions on public.medical_conditions;
create trigger trg_touch_medical_conditions before update on public.medical_conditions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_care_plan on public.care_plan;
create trigger trg_touch_care_plan before update on public.care_plan
  for each row execute function public.touch_updated_at();

-- Audit triggers --------------------------------------------------------------
-- NOTE: care_plan is intentionally excluded — its PK is baby_id (not id), and
-- the shared audit_row_change() helper extracts (v_new->>'id') as row_id,
-- which would null-violate audit_log.row_id. care_plan is a singleton per
-- baby so per-row audit history isn't useful here anyway.
do $$
declare t text;
begin
  for t in select unnest(array[
    'admissions','discharges','lab_panels','lab_panel_items',
    'allergies','medical_conditions'
  ]) loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
-- Make sure no stale care_plan audit trigger exists from earlier runs.
drop trigger if exists trg_audit_care_plan on public.care_plan;

-- RLS -------------------------------------------------------------------------
-- The medical profile is sensitive but useful — same audience as the daily
-- report: anyone tied to the baby can read; only parents can write. Lab
-- panel items piggyback on their parent panel.
alter table public.admissions          enable row level security;
alter table public.discharges          enable row level security;
alter table public.lab_panels          enable row level security;
alter table public.lab_panel_items     enable row level security;
alter table public.allergies           enable row level security;
alter table public.medical_conditions  enable row level security;
alter table public.care_plan           enable row level security;

-- READ: any baby member
do $$
declare t text;
begin
  for t in select unnest(array[
    'admissions','discharges','lab_panels','allergies','medical_conditions','care_plan'
  ]) loop
    execute format('drop policy if exists %1$s_member_select on public.%1$s', t);
    execute format('create policy %1$s_member_select on public.%1$s for select using (public.has_baby_access(baby_id))', t);
  end loop;
end $$;

-- WRITE: parents only
do $$
declare t text;
begin
  for t in select unnest(array[
    'admissions','discharges','lab_panels','allergies','medical_conditions','care_plan'
  ]) loop
    execute format('drop policy if exists %1$s_parent_write on public.%1$s', t);
    execute format('create policy %1$s_parent_write on public.%1$s for all using (public.is_baby_parent(baby_id)) with check (public.is_baby_parent(baby_id))', t);
  end loop;
end $$;

-- lab_panel_items piggybacks on its parent panel
drop policy if exists lab_panel_items_select on public.lab_panel_items;
create policy lab_panel_items_select on public.lab_panel_items for select using (
  exists (select 1 from public.lab_panels p
          where p.id = panel_id and public.has_baby_access(p.baby_id))
);
drop policy if exists lab_panel_items_write on public.lab_panel_items;
create policy lab_panel_items_write on public.lab_panel_items for all using (
  exists (select 1 from public.lab_panels p
          where p.id = panel_id and public.is_baby_parent(p.baby_id))
) with check (
  exists (select 1 from public.lab_panels p
          where p.id = panel_id and public.is_baby_parent(p.baby_id))
);

-- Backfill care_plan rows for existing babies so the UI can always upsert.
insert into public.care_plan(baby_id, blood_type)
  select id, blood_type::text from public.babies
   where deleted_at is null
     and not exists (select 1 from public.care_plan c where c.baby_id = babies.id);

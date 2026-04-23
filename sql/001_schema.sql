-- ============================================================================
-- Babylytics — Schema
-- ============================================================================
-- Conventions:
--   * All time fields are TIMESTAMPTZ (never DATE) so we keep multiple events
--     per day and enable hourly/time-zone-aware analytics.
--   * All user-owned rows have `created_by UUID REFERENCES auth.users(id)` for
--     accountability. Soft deletes via `deleted_at`.
--   * Everything is scoped to a baby. Access is mediated by `baby_users`.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
    id           uuid primary key references auth.users(id) on delete cascade,
    email        citext not null unique,
    display_name text,
    locale       text default 'en',          -- 'en' | 'ar' | 'fr' | 'mixed'
    unit_system  text default 'metric' check (unit_system in ('metric','imperial')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- keep profiles in sync with auth.users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- babies
-- ---------------------------------------------------------------------------
create table if not exists public.babies (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    dob           timestamptz not null,             -- TIMESTAMPTZ not DATE (birth hour matters for first days)
    gender        text check (gender in ('male','female','other','unspecified')) default 'unspecified',
    birth_weight_kg numeric(5,3),
    birth_height_cm numeric(5,2),
    notes         text,
    -- Feeding factor used by the KPI engine. Default 150 ml/kg/day.
    feeding_factor_ml_per_kg_per_day numeric(5,2) not null default 150,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- baby_users — access control junction. Every read/write is gated through this.
-- ---------------------------------------------------------------------------
create table if not exists public.baby_users (
    baby_id    uuid not null references public.babies(id) on delete cascade,
    user_id    uuid not null references auth.users(id)    on delete cascade,
    role       text not null check (role in ('owner','editor','viewer')),
    invited_by uuid references auth.users(id),
    created_at timestamptz not null default now(),
    primary key (baby_id, user_id)
);
create index if not exists idx_baby_users_user on public.baby_users(user_id);

-- ---------------------------------------------------------------------------
-- feedings — time-series
-- ---------------------------------------------------------------------------
create table if not exists public.feedings (
    id             uuid primary key default gen_random_uuid(),
    baby_id        uuid not null references public.babies(id) on delete cascade,
    feeding_time   timestamptz not null,
    milk_type      text not null check (milk_type in ('breast','formula','mixed','solid','other')) default 'formula',
    quantity_ml    numeric(6,1) check (quantity_ml >= 0),
    kcal           numeric(6,1) check (kcal >= 0),
    duration_min   integer check (duration_min >= 0),
    notes          text,
    source         text not null default 'manual' check (source in ('manual','ocr','import')),
    source_file_id uuid,                              -- FK set after medical_files created
    created_by     uuid not null references auth.users(id),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    deleted_at     timestamptz
);
create index if not exists idx_feedings_baby_time on public.feedings(baby_id, feeding_time desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- stool_logs — time-series
-- ---------------------------------------------------------------------------
create table if not exists public.stool_logs (
    id                uuid primary key default gen_random_uuid(),
    baby_id           uuid not null references public.babies(id) on delete cascade,
    stool_time        timestamptz not null,
    quantity_category text check (quantity_category in ('small','medium','large')),
    quantity_ml       numeric(6,1) check (quantity_ml >= 0),     -- optional numeric
    color             text,                                      -- yellow, green, brown, ...
    consistency       text,                                      -- watery, soft, firm, ...
    has_diaper_rash   boolean default false,
    notes             text,
    source            text not null default 'manual' check (source in ('manual','ocr','import')),
    source_file_id    uuid,
    created_by        uuid not null references auth.users(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    deleted_at        timestamptz
);
create index if not exists idx_stool_baby_time on public.stool_logs(baby_id, stool_time desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- medications — a prescription (slowly-changing attribute)
-- ---------------------------------------------------------------------------
create table if not exists public.medications (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    name          text not null,
    dosage        text,                                          -- "5 ml", "1 drop/kg"
    route         text check (route in ('oral','topical','inhaled','nasal','rectal','injection','other')) default 'oral',
    frequency_hours numeric(5,2),                                 -- e.g., 8.0 = every 8h
    total_doses   integer,                                       -- nullable = open-ended
    starts_at     timestamptz not null,
    ends_at       timestamptz,
    prescribed_by text,
    notes         text,
    file_id       uuid,                                          -- link to prescription scan
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_medications_baby on public.medications(baby_id) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- medication_logs — each administered dose
-- ---------------------------------------------------------------------------
create table if not exists public.medication_logs (
    id               uuid primary key default gen_random_uuid(),
    medication_id    uuid not null references public.medications(id) on delete cascade,
    baby_id          uuid not null references public.babies(id) on delete cascade,
    medication_time  timestamptz not null,
    status           text not null check (status in ('taken','missed','skipped')) default 'taken',
    actual_dosage    text,
    notes            text,
    source           text not null default 'manual' check (source in ('manual','ocr','import')),
    source_file_id   uuid,
    created_by       uuid not null references auth.users(id),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),
    deleted_at       timestamptz
);
create index if not exists idx_med_logs_baby_time on public.medication_logs(baby_id, medication_time desc) where deleted_at is null;
create index if not exists idx_med_logs_med on public.medication_logs(medication_id, medication_time desc);

-- ---------------------------------------------------------------------------
-- measurements — weight / height / head circumference
-- ---------------------------------------------------------------------------
create table if not exists public.measurements (
    id                uuid primary key default gen_random_uuid(),
    baby_id           uuid not null references public.babies(id) on delete cascade,
    measured_at       timestamptz not null,
    weight_kg         numeric(5,3) check (weight_kg >= 0),
    height_cm         numeric(5,2) check (height_cm >= 0),
    head_circ_cm      numeric(5,2) check (head_circ_cm >= 0),
    notes             text,
    source            text not null default 'manual' check (source in ('manual','ocr','import')),
    source_file_id    uuid,
    created_by        uuid not null references auth.users(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    deleted_at        timestamptz,
    check (weight_kg is not null or height_cm is not null or head_circ_cm is not null)
);
create index if not exists idx_measurements_baby_time on public.measurements(baby_id, measured_at desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- medical_files — pointers to Supabase Storage objects
-- ---------------------------------------------------------------------------
create table if not exists public.medical_files (
    id              uuid primary key default gen_random_uuid(),
    baby_id         uuid not null references public.babies(id) on delete cascade,
    kind            text not null check (kind in ('prescription','report','stool_image','daily_note','other')),
    storage_bucket  text not null default 'medical-files',
    storage_path    text not null,                 -- e.g. babies/{baby_id}/daily_notes/abc.jpg
    mime_type       text,
    size_bytes      bigint,
    is_handwritten  boolean,
    uploaded_by     uuid not null references auth.users(id),
    uploaded_at     timestamptz not null default now(),
    ocr_status      text not null default 'pending' check (ocr_status in ('pending','processing','extracted','reviewed','confirmed','failed')),
    notes           text,
    deleted_at      timestamptz
);
create index if not exists idx_medical_files_baby on public.medical_files(baby_id, uploaded_at desc) where deleted_at is null;
create index if not exists idx_medical_files_ocr_status on public.medical_files(ocr_status) where deleted_at is null;

-- add the deferred FKs for source_file_id
alter table public.feedings         add constraint feedings_source_file_fk         foreign key (source_file_id) references public.medical_files(id) on delete set null;
alter table public.stool_logs       add constraint stool_source_file_fk            foreign key (source_file_id) references public.medical_files(id) on delete set null;
alter table public.medication_logs  add constraint med_logs_source_file_fk         foreign key (source_file_id) references public.medical_files(id) on delete set null;
alter table public.measurements     add constraint measurements_source_file_fk     foreign key (source_file_id) references public.medical_files(id) on delete set null;
alter table public.medications      add constraint medications_prescription_fk     foreign key (file_id)        references public.medical_files(id) on delete set null;

-- ---------------------------------------------------------------------------
-- extracted_text — raw OCR output + structured JSON. NEVER auto-applied.
-- Each row represents one OCR pass over one file. A file can be re-processed
-- (new row per attempt) — the latest wins in UI but history is kept.
-- ---------------------------------------------------------------------------
create table if not exists public.extracted_text (
    id               uuid primary key default gen_random_uuid(),
    file_id          uuid not null references public.medical_files(id) on delete cascade,
    baby_id          uuid not null references public.babies(id) on delete cascade,
    provider         text not null check (provider in ('anthropic','google','textract','tesseract','manual')),
    model            text,                                  -- e.g. "claude-sonnet-4-6"
    raw_text         text,                                  -- full OCR transcript
    structured_data  jsonb not null default '{}'::jsonb,    -- { feedings:[], stools:[], medications:[], measurements:[] }
    confidence_score numeric(4,3) check (confidence_score >= 0 and confidence_score <= 1),
    is_handwritten   boolean,
    detected_language text,
    flag_low_confidence boolean generated always as (coalesce(confidence_score,0) < 0.7) stored,
    status           text not null default 'extracted' check (status in ('extracted','reviewed','confirmed','discarded')),
    reviewed_by      uuid references auth.users(id),
    reviewed_at      timestamptz,
    confirmed_at     timestamptz,
    error            text,
    created_at       timestamptz not null default now()
);
create index if not exists idx_extracted_file on public.extracted_text(file_id, created_at desc);
create index if not exists idx_extracted_flag on public.extracted_text(baby_id, flag_low_confidence) where flag_low_confidence is true;

-- ---------------------------------------------------------------------------
-- notifications — in-app only for v1
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
    id         uuid primary key default gen_random_uuid(),
    baby_id    uuid not null references public.babies(id) on delete cascade,
    user_id    uuid references auth.users(id) on delete cascade,  -- null = broadcast to all baby_users
    kind       text not null check (kind in ('medication_due','medication_missed','low_ocr_confidence','file_ready','feeding_alert','stool_alert')),
    payload    jsonb not null default '{}'::jsonb,
    read_at    timestamptz,
    created_at timestamptz not null default now()
);
create index if not exists idx_notifications_baby on public.notifications(baby_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- updated_at trigger — applied to every mutable table
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  for t in select unnest(array[
    'profiles','babies','feedings','stool_logs','medications','medication_logs','measurements'
  ])
  loop
    execute format('drop trigger if exists trg_touch_%I on public.%I;', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;

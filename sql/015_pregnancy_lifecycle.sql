-- ============================================================================
-- Babylytics — migration 015
-- Pregnancy → Newborn → Infant lifecycle.
-- See docs/lifecycle_extension_spec.md for the design rationale.
--
-- This migration is purely additive. Existing rows are unaffected after the
-- one-line backfill at the bottom.
-- ============================================================================

-- 1. babies: make dob nullable, add lifecycle + prenatal columns ---------------
alter table public.babies alter column dob drop not null;

alter table public.babies
  add column if not exists lifecycle_stage text not null default 'infant'
    check (lifecycle_stage in ('pregnancy','newborn','infant','toddler','child','archived'));

alter table public.babies
  add column if not exists edd date,
  add column if not exists lmp date,
  add column if not exists conception_method text
    check (conception_method in ('natural','ivf','iui','icsi','other') or conception_method is null);

create index if not exists idx_babies_lifecycle_stage on public.babies(lifecycle_stage)
  where deleted_at is null;

-- 2. New tables ---------------------------------------------------------------
create table if not exists public.pregnancy_profile (
    baby_id                  uuid primary key references public.babies(id) on delete cascade,
    mother_dob               date,
    mother_blood_type        text,
    gravida                  integer check (gravida >= 0 and gravida <= 30),
    para                     integer check (para    >= 0 and para    <= 30),
    pre_pregnancy_weight_kg  numeric(5,2),
    pre_pregnancy_height_cm  numeric(5,1),
    risk_factors             text,
    notes                    text,
    updated_by               uuid references auth.users(id),
    updated_at               timestamptz not null default now()
);

create table if not exists public.prenatal_visits (
    id                       uuid primary key default gen_random_uuid(),
    baby_id                  uuid not null references public.babies(id) on delete cascade,
    visited_at               timestamptz not null,
    gestational_week         integer check (gestational_week between 0 and 45),
    gestational_day          integer check (gestational_day between 0 and 6),
    maternal_weight_kg       numeric(5,2),
    bp_systolic              integer check (bp_systolic between 50 and 260),
    bp_diastolic             integer check (bp_diastolic between 30 and 180),
    fetal_heart_rate_bpm     integer check (fetal_heart_rate_bpm between 50 and 250),
    fundal_height_cm         numeric(4,1),
    doctor_id                uuid references public.doctors(id) on delete set null,
    file_id                  uuid references public.medical_files(id) on delete set null,
    notes                    text,
    created_by               uuid not null references auth.users(id),
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    deleted_at               timestamptz
);
create index if not exists idx_prenatal_visits_baby on public.prenatal_visits(baby_id, visited_at desc)
  where deleted_at is null;

create table if not exists public.ultrasounds (
    id                       uuid primary key default gen_random_uuid(),
    baby_id                  uuid not null references public.babies(id) on delete cascade,
    scanned_at               timestamptz not null,
    gestational_week         integer check (gestational_week between 0 and 45),
    gestational_day          integer check (gestational_day between 0 and 6),
    bpd_mm                   numeric(5,1),
    hc_mm                    numeric(5,1),
    ac_mm                    numeric(5,1),
    fl_mm                    numeric(5,1),
    efw_g                    numeric(7,1),
    fhr_bpm                  integer check (fhr_bpm between 50 and 250),
    placenta_position        text,
    amniotic_fluid           text,
    sex_predicted            text check (sex_predicted in ('male','female','undetermined') or sex_predicted is null),
    anomalies                text,
    summary                  text,
    file_id                  uuid references public.medical_files(id) on delete set null,
    created_by               uuid not null references auth.users(id),
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    deleted_at               timestamptz
);
create index if not exists idx_ultrasounds_baby on public.ultrasounds(baby_id, scanned_at desc)
  where deleted_at is null;

create table if not exists public.fetal_movements (
    id                       uuid primary key default gen_random_uuid(),
    baby_id                  uuid not null references public.babies(id) on delete cascade,
    counted_at               timestamptz not null,
    duration_min             integer not null check (duration_min > 0 and duration_min <= 240),
    movements                integer not null check (movements >= 0 and movements <= 999),
    notes                    text,
    created_by               uuid not null references auth.users(id),
    created_at               timestamptz not null default now(),
    deleted_at               timestamptz
);
create index if not exists idx_fetal_movements_baby on public.fetal_movements(baby_id, counted_at desc)
  where deleted_at is null;

-- 3. Reused-table flags -------------------------------------------------------
alter table public.medications add column if not exists for_party text
  check (for_party in ('mother','baby')) default 'baby';

alter table public.lab_panels  add column if not exists is_prenatal boolean not null default false;

-- 4. Extend medical_files.kind enum -------------------------------------------
alter table public.medical_files drop constraint if exists medical_files_kind_check;
alter table public.medical_files add constraint medical_files_kind_check
  check (kind in (
    'prescription','report','stool_image','daily_note','other',
    'admission_report','discharge_report','lab_report',
    'ultrasound','prenatal_lab','maternal_vitals','genetic_screening','birth_plan'
  ));

-- 5. Triggers -----------------------------------------------------------------
drop trigger if exists trg_touch_pregnancy_profile on public.pregnancy_profile;
create trigger trg_touch_pregnancy_profile before update on public.pregnancy_profile
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_prenatal_visits on public.prenatal_visits;
create trigger trg_touch_prenatal_visits before update on public.prenatal_visits
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_ultrasounds on public.ultrasounds;
create trigger trg_touch_ultrasounds before update on public.ultrasounds
  for each row execute function public.touch_updated_at();

-- Audit (NOTE: pregnancy_profile excluded — PK is baby_id, no 'id' column;
--               same gotcha as care_plan in migration 014).
do $$
declare t text;
begin
  for t in select unnest(array['prenatal_visits','ultrasounds','fetal_movements']) loop
    execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
    execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.audit_row_change()', t);
  end loop;
end $$;
drop trigger if exists trg_audit_pregnancy_profile on public.pregnancy_profile;

-- 6. RLS ----------------------------------------------------------------------
alter table public.pregnancy_profile enable row level security;
alter table public.prenatal_visits   enable row level security;
alter table public.ultrasounds       enable row level security;
alter table public.fetal_movements   enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['pregnancy_profile','prenatal_visits','ultrasounds','fetal_movements']) loop
    execute format('drop policy if exists %1$s_member_select on public.%1$s', t);
    execute format('drop policy if exists %1$s_parent_write  on public.%1$s', t);
    execute format('create policy %1$s_member_select on public.%1$s for select using (public.has_baby_access(baby_id))', t);
    execute format('create policy %1$s_parent_write  on public.%1$s for all  using (public.is_baby_parent(baby_id)) with check (public.is_baby_parent(baby_id))', t);
  end loop;
end $$;

-- 7. RPCs ---------------------------------------------------------------------
-- Effective lifecycle stage — derives from dob age unless stored is pregnancy/archived.
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

-- Create a pregnancy-stage baby + owner row in one transaction. Mirrors
-- create_baby_with_owner but for pregnancy onboarding (dob omitted).
create or replace function public.create_pregnancy_with_owner(
  p_name text,
  p_edd date default null,
  p_lmp date default null,
  p_conception_method text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if p_edd is null and p_lmp is null then
    raise exception 'either EDD or LMP is required';
  end if;

  insert into public.babies(name, gender, lifecycle_stage, edd, lmp, conception_method, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Baby'), 'unspecified', 'pregnancy',
            coalesce(p_edd, p_lmp + 280),  -- LMP + 280 days = EDD
            p_lmp, p_conception_method, v_actor)
    returning id into v_id;

  insert into public.baby_users(baby_id, user_id, role, invited_by)
    values (v_id, v_actor, 'owner', v_actor);

  insert into public.pregnancy_profile(baby_id, updated_by)
    values (v_id, v_actor);

  return v_id;
end; $$;
grant execute on function public.create_pregnancy_with_owner(text, date, date, text) to authenticated;

-- Mark-as-Born transition. Only parents may call.
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

  if p_birth_weight_kg is not null or p_birth_height_cm is not null or p_head_circ_cm is not null then
    insert into public.measurements(baby_id, measured_at, weight_kg, height_cm, head_circ_cm, created_by)
      values (p_baby, p_dob, p_birth_weight_kg, p_birth_height_cm, p_head_circ_cm, auth.uid());
  end if;
end $$;
grant execute on function public.mark_baby_born(uuid, timestamptz, numeric, numeric, numeric, text) to authenticated;

-- Pregnancy summary helper for the dashboard. One round-trip = all KPIs.
create or replace function public.prenatal_summary(p_baby uuid)
returns table (
  edd                   date,
  lmp                   date,
  gestational_days      integer,
  edd_distance_days     integer,
  latest_bp_systolic    integer,
  latest_bp_diastolic   integer,
  latest_fhr            integer,
  latest_weight_kg      numeric,
  weight_gain_kg        numeric,
  kicks_today           integer,
  ultrasound_count      integer,
  prenatal_visit_count  integer
) language sql stable security definer set search_path = public as $$
  with b as (
    select edd, lmp from public.babies where id = p_baby
  ), latest_visit as (
    select * from public.prenatal_visits
     where baby_id = p_baby and deleted_at is null
     order by visited_at desc limit 1
  ), first_visit as (
    select maternal_weight_kg from public.prenatal_visits
     where baby_id = p_baby and deleted_at is null and maternal_weight_kg is not null
     order by visited_at asc limit 1
  ), last_us as (
    select fhr_bpm from public.ultrasounds
     where baby_id = p_baby and deleted_at is null and fhr_bpm is not null
     order by scanned_at desc limit 1
  ), kicks as (
    select coalesce(sum(movements), 0)::integer as total
      from public.fetal_movements
     where baby_id = p_baby and deleted_at is null
       and counted_at >= (current_date at time zone 'Africa/Cairo')::timestamptz
  ), counts as (
    select
      (select count(*) from public.ultrasounds      where baby_id = p_baby and deleted_at is null) as us_count,
      (select count(*) from public.prenatal_visits  where baby_id = p_baby and deleted_at is null) as v_count
  )
  select
    b.edd,
    b.lmp,
    case when b.lmp is not null then (current_date - b.lmp)::integer
         when b.edd is not null then (280 - (b.edd - current_date))::integer
         else null end as gestational_days,
    case when b.edd is not null then (b.edd - current_date)::integer else null end as edd_distance_days,
    (select bp_systolic  from latest_visit) as latest_bp_systolic,
    (select bp_diastolic from latest_visit) as latest_bp_diastolic,
    coalesce((select fhr_bpm from last_us), (select fetal_heart_rate_bpm from latest_visit)) as latest_fhr,
    (select maternal_weight_kg from latest_visit) as latest_weight_kg,
    case when (select maternal_weight_kg from latest_visit) is not null
          and (select maternal_weight_kg from first_visit)  is not null
         then ((select maternal_weight_kg from latest_visit) - (select maternal_weight_kg from first_visit))
         else null end as weight_gain_kg,
    (select total from kicks)::integer as kicks_today,
    (select us_count from counts)::integer as ultrasound_count,
    (select v_count  from counts)::integer as prenatal_visit_count
  from b;
$$;
grant execute on function public.prenatal_summary(uuid) to authenticated;

-- 8. Backfill lifecycle_stage for existing babies -----------------------------
update public.babies
  set lifecycle_stage = case
    when dob is null                  then 'pregnancy'
    when (current_date - dob) <= 28   then 'newborn'
    when (current_date - dob) <= 365  then 'infant'
    when (current_date - dob) <= 1095 then 'toddler'
    else 'child'
  end
  where lifecycle_stage = 'infant';

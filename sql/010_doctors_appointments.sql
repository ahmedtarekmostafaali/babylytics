-- ============================================================================
-- Babylytics — migration 010
-- Multi-doctor support + appointment calendar.
--   * `doctors`       - one row per pediatrician / specialist per baby
--   * `appointments`  - scheduled visits, optionally linked to a doctor
-- The single-doctor fields on `babies` (doctor_name, doctor_phone, etc.) stay
-- in place for backwards compatibility but the UI now reads/writes the new
-- tables. A one-time backfill migrates those fields into the new tables for
-- any baby that still has them set.
-- ============================================================================

create table if not exists public.doctors (
    id           uuid primary key default gen_random_uuid(),
    baby_id      uuid not null references public.babies(id) on delete cascade,
    name         text not null,
    specialty    text,
    clinic       text,
    phone        text,
    email        text,
    address      text,
    notes        text,
    is_primary   boolean not null default false,
    created_by   uuid not null references auth.users(id),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    deleted_at   timestamptz
);
create index if not exists idx_doctors_baby on public.doctors(baby_id) where deleted_at is null;

create table if not exists public.appointments (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    doctor_id     uuid references public.doctors(id) on delete set null,
    scheduled_at  timestamptz not null,
    duration_min  integer check (duration_min > 0 and duration_min < 600),
    purpose       text,
    location      text,
    status        text not null default 'scheduled'
                  check (status in ('scheduled','completed','cancelled','missed','rescheduled')),
    notes         text,
    created_by    uuid not null references auth.users(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_appointments_baby_time on public.appointments(baby_id, scheduled_at)
  where deleted_at is null;
create index if not exists idx_appointments_doctor on public.appointments(doctor_id) where deleted_at is null;

-- Updated-at triggers ---------------------------------------------------------
drop trigger if exists trg_touch_doctors on public.doctors;
create trigger trg_touch_doctors before update on public.doctors
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_touch_appointments on public.appointments;
create trigger trg_touch_appointments before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Audit triggers --------------------------------------------------------------
drop trigger if exists trg_audit_doctors on public.doctors;
create trigger trg_audit_doctors
  after insert or update or delete on public.doctors
  for each row execute function public.audit_row_change();

drop trigger if exists trg_audit_appointments on public.appointments;
create trigger trg_audit_appointments
  after insert or update or delete on public.appointments
  for each row execute function public.audit_row_change();

-- RLS -------------------------------------------------------------------------
-- Doctors + appointments are parent-only — doctors/nurses/caregivers don't
-- see them at all, matching the product decision that medical contact info is
-- a parent concern.
alter table public.doctors      enable row level security;
alter table public.appointments enable row level security;

drop policy if exists doctors_parent_select on public.doctors;
create policy doctors_parent_select on public.doctors
  for select using (public.is_baby_parent(baby_id));
drop policy if exists doctors_parent_write on public.doctors;
create policy doctors_parent_write on public.doctors
  for all using (public.is_baby_parent(baby_id))
  with check (public.is_baby_parent(baby_id));

drop policy if exists appointments_parent_select on public.appointments;
create policy appointments_parent_select on public.appointments
  for select using (public.is_baby_parent(baby_id));
drop policy if exists appointments_parent_write on public.appointments;
create policy appointments_parent_write on public.appointments
  for all using (public.is_baby_parent(baby_id))
  with check (public.is_baby_parent(baby_id));

-- Backfill from single-doctor columns ----------------------------------------
-- For any baby that has doctor_name set but no doctors rows yet, create one.
insert into public.doctors(baby_id, name, clinic, phone, is_primary, created_by, notes)
select b.id, b.doctor_name, b.doctor_clinic, b.doctor_phone, true, b.created_by, null
  from public.babies b
 where b.doctor_name is not null
   and b.deleted_at is null
   and not exists (select 1 from public.doctors d where d.baby_id = b.id and d.deleted_at is null);

-- Same for next_appointment_at → appointments row (doctor_id = primary doctor)
insert into public.appointments(baby_id, doctor_id, scheduled_at, purpose, status, created_by, notes)
select b.id,
       (select id from public.doctors d where d.baby_id = b.id and d.is_primary order by d.created_at limit 1),
       b.next_appointment_at,
       b.next_appointment_notes,
       'scheduled',
       b.created_by,
       null
  from public.babies b
 where b.next_appointment_at is not null
   and b.deleted_at is null
   and not exists (select 1 from public.appointments a where a.baby_id = b.id and a.scheduled_at = b.next_appointment_at);

-- Helper: next upcoming appointment ------------------------------------------
create or replace function public.next_appointment(p_baby uuid)
returns table (
  id           uuid,
  doctor_id    uuid,
  doctor_name  text,
  scheduled_at timestamptz,
  purpose      text,
  location     text,
  status       text
) language sql stable security definer set search_path = public as $$
  select a.id, a.doctor_id, d.name as doctor_name,
         a.scheduled_at, a.purpose, a.location, a.status
    from public.appointments a
    left join public.doctors d on d.id = a.doctor_id
   where a.baby_id = p_baby
     and a.deleted_at is null
     and a.status = 'scheduled'
     and a.scheduled_at >= now()
   order by a.scheduled_at asc
   limit 1;
$$;
grant execute on function public.next_appointment(uuid) to authenticated;

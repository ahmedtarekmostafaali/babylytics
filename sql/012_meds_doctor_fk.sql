-- ============================================================================
-- Babylytics — migration 012
-- Link medications to the doctor who prescribed them. The legacy
-- `prescribed_by` text column stays in place for free-form entries and so
-- existing data isn't lost; new rows usually populate both (`doctor_id` and
-- a snapshot of the doctor's name into `prescribed_by`) so displays don't
-- break if the doctor row is later deleted.
-- ============================================================================

alter table public.medications
  add column if not exists doctor_id uuid
    references public.doctors(id) on delete set null;

create index if not exists idx_medications_doctor on public.medications(doctor_id)
  where deleted_at is null and doctor_id is not null;

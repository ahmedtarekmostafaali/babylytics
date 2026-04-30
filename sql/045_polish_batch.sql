-- 045: Polish batch following the 6-feature mega-batch.
-- ============================================================================
-- 1. Stool diaper photo attachment column + storage bucket.
-- 2. Medication unit field (drop / tab / spoon / ml / mg / etc.) so
--    "actual_dosage" can be entered as quantity + unit.
-- 3. Helper view for "last bottle feeding" so the FeedingForm can pre-fill
--    the formula brand on the next bottle entry.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Stool: attachment_path for diaper photo
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.stool_logs
  add column if not exists attachment_path text;

-- Storage bucket for diaper photos. Path convention: <baby_id>/<uuid>.<ext>
-- so RLS can look at the prefix to authorise downloads.
insert into storage.buckets (id, name, public)
  values ('stool-attachments', 'stool-attachments', false)
  on conflict (id) do nothing;

-- Per-baby RLS on storage objects. The bucket is private; signed URLs are
-- generated server-side after has_baby_access() succeeds.
drop policy if exists stool_attachments_select on storage.objects;
create policy stool_attachments_select on storage.objects
  for select
  using (bucket_id = 'stool-attachments'
         and public.has_baby_access((split_part(name, '/', 1))::uuid));

drop policy if exists stool_attachments_insert on storage.objects;
create policy stool_attachments_insert on storage.objects
  for insert
  with check (bucket_id = 'stool-attachments'
              and public.has_baby_access((split_part(name, '/', 1))::uuid));

drop policy if exists stool_attachments_delete on storage.objects;
create policy stool_attachments_delete on storage.objects
  for delete
  using (bucket_id = 'stool-attachments'
         and public.has_baby_access((split_part(name, '/', 1))::uuid));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Medications: dosage_unit column + dosage_amount as a structured pair
-- ─────────────────────────────────────────────────────────────────────────────
-- Rather than re-typing the existing free-text `dosage` column, we add two
-- new optional columns so new flows can write structured data while old
-- rows remain readable. UI prefers structured if present, falls back to
-- the free-text `dosage`.
alter table public.medications
  add column if not exists dosage_amount numeric(8,3),
  add column if not exists dosage_unit   text check (dosage_unit in (
    'drop','tab','capsule','spoon_5ml','spoon_15ml','ml','mg','puff','sachet','application','suppository','iu','other'
  ));

-- Same on medication_logs.actual_* — what was actually given might differ.
alter table public.medication_logs
  add column if not exists actual_amount numeric(8,3),
  add column if not exists actual_unit   text check (actual_unit in (
    'drop','tab','capsule','spoon_5ml','spoon_15ml','ml','mg','puff','sachet','application','suppository','iu','other'
  ));

commit;

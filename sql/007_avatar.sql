-- ============================================================================
-- Babylytics — Baby avatar
-- ============================================================================
-- Adds an optional avatar image to each baby. The actual bytes live in the
-- existing "medical-files" Storage bucket under babies/{baby_id}/avatar/…
-- and this column just stores the Storage path. Display layer signs a URL.
-- ============================================================================

alter table public.babies
  add column if not exists avatar_path text;

-- Loosen the medical_files kind check to allow 'baby_avatar' too, so the upload
-- can optionally create a medical_files audit row. Not required for display.
alter table public.medical_files drop constraint if exists medical_files_kind_check;
alter table public.medical_files
  add constraint medical_files_kind_check
  check (kind in ('prescription','report','stool_image','daily_note','baby_avatar','other'));

-- ============================================================================
-- Babylytics — Row Level Security
-- ============================================================================
-- Golden rule: NO table is readable/writable unless the caller has an active
-- row in baby_users for the target baby. Roles:
--
--   owner  → full read/write, can invite/revoke caregivers, can delete baby
--   editor → full read/write on all logs/files/medications
--   viewer → read-only (a pediatrician pulling the file, say)
--
-- We centralize access checks in three SECURITY DEFINER helpers so policies
-- stay small and testable.
-- ============================================================================

create or replace function public.has_baby_access(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid()
  );
$$;

create or replace function public.has_baby_write(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid() and role in ('owner','editor')
  );
$$;

create or replace function public.is_baby_owner(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid() and role = 'owner'
  );
$$;

grant execute on function public.has_baby_access(uuid) to authenticated;
grant execute on function public.has_baby_write(uuid)  to authenticated;
grant execute on function public.is_baby_owner(uuid)   to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.babies           enable row level security;
alter table public.baby_users       enable row level security;
alter table public.feedings         enable row level security;
alter table public.stool_logs       enable row level security;
alter table public.medications      enable row level security;
alter table public.medication_logs  enable row level security;
alter table public.measurements     enable row level security;
alter table public.medical_files    enable row level security;
alter table public.extracted_text   enable row level security;
alter table public.notifications    enable row level security;
alter table public.audit_log        enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: users see/edit only themselves
-- ---------------------------------------------------------------------------
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- inserts happen via trigger; deny explicit insert
drop policy if exists profiles_no_insert on public.profiles;
create policy profiles_no_insert on public.profiles for insert with check (false);

-- ---------------------------------------------------------------------------
-- babies
-- ---------------------------------------------------------------------------
drop policy if exists babies_select on public.babies;
create policy babies_select on public.babies
  for select using (public.has_baby_access(id));

drop policy if exists babies_insert on public.babies;
create policy babies_insert on public.babies
  for insert with check (created_by = auth.uid());

drop policy if exists babies_update on public.babies;
create policy babies_update on public.babies
  for update using (public.has_baby_write(id));

drop policy if exists babies_delete on public.babies;
create policy babies_delete on public.babies
  for delete using (public.is_baby_owner(id));

-- ---------------------------------------------------------------------------
-- baby_users — only owners manage membership. Members see their own rows.
-- ---------------------------------------------------------------------------
drop policy if exists baby_users_select on public.baby_users;
create policy baby_users_select on public.baby_users
  for select using (user_id = auth.uid() or public.is_baby_owner(baby_id));

drop policy if exists baby_users_insert on public.baby_users;
create policy baby_users_insert on public.baby_users
  for insert with check (
    -- First owner of a baby is added inside a SQL RPC (see 004). Subsequent
    -- rows must be inserted by an existing owner of that baby.
    public.is_baby_owner(baby_id)
  );

drop policy if exists baby_users_update on public.baby_users;
create policy baby_users_update on public.baby_users
  for update using (public.is_baby_owner(baby_id));

drop policy if exists baby_users_delete on public.baby_users;
create policy baby_users_delete on public.baby_users
  for delete using (public.is_baby_owner(baby_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- helper macro: per-table baby-scoped policies
-- ---------------------------------------------------------------------------
-- feedings
drop policy if exists feedings_select on public.feedings;
create policy feedings_select on public.feedings
  for select using (public.has_baby_access(baby_id));
drop policy if exists feedings_write on public.feedings;
create policy feedings_write on public.feedings
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- stool_logs
drop policy if exists stool_select on public.stool_logs;
create policy stool_select on public.stool_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists stool_write on public.stool_logs;
create policy stool_write on public.stool_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- medications
drop policy if exists medications_select on public.medications;
create policy medications_select on public.medications
  for select using (public.has_baby_access(baby_id));
drop policy if exists medications_write on public.medications;
create policy medications_write on public.medications
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- medication_logs
drop policy if exists med_logs_select on public.medication_logs;
create policy med_logs_select on public.medication_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists med_logs_write on public.medication_logs;
create policy med_logs_write on public.medication_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- measurements
drop policy if exists measurements_select on public.measurements;
create policy measurements_select on public.measurements
  for select using (public.has_baby_access(baby_id));
drop policy if exists measurements_write on public.measurements;
create policy measurements_write on public.measurements
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- medical_files
drop policy if exists files_select on public.medical_files;
create policy files_select on public.medical_files
  for select using (public.has_baby_access(baby_id));
drop policy if exists files_write on public.medical_files;
create policy files_write on public.medical_files
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- extracted_text
drop policy if exists extracted_select on public.extracted_text;
create policy extracted_select on public.extracted_text
  for select using (public.has_baby_access(baby_id));
drop policy if exists extracted_write on public.extracted_text;
create policy extracted_write on public.extracted_text
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- notifications
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (
    public.has_baby_access(baby_id) and (user_id is null or user_id = auth.uid())
  );
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update using (user_id = auth.uid());
-- inserts happen via SECURITY DEFINER RPC / Edge Function only
drop policy if exists notifications_no_insert on public.notifications;
create policy notifications_no_insert on public.notifications for insert with check (false);

-- audit_log: read-only for members of the baby, no direct writes
drop policy if exists audit_select on public.audit_log;
create policy audit_select on public.audit_log
  for select using (baby_id is null or public.has_baby_access(baby_id));
drop policy if exists audit_no_write on public.audit_log;
create policy audit_no_write on public.audit_log for insert with check (false);

-- ---------------------------------------------------------------------------
-- Storage bucket policies for "medical-files"
--
-- Bucket must be created privately in Studio. Paths are:
--   babies/{baby_id}/{kind}/{filename}
-- We derive baby_id from the second path segment.
-- ---------------------------------------------------------------------------
-- Helper that pulls the baby_id from a storage object name
create or replace function public.baby_from_storage_path(p text)
returns uuid language sql immutable as $$
  select case
    when split_part(p,'/',1) = 'babies'
    then nullif(split_part(p,'/',2),'')::uuid
    else null
  end;
$$;

drop policy if exists storage_select on storage.objects;
create policy storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-files'
    and public.has_baby_access(public.baby_from_storage_path(name))
  );

drop policy if exists storage_insert on storage.objects;
create policy storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-files'
    and public.has_baby_write(public.baby_from_storage_path(name))
  );

drop policy if exists storage_update on storage.objects;
create policy storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'medical-files' and public.has_baby_write(public.baby_from_storage_path(name)))
  with check (bucket_id = 'medical-files' and public.has_baby_write(public.baby_from_storage_path(name)));

drop policy if exists storage_delete on storage.objects;
create policy storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'medical-files' and public.has_baby_write(public.baby_from_storage_path(name)));

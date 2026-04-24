-- ============================================================================
-- Babylytics — migration 009
-- Adds:
--   * sleep_logs table
--   * expanded baby_users.role vocabulary
--     owner | parent | doctor | nurse | caregiver | viewer
--     (old 'editor' values are migrated to 'parent')
--   * parent-only doctor metadata on babies (doctor_name, next_appointment_at)
--   * optional scope_date on comments — enables per-report-day comments
--   * role-aware helper functions
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sleep_logs
-- ---------------------------------------------------------------------------
create table if not exists public.sleep_logs (
    id              uuid primary key default gen_random_uuid(),
    baby_id         uuid not null references public.babies(id) on delete cascade,
    start_at        timestamptz not null,
    end_at          timestamptz,                                         -- null while sleeping in progress
    duration_min    integer generated always as (
                      case when end_at is null then null
                           else greatest(0, extract(epoch from (end_at - start_at))::int / 60)
                      end
                    ) stored,
    location        text not null default 'crib' check (location in ('crib','bed','car','stroller','arms','other')),
    quality         text check (quality in ('sound','restless','woke_often','unknown')),
    notes           text,
    source          text not null default 'manual' check (source in ('manual','ocr','imported')),
    source_file_id  uuid references public.medical_files(id) on delete set null,
    created_by      uuid not null references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    check (end_at is null or end_at >= start_at)
);
create index if not exists idx_sleep_logs_baby_time on public.sleep_logs(baby_id, start_at desc) where deleted_at is null;

drop trigger if exists trg_touch_sleep_logs on public.sleep_logs;
create trigger trg_touch_sleep_logs before update on public.sleep_logs
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_audit_sleep_logs on public.sleep_logs;
create trigger trg_audit_sleep_logs
  after insert or update or delete on public.sleep_logs
  for each row execute function public.audit_row_change();

alter table public.sleep_logs enable row level security;

drop policy if exists sleep_select on public.sleep_logs;
create policy sleep_select on public.sleep_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists sleep_write on public.sleep_logs;
create policy sleep_write on public.sleep_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- ---------------------------------------------------------------------------
-- baby_users role vocabulary
--   owner:     creator, full power
--   parent:    full write, sees doctor info, can invite
--   doctor:    read + write logs, NO doctor info, NO invite
--   nurse:     read + write logs (no meds delete)
--   caregiver: read + write logs
--   viewer:    read only
-- ---------------------------------------------------------------------------
alter table public.baby_users drop constraint if exists baby_users_role_check;
alter table public.baby_users add  constraint baby_users_role_check
  check (role in ('owner','parent','doctor','nurse','caregiver','viewer','editor'));
-- Migrate legacy 'editor' → 'parent'. Keep 'editor' in the check for safety
-- but every new write should use the new vocabulary.
update public.baby_users set role = 'parent' where role = 'editor';

-- Refresh write-helper to include the new write-capable roles
create or replace function public.has_baby_write(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid()
      and role in ('owner','parent','doctor','nurse','caregiver','editor')
  );
$$;

-- New helper: is the caller a parent-or-owner? (gates doctor metadata + invites)
create or replace function public.is_baby_parent(b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.baby_users
    where baby_id = b and user_id = auth.uid() and role in ('owner','parent')
  );
$$;
grant execute on function public.is_baby_parent(uuid) to authenticated;

-- Return the caller's role for a given baby. Useful in the UI.
create or replace function public.my_baby_role(b uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.baby_users
  where baby_id = b and user_id = auth.uid()
  limit 1;
$$;
grant execute on function public.my_baby_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- babies: doctor + next appointment (parent-only columns via view)
-- ---------------------------------------------------------------------------
alter table public.babies add column if not exists doctor_name          text;
alter table public.babies add column if not exists doctor_phone         text;
alter table public.babies add column if not exists doctor_clinic        text;
alter table public.babies add column if not exists next_appointment_at  timestamptz;
alter table public.babies add column if not exists next_appointment_notes text;
alter table public.babies add column if not exists blood_type           text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown') or blood_type is null);

-- Everyone with baby access can SELECT the base row (existing policy), but
-- update of the doctor/appointment fields is only meaningful to parents. We
-- don't restrict the SELECT at column level — clients decide whether to
-- display them based on my_baby_role. (Strict server-side column masking would
-- need a view + extra RLS; Supabase's select RLS is row-level only.)

-- ---------------------------------------------------------------------------
-- comments: optional per-day scoping + allow sleep_logs as a target
-- ---------------------------------------------------------------------------
alter table public.comments drop constraint if exists comments_target_table_check;
alter table public.comments add  constraint comments_target_table_check
  check (target_table in
    ('feedings','stool_logs','medications','medication_logs','measurements',
     'temperature_logs','vaccinations','sleep_logs','medical_files','extracted_text','babies'));

alter table public.comments add column if not exists scope_date date;
create index if not exists idx_comments_scope
  on public.comments(baby_id, target_table, target_id, scope_date)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Sleep analytics helpers
-- ---------------------------------------------------------------------------
create or replace function public.sleep_kpis(
  p_baby  uuid,
  p_start timestamptz,
  p_end   timestamptz
) returns table (
  total_min      bigint,
  session_count  bigint,
  avg_min        numeric,
  longest_min    integer,
  last_sleep_at  timestamptz
) language sql stable security definer set search_path = public as $$
  select coalesce(sum(duration_min),0)::bigint                     as total_min,
         count(*)::bigint                                          as session_count,
         coalesce(avg(duration_min),0)::numeric(10,1)              as avg_min,
         coalesce(max(duration_min),0)::int                        as longest_min,
         max(start_at)                                             as last_sleep_at
  from public.sleep_logs
  where baby_id = p_baby
    and deleted_at is null
    and start_at >= p_start and start_at < p_end;
$$;
grant execute on function public.sleep_kpis(uuid, timestamptz, timestamptz) to authenticated;

-- Daily sleep series for the overview insight chart
create or replace function public.daily_sleep_series(
  p_baby uuid,
  p_days int default 14
) returns table (
  day          date,
  total_min    bigint,
  session_count bigint
) language sql stable security definer set search_path = public as $$
  with spine as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as day
  )
  select s.day,
         coalesce(sum(sl.duration_min),0)::bigint,
         count(sl.id)::bigint
  from spine s
  left join public.sleep_logs sl
    on sl.baby_id = p_baby
   and sl.deleted_at is null
   and sl.duration_min is not null
   and sl.start_at::date = s.day
  group by s.day order by s.day;
$$;
grant execute on function public.daily_sleep_series(uuid, int) to authenticated;

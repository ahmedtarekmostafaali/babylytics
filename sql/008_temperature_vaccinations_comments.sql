-- ============================================================================
-- Babylytics — Temperature, Vaccinations, Comments
-- ============================================================================
-- Run in Supabase SQL Editor after applying 001–007. All access is gated
-- through baby_users via the existing helper functions.
-- ============================================================================

-- Temperature logs ----------------------------------------------------------
create table if not exists public.temperature_logs (
    id             uuid primary key default gen_random_uuid(),
    baby_id        uuid not null references public.babies(id) on delete cascade,
    measured_at    timestamptz not null,
    temperature_c  numeric(4,1) not null check (temperature_c > 30 and temperature_c < 45),
    method         text check (method in ('axillary','oral','rectal','ear','forehead','other')) default 'axillary',
    notes          text,
    source         text not null default 'manual' check (source in ('manual','ocr','import')),
    source_file_id uuid references public.medical_files(id) on delete set null,
    created_by     uuid not null references auth.users(id),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    deleted_at     timestamptz
);
create index if not exists idx_temp_baby_time on public.temperature_logs(baby_id, measured_at desc) where deleted_at is null;

-- Vaccinations --------------------------------------------------------------
create table if not exists public.vaccinations (
    id              uuid primary key default gen_random_uuid(),
    baby_id         uuid not null references public.babies(id) on delete cascade,
    vaccine_name    text not null,
    scheduled_at    timestamptz,
    administered_at timestamptz,
    dose_number     int,
    total_doses     int,
    batch_number    text,
    provider        text,
    notes           text,
    status          text not null default 'scheduled'
      check (status in ('scheduled','administered','skipped','missed')),
    created_by      uuid not null references auth.users(id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);
create index if not exists idx_vacc_baby_sched       on public.vaccinations(baby_id, scheduled_at desc) where deleted_at is null;
create index if not exists idx_vacc_baby_administered on public.vaccinations(baby_id, administered_at desc) where deleted_at is null;

-- Comments ------------------------------------------------------------------
-- Polymorphic: attaches to any domain row via (target_table, target_id).
-- Writes require baby_access (viewers may read and comment, same as a chart review).
create table if not exists public.comments (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    target_table  text not null check (target_table in
      ('feedings','stool_logs','medications','medication_logs','measurements',
       'temperature_logs','vaccinations','medical_files','extracted_text','babies')),
    target_id     uuid not null,
    author        uuid not null references auth.users(id),
    body          text not null check (char_length(body) between 1 and 5000),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    deleted_at    timestamptz
);
create index if not exists idx_comments_target on public.comments(target_table, target_id, created_at desc) where deleted_at is null;
create index if not exists idx_comments_baby   on public.comments(baby_id, created_at desc) where deleted_at is null;

-- Updated-at triggers -------------------------------------------------------
drop trigger if exists trg_touch_temperature_logs on public.temperature_logs;
create trigger trg_touch_temperature_logs before update on public.temperature_logs
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_vaccinations on public.vaccinations;
create trigger trg_touch_vaccinations before update on public.vaccinations
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_touch_comments on public.comments;
create trigger trg_touch_comments before update on public.comments
  for each row execute function public.touch_updated_at();

-- Audit triggers ------------------------------------------------------------
drop trigger if exists trg_audit_temperature_logs on public.temperature_logs;
create trigger trg_audit_temperature_logs
  after insert or update or delete on public.temperature_logs
  for each row execute function public.audit_row_change();
drop trigger if exists trg_audit_vaccinations on public.vaccinations;
create trigger trg_audit_vaccinations
  after insert or update or delete on public.vaccinations
  for each row execute function public.audit_row_change();

-- RLS -----------------------------------------------------------------------
alter table public.temperature_logs enable row level security;
alter table public.vaccinations     enable row level security;
alter table public.comments         enable row level security;

drop policy if exists temperature_select on public.temperature_logs;
create policy temperature_select on public.temperature_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists temperature_write on public.temperature_logs;
create policy temperature_write on public.temperature_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

drop policy if exists vaccinations_select on public.vaccinations;
create policy vaccinations_select on public.vaccinations
  for select using (public.has_baby_access(baby_id));
drop policy if exists vaccinations_write on public.vaccinations;
create policy vaccinations_write on public.vaccinations
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- Comments: viewers may read; anyone with access may comment; authors own rows
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select using (public.has_baby_access(baby_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (public.has_baby_access(baby_id) and author = auth.uid());
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update using (author = auth.uid()) with check (author = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete using (author = auth.uid() or public.is_baby_owner(baby_id));

-- Helper RPC to backfill a typical vaccine schedule (age 0..12mo) for a baby.
-- Use from the UI when user asks for "suggested schedule".
create or replace function public.seed_vaccine_schedule(p_baby uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_dob timestamptz; v_actor uuid := auth.uid();
begin
  if not public.has_baby_write(p_baby) then raise exception 'access denied'; end if;
  select dob into v_dob from public.babies where id = p_baby;
  if v_dob is null then raise exception 'baby not found'; end if;

  insert into public.vaccinations(baby_id, vaccine_name, scheduled_at, dose_number, total_doses, status, created_by) values
    (p_baby, 'Hepatitis B',     v_dob + interval '0 days',  1, 3, 'scheduled', v_actor),
    (p_baby, 'Hepatitis B',     v_dob + interval '30 days', 2, 3, 'scheduled', v_actor),
    (p_baby, 'BCG',             v_dob + interval '0 days',  1, 1, 'scheduled', v_actor),
    (p_baby, 'DTaP-IPV-Hib',    v_dob + interval '2 months',  1, 4, 'scheduled', v_actor),
    (p_baby, 'DTaP-IPV-Hib',    v_dob + interval '4 months',  2, 4, 'scheduled', v_actor),
    (p_baby, 'DTaP-IPV-Hib',    v_dob + interval '6 months',  3, 4, 'scheduled', v_actor),
    (p_baby, 'Rotavirus',       v_dob + interval '2 months',  1, 3, 'scheduled', v_actor),
    (p_baby, 'Rotavirus',       v_dob + interval '4 months',  2, 3, 'scheduled', v_actor),
    (p_baby, 'Rotavirus',       v_dob + interval '6 months',  3, 3, 'scheduled', v_actor),
    (p_baby, 'Pneumococcal',    v_dob + interval '2 months',  1, 3, 'scheduled', v_actor),
    (p_baby, 'Pneumococcal',    v_dob + interval '4 months',  2, 3, 'scheduled', v_actor),
    (p_baby, 'Pneumococcal',    v_dob + interval '6 months',  3, 3, 'scheduled', v_actor),
    (p_baby, 'MMR',             v_dob + interval '12 months', 1, 2, 'scheduled', v_actor),
    (p_baby, 'Varicella',       v_dob + interval '12 months', 1, 2, 'scheduled', v_actor),
    (p_baby, 'Hepatitis A',     v_dob + interval '12 months', 1, 2, 'scheduled', v_actor);
end; $$;
grant execute on function public.seed_vaccine_schedule(uuid) to authenticated;

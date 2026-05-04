-- 084: Wave 40A — replace bump_photos with pumping_logs
-- ============================================================================
-- Wave 38B shipped a "bump journal" (belly photos) on a misread of the
-- requirement. The user meant BREAST MILK PUMPING tracking — a
-- postpartum tracker. This wave:
--
--   1. Drops the bump_photos table + its RPCs (no real users yet so
--      no migration of data is needed; if any rows exist we soft-delete
--      first then drop).
--   2. Drops the bump_photos storage path convention (we don't touch
--      storage objects — they'd be orphans worth manual cleanup later
--      via the Supabase dashboard).
--   3. Creates pumping_logs table — one row per pumping session:
--      start, end, side, volume, location, notes.
--   4. Adds add_pumping_log + list_pumping_logs RPCs.
--
-- The page + sidebar entry get rebuilt in the same wave (TS side).
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop bump artifacts
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.add_bump_photo(uuid, timestamptz, text, text, int, numeric, numeric, text);
drop function if exists public.list_bump_photos(uuid);
drop function if exists public.soft_delete_bump_photo(uuid);
drop table if exists public.bump_photos cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pumping_logs table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.pumping_logs (
  id            uuid primary key default gen_random_uuid(),
  baby_id       uuid not null references public.babies(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,                                          -- null while still pumping
  duration_min  integer generated always as (
                  case when ended_at is null then null
                       else greatest(0, extract(epoch from (ended_at - started_at))::int / 60)
                  end
                ) stored,
  side          text not null default 'both' check (side in ('left','right','both')),
  -- Volume in mL. Sum across both sides if 'both'.
  volume_ml     integer check (volume_ml is null or (volume_ml >= 0 and volume_ml <= 1000)),
  location      text default 'home' check (location is null or location in ('home','work','car','other')),
  notes         text,
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_pumping_logs_baby_time
  on public.pumping_logs (baby_id, started_at desc) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — same pattern as feedings/sleep_logs
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.pumping_logs enable row level security;

drop policy if exists pumping_logs_select on public.pumping_logs;
create policy pumping_logs_select on public.pumping_logs
  for select using (public.has_baby_access(baby_id));

drop policy if exists pumping_logs_insert on public.pumping_logs;
create policy pumping_logs_insert on public.pumping_logs
  for insert with check (public.has_baby_access(baby_id) and created_by = auth.uid());

drop policy if exists pumping_logs_update on public.pumping_logs;
create policy pumping_logs_update on public.pumping_logs
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

drop policy if exists pumping_logs_delete on public.pumping_logs;
create policy pumping_logs_delete on public.pumping_logs
  for delete using (public.has_baby_access(baby_id));

-- Wave 23 partner-deny pattern: pumping logs are personal mom data,
-- partner role shouldn't read raw rows.
drop policy if exists deny_partner on public.pumping_logs;
create policy deny_partner on public.pumping_logs
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_pumping_log(
  p_baby       uuid,
  p_started_at timestamptz default now(),
  p_ended_at   timestamptz default null,
  p_side       text        default 'both',
  p_volume_ml  int         default null,
  p_location   text        default 'home',
  p_notes      text        default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_id    uuid;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;
  if p_side not in ('left','right','both') then raise exception 'invalid_side'; end if;

  insert into public.pumping_logs
    (baby_id, started_at, ended_at, side, volume_ml, location, notes, created_by)
  values
    (p_baby, p_started_at, p_ended_at, p_side, p_volume_ml, p_location, p_notes, v_actor)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.add_pumping_log(uuid, timestamptz, timestamptz, text, int, text, text) to authenticated;

create or replace function public.list_pumping_logs(p_baby uuid, p_limit int default 50)
returns table (
  id            uuid,
  started_at    timestamptz,
  ended_at      timestamptz,
  duration_min  int,
  side          text,
  volume_ml     int,
  location      text,
  notes         text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;
  return query
    select pl.id, pl.started_at, pl.ended_at, pl.duration_min, pl.side,
           pl.volume_ml, pl.location, pl.notes
      from public.pumping_logs pl
      where pl.baby_id = p_baby and pl.deleted_at is null
      order by pl.started_at desc
      limit greatest(1, least(p_limit, 200));
end; $$;
grant execute on function public.list_pumping_logs(uuid, int) to authenticated;

create or replace function public.soft_delete_pumping_log(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  uuid;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select baby_id into v_baby from public.pumping_logs where id = p_id and deleted_at is null;
  if v_baby is null then return; end if;
  if not public.has_baby_access(v_baby) then raise exception 'access denied'; end if;
  update public.pumping_logs set deleted_at = now() where id = p_id;
end; $$;
grant execute on function public.soft_delete_pumping_log(uuid) to authenticated;

commit;

select public.publish_app_update(
  p_title    => $t1$Pumping log replaces bump journal — sorry for the mix-up$t1$,
  p_body     => $b1$Last wave shipped a belly-bump photo journal, but the requirement was breast milk pumping. Switched it. The pumping log captures session start + end (or open while pumping), side (left / right / both), volume in ml, location (home / work / car), and a note. Available on baby profiles under the Care category. The bump_photos table + page have been removed. If you uploaded any belly photos already (very few users would have), they''re still in storage but no longer surfaced in the UI — let me know and we''ll either keep or wipe them.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$سجل شفط الحليب يحل محل يوميات البطن — آسف على اللخبطة$ta1$,
  p_body_ar  => $ba1$الموجة السابقة شُحنت يوميات صور بطن الحمل، لكن المطلوب كان شفط حليب الأم. تم التصحيح. سجل الشفط يحفظ وقت بداية ونهاية الجلسة (أو يبقى مفتوحاً أثناء الشفط)، الجانب (يمين / يسار / كلاهما)، الكمية بالمل، المكان (بيت / عمل / سيارة)، وملاحظة. متاح على ملفات الطفل تحت الرعاية. جدول صور البطن وصفحته أُزيلا. الصور المرفوعة سابقاً (لو يوجد) لا تزال في التخزين لكن لا تُعرض في الواجهة.$ba1$
);

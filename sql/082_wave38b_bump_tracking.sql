-- 082: Wave 38B — mother bump tracking (pregnancy belly photo journal)
-- ============================================================================
-- A weekly belly-photo journal for pregnancy profiles. Each entry has
-- an optional photo (stored in the existing medical-files bucket under
-- a per-baby subfolder), an optional belly circumference measurement,
-- and a free-text note. The week number is auto-computed from the
-- baby's LMP/EDD if not supplied so the user can just snap + save.
--
-- Pure pregnancy feature — gated to the pregnancy lifecycle stage at
-- both RLS and the form level. Same RLS pattern as the other
-- pregnancy tables (has_baby_access for read/write, plus the Wave 23
-- deny-partner restrictive policy so partner caregivers can't see raw
-- photos).
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. bump_photos table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.bump_photos (
  id                  uuid primary key default gen_random_uuid(),
  baby_id             uuid not null references public.babies(id) on delete cascade,
  taken_at            timestamptz not null default now(),
  -- Auto-computed from LMP/EDD at insert time when null. 1-42 covers
  -- pre-term to post-term safely.
  gestational_week    int check (gestational_week is null or gestational_week between 1 and 42),
  -- Storage path inside the existing medical-files bucket (uses
  -- babies/{baby_id}/bumps/ subfolder for organization).
  storage_path        text,
  mime_type           text,
  -- Optional belly circumference (cm). Useful for growth tracking
  -- alongside the photo.
  belly_circ_cm       numeric(5,1) check (belly_circ_cm is null or (belly_circ_cm >= 40 and belly_circ_cm <= 200)),
  -- Optional weight at the time of the photo so we can correlate.
  weight_kg           numeric(5,2) check (weight_kg is null or (weight_kg >= 30 and weight_kg <= 200)),
  notes               text,
  created_by          uuid not null references auth.users(id),
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index if not exists idx_bump_photos_baby_taken
  on public.bump_photos (baby_id, taken_at desc)
  where deleted_at is null;

create index if not exists idx_bump_photos_baby_week
  on public.bump_photos (baby_id, gestational_week)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — owner/parent/editor read+write; partner DENY (Wave 23 pattern)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.bump_photos enable row level security;

drop policy if exists bump_photos_select on public.bump_photos;
create policy bump_photos_select on public.bump_photos
  for select using (public.has_baby_access(baby_id));

drop policy if exists bump_photos_insert on public.bump_photos;
create policy bump_photos_insert on public.bump_photos
  for insert with check (public.has_baby_access(baby_id) and created_by = auth.uid());

drop policy if exists bump_photos_update on public.bump_photos;
create policy bump_photos_update on public.bump_photos
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

drop policy if exists bump_photos_delete on public.bump_photos;
create policy bump_photos_delete on public.bump_photos
  for delete using (public.has_baby_access(baby_id));

-- Wave 38B: deny-partner restrictive policy. Same pattern as Wave 23
-- + 36C: bump photos are sensitive personal content the partner
-- shouldn't see by default (the curated PartnerPregnancyView already
-- skips them at the UI layer; this enforces it in the DB too).
drop policy if exists deny_partner on public.bump_photos;
create policy deny_partner on public.bump_photos
  as restrictive for all
  using       (not public.is_baby_partner_only(baby_id))
  with check  (not public.is_baby_partner_only(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. add_bump_photo RPC — insert helper that auto-computes gestational
--    week from LMP/EDD when caller doesn't provide one.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_bump_photo(
  p_baby            uuid,
  p_taken_at        timestamptz default now(),
  p_storage_path    text default null,
  p_mime_type       text default null,
  p_gestational_week int default null,
  p_belly_circ_cm   numeric default null,
  p_weight_kg       numeric default null,
  p_notes           text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  record;
  v_week  int := p_gestational_week;
  v_total_days numeric;
  v_id    uuid;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  select lifecycle_stage, lmp, edd
    into v_baby
    from public.babies where id = p_baby;
  if v_baby.lifecycle_stage <> 'pregnancy' then
    raise exception 'not_a_pregnancy_profile';
  end if;

  -- Auto-compute gestational week from LMP/EDD if not supplied.
  if v_week is null then
    v_total_days := case
      when v_baby.lmp is not null then extract(epoch from (p_taken_at - v_baby.lmp::timestamptz)) / 86400.0
      when v_baby.edd is not null then 280 - extract(epoch from (v_baby.edd::timestamptz - p_taken_at)) / 86400.0
      else null
    end;
    if v_total_days is not null then
      v_week := greatest(1, least(42, floor(v_total_days / 7.0)::int));
    end if;
  end if;

  insert into public.bump_photos
    (baby_id, taken_at, gestational_week, storage_path, mime_type,
     belly_circ_cm, weight_kg, notes, created_by)
  values
    (p_baby, p_taken_at, v_week, p_storage_path, p_mime_type,
     p_belly_circ_cm, p_weight_kg, p_notes, v_actor)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.add_bump_photo(uuid, timestamptz, text, text, int, numeric, numeric, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. list_bump_photos(p_baby) — chronological with signed URLs handled
--    client-side (we just return storage paths).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.list_bump_photos(p_baby uuid)
returns table (
  id               uuid,
  taken_at         timestamptz,
  gestational_week int,
  storage_path     text,
  mime_type        text,
  belly_circ_cm    numeric,
  weight_kg        numeric,
  notes            text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  return query
    select bp.id, bp.taken_at, bp.gestational_week, bp.storage_path,
           bp.mime_type, bp.belly_circ_cm, bp.weight_kg, bp.notes
      from public.bump_photos bp
      where bp.baby_id = p_baby and bp.deleted_at is null
      order by bp.taken_at desc;
end;
$$;
grant execute on function public.list_bump_photos(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. soft_delete_bump_photo
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.soft_delete_bump_photo(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_baby  uuid;
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  select baby_id into v_baby from public.bump_photos where id = p_id and deleted_at is null;
  if v_baby is null then return; end if;
  if not public.has_baby_access(v_baby) then raise exception 'access denied'; end if;
  update public.bump_photos set deleted_at = now() where id = p_id;
end;
$$;
grant execute on function public.soft_delete_bump_photo(uuid) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Bump tracking + nutrition for your lab results$t1$,
  p_body     => $b1$Two things this wave. (1) Pregnancy bump journal: weekly photos + optional belly circumference + a quick note. The gestational week is auto-computed from your LMP/EDD so you can just snap and save. Photos are private to you and parent caregivers — partners on partner-mode never see them. (2) The nutrition card now reads your recent labs (last 6 months) and up-ranks tips that address what your bloodwork flagged as low — low hemoglobin pushes iron-rich Egyptian foods to the top, low vitamin D pushes calcium-rich tips, etc. Each up-ranked tip carries a small "For your labs" badge so you know why it surfaced. Works in English + Arabic, recognises common test name variants (Hgb, hemoglobin, ferritin, فيريتين, etc.).$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$تتبع البطن + تغذية بحسب تحاليلك$ta1$,
  p_body_ar  => $ba1$شيئان في هذه الموجة. (١) يوميات بطن الحمل: صور أسبوعية + قياس محيط البطن (اختياري) + ملاحظة سريعة. أسبوع الحمل يُحسب تلقائياً من LMP/EDD حتى تستطيعي التقاط الصورة وحفظها. الصور خاصة بك وبالرعاة الأهل — الشريك في وضع الشريك لا يراها أبداً. (٢) بطاقة التغذية الآن تقرأ تحاليلك الأخيرة (آخر ٦ شهور) وترفع ترتيب النصائح التي تعالج ما ظهر منخفضاً — هيموجلوبين منخفض يرفع الأطعمة الغنية بالحديد، فيتامين د منخفض يرفع نصائح الكالسيوم، إلخ. كل نصيحة مرفوعة تحمل شارة «لتحاليلك» لتعرفي السبب. تعمل بالعربي والإنجليزي، تتعرف على أسماء التحاليل بأشكالها المختلفة.$ba1$
);

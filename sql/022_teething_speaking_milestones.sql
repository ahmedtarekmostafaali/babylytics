-- 022_teething_speaking_milestones.sql
-- Adds two new top-level trackers (teething, speaking) plus a generic
-- developmental_milestones log for first-occurrence events (first crawl,
-- first word, first step, etc.). Tightens gender constraint to male/female
-- only — backfills any existing 'other'/'unspecified' rows to 'female' so
-- the new check doesn't fail at apply time.
--
-- Uses the existing public.has_baby_access(uuid) and public.has_baby_write(uuid)
-- helper functions (defined in earlier migrations) for row-level security so
-- access stays consistent with the rest of the schema.
--
-- Safe to re-run: every CREATE / ALTER is guarded.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Gender constraint: male | female only.
-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill legacy values so the new constraint can be applied. Choosing
-- 'female' as the safe default for unknown is arbitrary but consistent with
-- the new form default. Parents can flip it from the profile page.
update public.babies
   set gender = 'female'
 where gender is null or gender not in ('male', 'female');

alter table public.babies
  drop constraint if exists babies_gender_check;

alter table public.babies
  add constraint babies_gender_check
  check (gender in ('male', 'female'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. teething_logs — one row per tooth eruption / pain / care event.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.teething_logs (
  id           uuid primary key default gen_random_uuid(),
  baby_id      uuid not null references public.babies(id) on delete cascade,
  observed_at  timestamptz not null default now(),
  -- Which tooth (FDI primary notation) — optional, free-text fallback.
  tooth_label  text,                  -- e.g. "lower central left", "51"
  event_type   text not null check (event_type in ('eruption','swelling','pain','fever','soothing','lost')),
  pain_level   smallint check (pain_level between 0 and 10),
  fever_c      numeric(4,1) check (fever_c is null or (fever_c >= 30 and fever_c <= 45)),
  soother_used text,                  -- "cold ring", "tylenol", "gum gel"…
  notes        text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists teething_logs_baby_time_idx
  on public.teething_logs (baby_id, observed_at desc)
  where deleted_at is null;

alter table public.teething_logs enable row level security;

drop policy if exists teething_logs_member_select on public.teething_logs;
create policy teething_logs_member_select on public.teething_logs
  for select using (public.has_baby_access(baby_id));

drop policy if exists teething_logs_writer on public.teething_logs;
create policy teething_logs_writer on public.teething_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. speaking_logs — first words, vocabulary milestones, articulation notes.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.speaking_logs (
  id            uuid primary key default gen_random_uuid(),
  baby_id       uuid not null references public.babies(id) on delete cascade,
  observed_at   timestamptz not null default now(),
  word_or_phrase text,                -- "mama", "more juice"…
  category      text not null default 'word'
                check (category in ('coo','babble','word','phrase','sentence','other')),
  language      text,                  -- "ar","en","mixed"
  is_first_use  boolean not null default false,
  context       text,                  -- "pointing at bottle", "while waving bye"
  notes         text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists speaking_logs_baby_time_idx
  on public.speaking_logs (baby_id, observed_at desc)
  where deleted_at is null;

alter table public.speaking_logs enable row level security;

drop policy if exists speaking_logs_member_select on public.speaking_logs;
create policy speaking_logs_member_select on public.speaking_logs
  for select using (public.has_baby_access(baby_id));

drop policy if exists speaking_logs_writer on public.speaking_logs;
create policy speaking_logs_writer on public.speaking_logs
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. developmental_milestones — first-occurrence catalog so the dashboard's
--    "Milestones reference" card can compare actual vs typical age. One row
--    per (baby, milestone_id) — uniqueness guarded so re-logging updates
--    rather than spamming.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.developmental_milestones (
  id              uuid primary key default gen_random_uuid(),
  baby_id         uuid not null references public.babies(id) on delete cascade,
  milestone_id    text not null,           -- 'first_tooth' | 'crawling' | 'first_words' | 'walking' | 'first_sentence'
  observed_at     timestamptz not null,    -- when it actually happened
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create unique index if not exists developmental_milestones_unique_active
  on public.developmental_milestones (baby_id, milestone_id)
  where deleted_at is null;

alter table public.developmental_milestones enable row level security;

drop policy if exists developmental_milestones_member_select on public.developmental_milestones;
create policy developmental_milestones_member_select on public.developmental_milestones
  for select using (public.has_baby_access(baby_id));

drop policy if exists developmental_milestones_writer on public.developmental_milestones;
create policy developmental_milestones_writer on public.developmental_milestones
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. updated_at triggers — match the convention of the other log tables.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_teething_logs_set_updated_at on public.teething_logs;
    create trigger trg_teething_logs_set_updated_at
      before update on public.teething_logs
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_speaking_logs_set_updated_at on public.speaking_logs;
    create trigger trg_speaking_logs_set_updated_at
      before update on public.speaking_logs
      for each row execute function public.set_updated_at();

    drop trigger if exists trg_devmilestones_set_updated_at on public.developmental_milestones;
    create trigger trg_devmilestones_set_updated_at
      before update on public.developmental_milestones
      for each row execute function public.set_updated_at();
  end if;
end $$;

commit;

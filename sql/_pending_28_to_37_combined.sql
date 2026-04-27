-- ═══════════════════════════════════════════════════════════════════════
-- Babylytics — combined migration bundle (028 → 037)
-- ═══════════════════════════════════════════════════════════════════════
--
-- One-shot script that applies every pending migration from this batch
-- in the right order. Idempotent — safe to re-run.
--
-- Paste the whole file into the Supabase SQL editor and run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 0a. Cleanup: drop any existing publish_app_update overloads.
-- ─────────────────────────────────────────────────────────────────────
-- If a previous partial run created BOTH the 4-arg (from 029) and the
-- 6-arg (from 036) overloads, calls in 030–035 with three positional
-- text arguments become ambiguous (Postgres error 42725). Drop both
-- explicitly so 029 can recreate the 4-arg cleanly and 036 replaces
-- it with the 6-arg version. The drops are harmless on a fresh DB.
drop function if exists public.publish_app_update(text, text, text, date);
drop function if exists public.publish_app_update(text, text, text, date, text, text);

-- ─────────────────────────────────────────────────────────────────────
-- 028_per_user_notification_reads.sql
-- Per-user notification reads
-- ─────────────────────────────────────────────────────────────────────
-- 028: Per-user notification read state.
--
-- Bug:  the existing notifications.read_at column is a single field on the row.
--       For broadcast notifications (user_id IS NULL — every caregiver of the
--       baby sees them), one user marking them as read flipped read_at for
--       everyone else too. The dashboard's unread badge then drifted out of
--       sync per user.
-- Fix:  introduce notification_reads(notification_id, user_id) — one row per
--       (broadcast, user) marked as read. Personal notifications still use
--       notifications.read_at directly. mark_notifications_read writes to the
--       new table for broadcasts and updates read_at for personal rows.
--
-- Also: extend the notifications.kind check to include 'app_update' so the
--       upcoming /updates page can broadcast a notification on each release.

-- New table — one row per (notification_id, user_id) the user has dismissed.
create table if not exists public.notification_reads (
    notification_id uuid not null references public.notifications(id) on delete cascade,
    user_id         uuid not null references auth.users(id) on delete cascade,
    read_at         timestamptz not null default now(),
    primary key (notification_id, user_id)
);

create index if not exists idx_notification_reads_user
  on public.notification_reads(user_id, notification_id);

-- RLS — a user can only see/insert their own read marks.
alter table public.notification_reads enable row level security;

drop policy if exists notif_reads_select_own on public.notification_reads;
create policy notif_reads_select_own on public.notification_reads
  for select using (user_id = auth.uid());

drop policy if exists notif_reads_insert_own on public.notification_reads;
create policy notif_reads_insert_own on public.notification_reads
  for insert with check (user_id = auth.uid());

-- Allow 'app_update' as a kind. ALTER TABLE / DROP CONSTRAINT is idempotent
-- under the IF EXISTS guard.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add  constraint notifications_kind_check
  check (kind in (
    'medication_due','medication_missed','low_ocr_confidence',
    'file_ready','feeding_alert','stool_alert',
    'app_update'
  ));

-- Helper: returns true if the calling user has unread access to this row.
-- - personal row (user_id = me): unread iff read_at is null
-- - broadcast row (user_id is null): unread iff no notification_reads row for me
create or replace function public.notification_unread_for_user(
  p_notification public.notifications,
  p_user uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_notification.user_id = p_user then p_notification.read_at is null
    when p_notification.user_id is null  then not exists (
      select 1 from public.notification_reads r
      where r.notification_id = p_notification.id and r.user_id = p_user
    )
    else false
  end;
$$;
grant execute on function public.notification_unread_for_user(public.notifications, uuid) to authenticated;

-- Re-define mark_notifications_read so broadcasts get a per-user notification_reads
-- row instead of stomping read_at globally. Personal rows still update read_at.
create or replace function public.mark_notifications_read(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
        v_personal integer;
        v_broadcast integer;
begin
  if not public.has_baby_access(p_baby) then raise exception 'forbidden'; end if;

  -- Personal notifications addressed to this user only.
  with upd as (
    update public.notifications
       set read_at = now()
     where baby_id = p_baby
       and user_id = v_user
       and read_at is null
     returning 1
  )
  select count(*)::integer into v_personal from upd;

  -- Broadcast notifications — record per-user reads. Skip ones already marked.
  with ins as (
    insert into public.notification_reads (notification_id, user_id, read_at)
    select n.id, v_user, now()
      from public.notifications n
     where n.baby_id = p_baby
       and n.user_id is null
       and not exists (
         select 1 from public.notification_reads r
         where r.notification_id = n.id and r.user_id = v_user
       )
    returning 1
  )
  select count(*)::integer into v_broadcast from ins;

  return coalesce(v_personal, 0) + coalesce(v_broadcast, 0);
end; $$;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- clear_notifications was an alias — keep it that way so the UI keeps working.
create or replace function public.clear_notifications(p_baby uuid)
returns integer language plpgsql security definer set search_path = public as $$
begin
  return public.mark_notifications_read(p_baby);
end; $$;
grant execute on function public.clear_notifications(uuid) to authenticated;

-- Single-row dismiss helper used by the bell's per-item Mark-read button.
-- Same semantics as mark_notifications_read but scoped to one notification.
create or replace function public.mark_one_notification_read(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
        v_user_id uuid;
        v_baby_id uuid;
begin
  select n.user_id, n.baby_id into v_user_id, v_baby_id
    from public.notifications n where n.id = p_id;
  if not found then return; end if;
  if not public.has_baby_access(v_baby_id) then raise exception 'forbidden'; end if;

  if v_user_id = v_user then
    update public.notifications set read_at = now() where id = p_id and read_at is null;
  elsif v_user_id is null then
    insert into public.notification_reads (notification_id, user_id, read_at)
      values (p_id, v_user, now())
      on conflict (notification_id, user_id) do nothing;
  end if;
end; $$;
grant execute on function public.mark_one_notification_read(uuid) to authenticated;

-- View used by the dashboard + bell to filter unread per-user. The Supabase
-- client filters on this view with .or(...) etc. We expose a thin wrapper
-- function to make the per-user check simple at the SQL layer.
create or replace function public.my_unread_notifications(p_baby uuid default null)
returns setof public.notifications
language sql stable security definer set search_path = public as $$
  select n.*
    from public.notifications n
   where (p_baby is null or n.baby_id = p_baby)
     and (n.user_id = auth.uid() or n.user_id is null)
     and public.notification_unread_for_user(n, auth.uid())
   order by n.created_at desc;
$$;
grant execute on function public.my_unread_notifications(uuid) to authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 029_app_updates.sql
-- App updates / changelog table + broadcast trigger
-- ─────────────────────────────────────────────────────────────────────
-- 029: App-wide update log + automatic broadcast notification.
--
-- Adds /updates as a parent-visible changelog so users can see what's
-- shipping, sorted by category. Whenever a row is inserted, a trigger emits a
-- broadcast notification (notifications.user_id IS NULL) for every baby the
-- user has access to, with kind='app_update' and a deep link to /updates.
--
-- Per-user read state is handled by migration 028's notification_reads, so
-- one user dismissing the broadcast doesn't hide it from anyone else.

-- ────────────────────────────────────────────────────────────────────────────
-- Table
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_updates (
    id            uuid primary key default gen_random_uuid(),
    title         text not null,
    body          text,
    category      text not null check (category in ('bug_fix','new_feature','enhancement')),
    published_at  date not null default current_date,
    created_at    timestamptz not null default now(),
    created_by    uuid references auth.users(id) on delete set null
);

create index if not exists idx_app_updates_published
  on public.app_updates(published_at desc, created_at desc);
create index if not exists idx_app_updates_category
  on public.app_updates(category, published_at desc);
-- Unique guard so re-running seed migrations is idempotent. Created
-- here (above the function + seed inserts) so the function's
-- ON CONFLICT clause and the seed inserts both have a valid target.
create unique index if not exists idx_app_updates_seed_uniq
  on public.app_updates(title, published_at);

-- Anyone authenticated can read the changelog. Inserts/updates/deletes are
-- restricted at the RPC layer below (security definer) so we don't need a
-- write policy.
alter table public.app_updates enable row level security;

drop policy if exists app_updates_select_all on public.app_updates;
create policy app_updates_select_all on public.app_updates
  for select to authenticated
  using (true);

-- ────────────────────────────────────────────────────────────────────────────
-- Broadcast trigger
-- ────────────────────────────────────────────────────────────────────────────
--
-- For each baby in the system, insert ONE notification with user_id IS NULL.
-- That row is shared by every caregiver of that baby; per-user dismiss state
-- is in notification_reads (migration 028). On the dashboard, broadcasts ride
-- alongside personal notifications via my_unread_notifications.
--
-- Skipping deleted babies — soft-deleted ones (deleted_at IS NOT NULL) are
-- effectively archived and shouldn't generate noise.

create or replace function public._broadcast_app_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (baby_id, user_id, kind, payload)
  select b.id,
         null,
         'app_update',
         jsonb_build_object(
           'update_id', new.id,
           'title',     new.title,
           'category',  new.category
         )
    from public.babies b
   where b.deleted_at is null;
  return new;
end; $$;

drop trigger if exists trg_app_update_broadcast on public.app_updates;
create trigger trg_app_update_broadcast
  after insert on public.app_updates
  for each row execute procedure public._broadcast_app_update();

-- ────────────────────────────────────────────────────────────────────────────
-- Publish helper — the only write path. Lets you ship from the SQL editor
-- without worrying about RLS or trigger plumbing. Returns the new id.
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.publish_app_update(
  p_title    text,
  p_body     text,
  p_category text,
  p_date     date default current_date
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_category not in ('bug_fix','new_feature','enhancement') then
    raise exception 'invalid category %', p_category;
  end if;

  -- ON CONFLICT (title, published_at) keeps this idempotent — a seed
  -- migration (or a re-run of an in-place migration) calling with the
  -- same title+date refreshes the body instead of raising 23505 against
  -- the idx_app_updates_seed_uniq unique index defined alongside the
  -- table at the top of this migration.
  insert into public.app_updates (title, body, category, published_at, created_by)
       values (p_title, p_body, p_category, p_date, auth.uid())
    on conflict (title, published_at) do update
       set body = excluded.body
     returning id into v_id;

  return v_id;
end; $$;

-- Don't grant to authenticated by default — keep this admin-only. To allow
-- it for a specific user, run `grant execute … to authenticated;` manually.

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: backfill the most material recent shipments so the page lights up on
-- first deploy. Dates are approximations grouped by Vercel deploy windows.
-- Safe to re-run — the unique (title, published_at) guard above
-- (idx_app_updates_seed_uniq) makes ON CONFLICT DO NOTHING work.
-- ────────────────────────────────────────────────────────────────────────────

insert into public.app_updates (title, body, category, published_at)
values
  -- Fixes
  ('Per-user notification reads',
   'Broadcast notifications now track read state per user — dismissing a notification on one device no longer hides it from other caregivers.',
   'bug_fix', current_date),
  ('Sidebar keeps per-baby section visible on Preferences',
   'Navigating to Preferences (or any global page) no longer collapses the per-baby tracker links — the sidebar remembers the last baby you opened.',
   'bug_fix', current_date),
  ('WhatsApp setup QR code renders again',
   'Whitelisted the QR provider in the security policy so the one-time WhatsApp join QR loads in the Preferences page.',
   'bug_fix', current_date),

  -- Features
  ('Bilingual UI — English + Arabic',
   'Every parent-facing surface (dashboard, trackers, smart scan, medical profile, reports, auth) now flips to Arabic when you change your language preference. Direction-aware (RTL) and persists across sessions.',
   'new_feature', current_date - 1),
  ('Pre-login language toggle on the home page',
   'Visitors can switch the marketing landing and auth screens between English and Arabic before signing in. Your saved preference always wins after sign-in.',
   'new_feature', current_date),
  ('Updates page',
   'This page — a running log of every bug fix, feature, and enhancement, grouped and dated, with a notification when something new ships.',
   'new_feature', current_date),
  ('WhatsApp dose reminders',
   'Active medications can opt in to WhatsApp reminders 15 minutes before each scheduled dose, with a single-tap "Please log the dose once done" prompt.',
   'new_feature', current_date - 7),
  ('Smart Scan extends to lab panels & ultrasounds',
   'OCR now extracts structured rows from lab reports and ultrasound scans in addition to feedings/stool/medications.',
   'new_feature', current_date - 10),
  ('Pregnancy mode',
   'Track ultrasounds, prenatal visits, kicks, maternal vitals, and weekly insights. Mark-as-born transitions everything to the newborn tracker without losing data.',
   'new_feature', current_date - 14),
  ('Medical profile aggregate page',
   'A portable health record combining allergies, conditions, hospitalizations, lab results, medications, and care team into one shareable export.',
   'new_feature', current_date - 14),

  -- Enhancements
  ('Comprehensive translations across every form',
   'All 20+ form components, every list/detail page, the OCR review surface, and the printable full report fully translate now.',
   'enhancement', current_date - 1),
  ('Per-user dashboard customization',
   'Each user can hide individual KPI cards / sections from their dashboard and full report independently of other caregivers on the same baby.',
   'enhancement', current_date - 21),
  ('Mobile PDF + image export',
   'Save Report works on iPhone and Android — picks PDF (A4 fit) or PNG, with a Share button that opens the native share sheet.',
   'enhancement', current_date - 30)
on conflict (title, published_at) do nothing;


-- ─────────────────────────────────────────────────────────────────────
-- 030_maternal_symptoms.sql
-- Maternal symptoms tracker
-- ─────────────────────────────────────────────────────────────────────
-- 030: Maternal symptoms tracker.
--
-- Logs how the pregnant parent is feeling — dizziness, nausea, vomiting, etc.
-- Each row is one observation. severity is 1..5 (1 = mild, 5 = severe).
-- Used by the new /prenatal/symptoms tracker page and surfaces as a recent-
-- symptom card on the pregnancy dashboard.

create table if not exists public.maternal_symptoms (
    id          uuid primary key default gen_random_uuid(),
    baby_id     uuid not null references public.babies(id) on delete cascade,
    logged_at   timestamptz not null default now(),
    kind        text not null check (kind in (
      'nausea','vomiting','dizziness','headache','swelling',
      'contractions','fatigue','heartburn','back_pain',
      'mood_swings','cramping','breathlessness','other'
    )),
    severity    int  not null check (severity between 1 and 5),
    notes       text,
    deleted_at  timestamptz,
    created_at  timestamptz not null default now(),
    created_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_maternal_symptoms_baby_logged
  on public.maternal_symptoms(baby_id, logged_at desc) where deleted_at is null;
create index if not exists idx_maternal_symptoms_kind
  on public.maternal_symptoms(baby_id, kind, logged_at desc) where deleted_at is null;

alter table public.maternal_symptoms enable row level security;

drop policy if exists maternal_symptoms_select on public.maternal_symptoms;
create policy maternal_symptoms_select on public.maternal_symptoms
  for select using (public.has_baby_access(baby_id));

drop policy if exists maternal_symptoms_write on public.maternal_symptoms;
create policy maternal_symptoms_write on public.maternal_symptoms
  for insert with check (public.has_baby_access(baby_id));

drop policy if exists maternal_symptoms_update on public.maternal_symptoms;
create policy maternal_symptoms_update on public.maternal_symptoms
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

-- Publish the changelog entry for this shipment.
select public.publish_app_update(
  'Pregnancy: maternal symptoms tracker',
  'Log dizziness, nausea, vomiting, headache, swelling, fatigue, contractions and more on a 1–5 severity scale. Recent symptoms surface on the pregnancy dashboard so you can see patterns over the week.',
  'new_feature'
);

select public.publish_app_update(
  'Pregnancy: daily baby-size expectations',
  'The pregnancy dashboard now shows what your baby is approximately the size and weight of TODAY (interpolated between weekly milestones), and overlays your most recent ultrasound EFW so you can see how on-track your baby is.',
  'new_feature'
);

select public.publish_app_update(
  'Pregnancy: what-to-expect by week, month, and trimester',
  'Expanded the weekly insight card on the pregnancy dashboard with what-to-expect content rolled up at three time scales — this week, this month, and this trimester — covering mom symptoms, baby development, and to-dos.',
  'enhancement'
);


-- ─────────────────────────────────────────────────────────────────────
-- 031_audit_signatures.sql
-- Audit signatures (logged-by / edited-by name lookups)
-- ─────────────────────────────────────────────────────────────────────
-- 031: Audit signatures — display "logged by Sarah · 2 hours ago" /
-- "edited by Ahmed · just now" on every record.
--
-- Two pieces:
--  1. user_display_names(uids[]) — security-definer helper to resolve a batch
--     of auth user UUIDs to friendly display names with email-prefix fallback.
--  2. row_audit_summaries(table, ids[]) — for a given log table + a batch of
--     row ids, return {created_by, created_at, last_updated_by, last_updated_at}.
--     created_* come from the row itself; last_updated_* come from audit_log
--     (latest UPDATE entry for that row).
--
-- Also: extend the audit_row_change trigger to all the newer log tables so
-- their UPDATEs land in audit_log. The trigger function itself is unchanged.

-- ---------------------------------------------------------------------------
-- 1) User display names
-- ---------------------------------------------------------------------------
create or replace function public.user_display_names(p_ids uuid[])
returns table(id uuid, name text, email text)
language sql security definer set search_path = public, auth as $$
  select
    p.id,
    coalesce(nullif(trim(p.display_name), ''), split_part(p.email, '@', 1)) as name,
    p.email::text as email
  from public.profiles p
  where p.id = any(coalesce(p_ids, '{}'::uuid[]));
$$;

revoke all on function public.user_display_names(uuid[]) from public;
grant execute on function public.user_display_names(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Row audit summaries
-- ---------------------------------------------------------------------------
-- Whitelist of tables we'll surface audit signatures for. We keep this tight
-- to avoid the helper being abused as a generic table-scanner. Add more as
-- new log tables ship.
create or replace function public.row_audit_summaries(
  p_table text,
  p_ids uuid[]
)
returns table(
  row_id uuid,
  created_by uuid,
  created_at timestamptz,
  last_updated_by uuid,
  last_updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array[
    'feedings','stool_logs','sleep_logs','medications','medication_logs',
    'measurements','temperature_logs','vaccinations',
    'screen_time_logs','activity_logs','teething_logs','speaking_logs',
    'developmental_milestones','shopping_list_items','allergies',
    'medical_conditions','admissions','discharges','lab_panels','lab_panel_items',
    'doctors','appointments','prenatal_visits','ultrasounds','fetal_movements',
    'maternal_symptoms','medical_files'
  ];
  q text;
begin
  if not (p_table = any(allowed)) then
    raise exception 'row_audit_summaries: table % not allowed', p_table;
  end if;

  -- We have to validate access: the underlying tables already enforce RLS
  -- when we query them via authenticated session, but this function runs
  -- security-definer. So we re-select through a sub-query that applies the
  -- same baby-access rule by joining to the table and checking has_baby_access.
  q := format($f$
    with rows as (
      select id, baby_id, created_by, created_at
      from public.%I
      where id = any($1)
        and public.has_baby_access(baby_id)
    ),
    upd as (
      select row_id,
             max(edited_at)                                                    as last_updated_at,
             (array_agg(edited_by order by edited_at desc) filter (where edited_by is not null))[1]
                                                                               as last_updated_by
      from public.audit_log
      where table_name = %L
        and operation = 'UPDATE'
        and row_id = any($1)
      group by row_id
    )
    select r.id, r.created_by, r.created_at, u.last_updated_by, u.last_updated_at
    from rows r
    left join upd u on u.row_id = r.id
  $f$, p_table, p_table);
  return query execute q using p_ids;
end;
$$;

revoke all on function public.row_audit_summaries(text, uuid[]) from public;
grant execute on function public.row_audit_summaries(text, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Extend audit_row_change trigger to all log tables so UPDATEs are tracked.
--    Idempotent — re-running just re-creates the triggers.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'feedings','stool_logs','sleep_logs','medications','medication_logs',
    'measurements','temperature_logs','vaccinations',
    'screen_time_logs','activity_logs','teething_logs','speaking_logs',
    'developmental_milestones','shopping_list_items','allergies',
    'medical_conditions','admissions','discharges','lab_panels','lab_panel_items',
    'doctors','appointments','prenatal_visits','ultrasounds','fetal_movements',
    'maternal_symptoms'
  ])
  loop
    -- Only attach if the table actually exists in this schema (defensive
    -- because some installs may not have certain tables yet).
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('drop trigger if exists trg_audit_%I on public.%I;', t, t);
      execute format('create trigger trg_audit_%I
                      after insert or update or delete on public.%I
                      for each row execute function public.audit_row_change();', t, t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Publish the changelog entry.
-- ---------------------------------------------------------------------------
select public.publish_app_update(
  'Audit trail: who logged it, who edited it',
  'Every record now shows who originally logged it and who last edited it (by name, not email), with relative timestamps. Helpful when multiple caregivers share a baby — you always know who entered or changed each entry.',
  'enhancement'
);


-- ─────────────────────────────────────────────────────────────────────
-- 032_cow_milk_template.sql
-- Allergy quick-pick + cow's-milk allergy guide changelog
-- ─────────────────────────────────────────────────────────────────────
-- 032: Allergy templates — quick-pick chips on the allergy form, with a
-- deeper guidance panel for cow's milk protein allergy (CMPA), the most
-- common infant food allergy. Pure UI/copy change — no schema modifications.

select public.publish_app_update(
  'Allergy quick-pick + cow''s milk allergy guide',
  'The allergy form now has quick-pick chips for the most common allergens (cow''s milk, peanut, egg, soy, wheat, sesame, fish, shellfish, tree nuts, penicillin, latex) so you don''t have to type the same thing every time. When you log a cow''s-milk allergy you also get a parent-friendly guidance card covering symptoms, hidden sources to avoid, formula and food alternatives, red-flag signs that need urgent care, and the typical "outgrows it by 3–5 years" outlook — in English and Arabic.',
  'new_feature'
);


-- ─────────────────────────────────────────────────────────────────────
-- 033_home_page_rewrite.sql
-- Home page rewrite changelog
-- ─────────────────────────────────────────────────────────────────────
-- 033: Home page rewrite — comprehensive feature showcase. Pure UI / copy
-- change, no schema modifications. Just publishes the changelog entry.

select public.publish_app_update(
  'New home page with the full feature catalog',
  'The babylytics.org landing page is rewritten. New: a four-stage timeline (pregnancy → newborn → infant → toddler), a categorised feature grid (vital signs / care / pregnancy / development), a pregnancy spotlight with a daily fetal-size mockup and IOM weight-gain band, a family-and-roles section showing the per-record audit trail and caregiver feed, and a "What''s new" strip linked to /updates. Smart Scan, bilingual EN/AR, and WhatsApp dose reminders now have their own callouts.',
  'enhancement'
);


-- ─────────────────────────────────────────────────────────────────────
-- 034_voice_commander.sql
-- Voice commander v1 changelog
-- ─────────────────────────────────────────────────────────────────────
-- 034: Voice commander — bilingual (English + Egyptian Arabic) voice
-- logging via the browser's native Web Speech API. UI-only feature, no
-- new tables — voice writes go to the same feedings / stool_logs /
-- sleep_logs / temperature_logs / fetal_movements / comments tables as
-- the manual forms (and the same RLS + audit triggers apply).

select public.publish_app_update(
  'Voice logging — speak to log feedings, sleep, diapers and more',
  'Tap the new mic icon next to the bell on any baby dashboard, then speak. Examples: "log a feeding 120 ml bottle", "diaper change large", "nap 45 minutes", "temperature 37.5", "kick". Egyptian Arabic also works — try «سجّل رضعة ١٢٠ مل زجاجة» or «نام ٤٥ دقيقة». Babylytics parses what it heard and shows a confirm card before anything is saved — no surprises. Works in Chrome, Edge and Safari (Web Speech API).',
  'new_feature'
);


-- ─────────────────────────────────────────────────────────────────────
-- 035_voice_bilingual_autodetect.sql
-- Voice bilingual auto-detect changelog
-- ─────────────────────────────────────────────────────────────────────
-- 035: Voice commander now auto-detects English and Arabic in the same
-- session, regardless of UI language preference. Pure UI/copy change —
-- no schema modifications.

select public.publish_app_update(
  'Voice logging is now bilingual — auto-detects EN and AR',
  'You no longer need to switch your app language to log by voice in the other language. Babylytics runs both English and Arabic intent parsers against every transcript and uses whichever matches. The voice modal now has its own EN / ع toggle for the speech-recognition engine (independent of the app language) and shows a small "EN detected" / "AR detected" tag on the heard text so you know which grammar was used. Examples for both languages are shown side-by-side.',
  'enhancement'
);


-- ─────────────────────────────────────────────────────────────────────
-- 036_arabic_updates_and_fixes.sql
-- Arabic columns on app_updates + 5 QA fixes
-- ─────────────────────────────────────────────────────────────────────
-- 036: Bug-fix + Arabic-content batch.
--
-- Issues addressed (from QA screenshots):
--   * Notifications dropdown clipped by the pregnancy hero card's
--     overflow-hidden — fixed in NotificationsBell.tsx by rendering
--     the panel via React portal.
--   * Sidebar logo / wordmark click → goes to '/' (homepage) now,
--     not '/dashboard'.
--   * Home page (app/page.tsx) didn't translate to Arabic — fixed in
--     code by routing every string through tFor(). New i18n keys live
--     under `landing.*` in messages.{en,ar}.ts.
--   * /updates page rendered the changelog title + body in English
--     only. This migration adds optional `title_ar` + `body_ar`
--     columns to `app_updates`, extends publish_app_update() to
--     accept them, and backfills every existing entry with Arabic
--     copy so Arabic users see localised changelog from day one.
--   * Measurements "Growth trend" + "Growth so far" stayed stale
--     when the latest measurement was weight-only (or height-only) —
--     fixed in app/babies/[babyId]/measurements/page.tsx with a
--     per-field latest-non-null walk.
--
-- This migration is idempotent: re-running it on top of itself is
-- safe (alter table … if not exists, on-conflict updates).

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ────────────────────────────────────────────────────────────────────────────

alter table public.app_updates
  add column if not exists title_ar text,
  add column if not exists body_ar  text;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Replace publish_app_update with a 6-arg version that accepts the
--    optional Arabic strings. We DROP the original 4-arg overload first
--    so callers using positional 3-arg syntax don't hit "is not unique"
--    (Postgres 42725) when both overloads coexist.
-- ────────────────────────────────────────────────────────────────────────────

drop function if exists public.publish_app_update(text, text, text, date);

create or replace function public.publish_app_update(
  p_title    text,
  p_body     text,
  p_category text,
  p_date     date default current_date,
  p_title_ar text default null,
  p_body_ar  text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_category not in ('bug_fix','new_feature','enhancement') then
    raise exception 'invalid category %', p_category;
  end if;

  insert into public.app_updates (title, body, category, published_at, title_ar, body_ar, created_by)
       values (p_title, p_body, p_category, p_date, p_title_ar, p_body_ar, auth.uid())
    on conflict (title, published_at) do update
       set body     = excluded.body,
           title_ar = coalesce(excluded.title_ar, public.app_updates.title_ar),
           body_ar  = coalesce(excluded.body_ar,  public.app_updates.body_ar)
     returning id into v_id;

  return v_id;
end; $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Backfill Arabic copy for every existing changelog entry.
--    Safe to re-run — `update … where title_ar is null` keeps it idempotent.
-- ────────────────────────────────────────────────────────────────────────────

update public.app_updates set
  title_ar = 'حالة قراءة الإشعارات لكل مستخدم',
  body_ar  = 'الإشعارات العامة الآن تتذكر حالة القراءة لكل مستخدم على حدة — إغلاق إشعار من جهاز لا يخفيه عن باقي مقدمي الرعاية.'
 where title = 'Per-user notification reads' and title_ar is null;

update public.app_updates set
  title_ar = 'الشريط الجانبي يحافظ على قسم الطفل عند فتح التفضيلات',
  body_ar  = 'الانتقال إلى التفضيلات أو أي صفحة عامة لم يعد يطوي روابط متابعة الطفل — الشريط الجانبي يتذكر آخر طفل فتحته.'
 where title = 'Sidebar keeps per-baby section visible on Preferences' and title_ar is null;

update public.app_updates set
  title_ar = 'كود الـ QR لإعداد واتساب يظهر مجددًا',
  body_ar  = 'أضفنا مزود الـ QR للقائمة المسموح بها في سياسة الأمان حتى يظهر كود واتساب لمرة واحدة في صفحة التفضيلات.'
 where title = 'WhatsApp setup QR code renders again' and title_ar is null;

update public.app_updates set
  title_ar = 'واجهة ثنائية اللغة — العربية والإنجليزية',
  body_ar  = 'كل واجهة موجهة للأهل (لوحة التحكم، المتابعات، السكان الذكي، الملف الطبي، التقارير، تسجيل الدخول) تتحول للعربية عند تغيير اللغة. تدعم اتجاه النص (RTL) وتُحفظ بين الجلسات.'
 where title = 'Bilingual UI — English + Arabic' and title_ar is null;

update public.app_updates set
  title_ar = 'تبديل اللغة قبل تسجيل الدخول من الصفحة الرئيسية',
  body_ar  = 'الزوار يستطيعون التبديل بين الإنجليزية والعربية في الصفحة الرئيسية وشاشات تسجيل الدخول قبل إنشاء حساب. تفضيلك المحفوظ يسود بعد تسجيل الدخول.'
 where title = 'Pre-login language toggle on the home page' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة الجديد',
  body_ar  = 'هذه الصفحة — سجل مستمر لكل إصلاح خطأ وميزة وتحسين، مجمّعة ومؤرّخة، مع إشعار عند نزول جديد.'
 where title = 'Updates page' and title_ar is null;

update public.app_updates set
  title_ar = 'تذكيرات جرعات واتساب',
  body_ar  = 'الأدوية النشطة يمكن تفعيل تذكيرات واتساب لها قبل ١٥ دقيقة من كل جرعة، مع زر «سجّل الجرعة بعد الإعطاء».'
 where title = 'WhatsApp dose reminders' and title_ar is null;

update public.app_updates set
  title_ar = 'السكان الذكي يمتد لتحاليل المعمل والسونار',
  body_ar  = 'OCR يستخرج الآن صفوفًا منظمة من تقارير المعمل ومسوحات السونار بالإضافة إلى الرضعات والبراز والأدوية.'
 where title = 'Smart Scan extends to lab panels & ultrasounds' and title_ar is null;

update public.app_updates set
  title_ar = 'وضع الحمل',
  body_ar  = 'تابعي السونار، زيارات قبل الولادة، الركلات، علامات الأم الحيوية، والرؤى الأسبوعية. زر «تسجيل الولادة» يحوّل كل شيء لوضع الرضيع دون فقد بيانات.'
 where title = 'Pregnancy mode' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة الملف الطبي المجمع',
  body_ar  = 'سجل صحي محمول يجمع الحساسيات والحالات والإقامات بالمستشفى ونتائج المعمل والأدوية وفريق الرعاية في تصدير واحد قابل للمشاركة.'
 where title = 'Medical profile aggregate page' and title_ar is null;

update public.app_updates set
  title_ar = 'ترجمة شاملة عبر كل النماذج',
  body_ar  = 'كل النماذج (٢٠+)، كل صفحات القوائم والتفاصيل، شاشة مراجعة OCR، وتقرير القابل للطباعة الكامل تترجم بالكامل الآن.'
 where title = 'Comprehensive translations across every form' and title_ar is null;

update public.app_updates set
  title_ar = 'تخصيص لوحة التحكم لكل مستخدم',
  body_ar  = 'كل مستخدم يستطيع إخفاء بطاقات KPI أو أقسام بعينها من لوحة التحكم والتقرير الكامل بشكل مستقل عن مقدمي الرعاية الآخرين.'
 where title = 'Per-user dashboard customization' and title_ar is null;

update public.app_updates set
  title_ar = 'تصدير PDF وصورة من الموبايل',
  body_ar  = 'حفظ التقرير يعمل على آيفون وأندرويد — اختاري PDF (مقاس A4) أو PNG، مع زر مشاركة يفتح قائمة المشاركة الأصلية للنظام.'
 where title = 'Mobile PDF + image export' and title_ar is null;

-- Phase A–E backfill (the recent ones from this session).
update public.app_updates set
  title_ar = 'تتبع أعراض الحمل',
  body_ar  = 'سجلي الدوخة والغثيان والقيء والصداع والتورم والإرهاق والتقلصات وأكثر على مقياس شدة من ١ إلى ٥. الأعراض الأخيرة تظهر على لوحة الحمل.'
 where title = 'Pregnancy: maternal symptoms tracker' and title_ar is null;

update public.app_updates set
  title_ar = 'حجم الطفل اليومي خلال الحمل',
  body_ar  = 'لوحة الحمل تعرض الآن حجم طفلك تقريبًا ووزنه اليوم (بالاستيفاء بين الأسابيع) مع وزن السونار الأخير لمقارنة مدى تطابقه.'
 where title = 'Pregnancy: daily baby-size expectations' and title_ar is null;

update public.app_updates set
  title_ar = 'ما يمكن توقعه أسبوعيًا وشهريًا وكل ثلث',
  body_ar  = 'بطاقة الرؤية الأسبوعية على لوحة الحمل أصبحت تشمل ما يمكن توقعه على ثلاثة مقاييس زمنية — هذا الأسبوع، هذا الشهر، هذا الثلث — تغطي أعراض الأم وتطور الطفل والمهام.'
 where title = 'Pregnancy: what-to-expect by week, month, and trimester' and title_ar is null;

update public.app_updates set
  title_ar = 'سجل التتبع: من سجّل الإدخال ومن قام بتعديله',
  body_ar  = 'كل سجل يعرض الآن من أدخله أصلًا ومن قام بآخر تعديل (بالاسم، ليس بالبريد) مع التوقيت النسبي. مفيد عندما يشترك أكثر من مقدم رعاية في نفس الطفل.'
 where title = 'Audit trail: who logged it, who edited it' and title_ar is null;

update public.app_updates set
  title_ar = 'اختيار سريع للحساسية + دليل حساسية حليب البقر',
  body_ar  = 'نموذج الحساسية الآن به اختيارات سريعة لأكثر مسببات الحساسية شيوعًا (حليب البقر، الفول السوداني، البيض، الصويا، القمح، السمسم، الأسماك، القشريات، المكسرات، البنسلين، اللاتكس). عند تسجيل حساسية حليب البقر تظهر بطاقة إرشادية شاملة بالعربية والإنجليزية.'
 where title = 'Allergy quick-pick + cow''s milk allergy guide' and title_ar is null;

update public.app_updates set
  title_ar = 'صفحة رئيسية جديدة بعرض شامل للميزات',
  body_ar  = 'تم إعادة تصميم صفحة babylytics.org. جديد: شريط مراحل أربعة (حمل ← مولود ← رضيع ← دارج)، شبكة مصنفة للميزات، قسم أضواء على وضع الحمل بالحجم اليومي للجنين وشريط زيادة الوزن، قسم العائلة والأدوار يعرض سجل التتبع وتغذية مقدمي الرعاية، وشريط «الجديد» يربط بصفحة /updates.'
 where title = 'New home page with the full feature catalog' and title_ar is null;

update public.app_updates set
  title_ar = 'التسجيل الصوتي — تكلمي لتسجيل الرضعات والنوم والحفاضات وأكثر',
  body_ar  = 'اضغطي على أيقونة الميكروفون الجديدة بجوار الجرس على أي لوحة طفل، ثم تكلمي. أمثلة: «سجّل رضعة ١٢٠ مل زجاجة»، «حفاضة كبيرة»، «نام ٤٥ دقيقة»، «حرارة ٣٧.٥»، «ركلة». بيبيليتيكس يحلل ما سمعه ويعرض بطاقة تأكيد قبل الحفظ — لا مفاجآت. يعمل في كروم وإيدج وسفاري.'
 where title = 'Voice logging — speak to log feedings, sleep, diapers and more' and title_ar is null;

update public.app_updates set
  title_ar = 'التسجيل الصوتي أصبح ثنائي اللغة — يكتشف الإنجليزية والعربية تلقائيًا',
  body_ar  = 'لم تعد بحاجة لتغيير لغة التطبيق لتسجل صوتيًا باللغة الأخرى. بيبيليتيكس يشغّل محللين للنية بالإنجليزية والعربية على كل نص ويستخدم المطابق. نافذة الصوت بها زر EN / ع منفصل لمحرك التمييز الصوتي ويعرض شارة «EN/AR detected» على النص المسموع.'
 where title = 'Voice logging is now bilingual — auto-detects EN and AR' and title_ar is null;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Publish the changelog entry for THIS shipment (with Arabic).
-- ────────────────────────────────────────────────────────────────────────────

select public.publish_app_update(
  p_title    => 'Fixes + Arabic on home & changelog',
  p_body     => 'Five QA fixes shipped: (1) the notifications dropdown is no longer clipped by the pregnancy hero card; (2) clicking the Babylytics logo in the sidebar goes to the public homepage; (3) the home page now flips to Arabic when your language is set to العربية; (4) the /updates changelog now stores and shows Arabic title + body for every entry, past and future; (5) the Measurements "Growth trend" auto-refreshes when you log a weight-only or height-only update.',
  p_category => 'bug_fix',
  p_date     => current_date,
  p_title_ar => 'إصلاحات + عربية على الصفحة الرئيسية وسجل الجديد',
  p_body_ar  => 'خمسة إصلاحات: (١) قائمة الإشعارات لم تعد تُقطع بواسطة كرت لوحة الحمل؛ (٢) الضغط على شعار بيبيليتيكس في الشريط الجانبي ينقل للصفحة الرئيسية العامة؛ (٣) الصفحة الرئيسية تتحول للعربية عند ضبط اللغة على العربية؛ (٤) صفحة /updates أصبحت تحفظ وتعرض العنوان والمحتوى بالعربية لكل إدخال سابق وقادم؛ (٥) شريط نمو الوزن في صفحة القياسات يتحدث تلقائيًا عند تسجيل قياس وزن فقط أو طول فقط.'
);


-- ─────────────────────────────────────────────────────────────────────
-- 037_voice_medications.sql
-- Voice medication logging changelog
-- ─────────────────────────────────────────────────────────────────────
-- 037: Medication logging by voice command. Pure UI feature — no
-- schema changes. Voice writes go through the same medication_logs
-- table as the manual form, with the same RLS + audit triggers.

select public.publish_app_update(
  p_title    => 'Log medication doses by voice',
  p_body     => 'The voice commander now understands medication doses. Say "gave 5ml of Augmentin", "took Panadol", "skipped the antibiotic", or "missed iron drops" and Babylytics fuzzy-matches against your active prescriptions, shows you the matching med (with up to 3 nearby candidates if there''s ambiguity), and only saves after you confirm. Egyptian Arabic also works — try «أعطيت ٥ مل أوجمنتين» or «تخطّيت جرعة بنادول». No auto-saves; you always pick the prescription before the dose lands in medication_logs.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'تسجيل جرعات الأدوية بالصوت',
  p_body_ar  => 'محرّك الأوامر الصوتية يفهم الآن جرعات الأدوية. قولي «أعطيت ٥ مل أوجمنتين»، «اتاخدت بنادول»، «تخطّيت أوجمنتين»، أو «نسيت دواء الكحة» وسيقوم بيبيليتيكس بمطابقة الاسم مع وصفاتك الفعّالة (يعرض حتى ٣ احتمالات قريبة عند الالتباس)، ولا يحفظ إلا بعد تأكيدك. تعمل الإنجليزية أيضًا: "gave 5ml of Augmentin" أو "skipped the antibiotic". لا حفظ تلقائي — تختارين الوصفة دائمًا قبل تسجيل الجرعة.'
);


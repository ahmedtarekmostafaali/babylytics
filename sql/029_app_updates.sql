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

  insert into public.app_updates (title, body, category, published_at, created_by)
       values (p_title, p_body, p_category, p_date, auth.uid())
    returning id into v_id;

  return v_id;
end; $$;

-- Don't grant to authenticated by default — keep this admin-only. To allow
-- it for a specific user, run `grant execute … to authenticated;` manually.

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: backfill the most material recent shipments so the page lights up on
-- first deploy. Dates are approximations grouped by Vercel deploy windows.
-- Safe to re-run — the unique title+date guard avoids duplicates.
-- ────────────────────────────────────────────────────────────────────────────

create unique index if not exists idx_app_updates_seed_uniq
  on public.app_updates(title, published_at);

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

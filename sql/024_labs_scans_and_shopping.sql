-- 024_labs_scans_and_shopping.sql
-- Two additions for Batch J:
--   1. Extend lab_panels.panel_kind to recognise specific scan modalities
--      (xray, mri, ct, ultrasound, ekg) as first-class values rather than
--      lumping them all under 'imaging'. Existing 'imaging' rows stay valid.
--   2. New shopping_list_items table — per-baby plus a per-pregnancy variant
--      so mom can keep a hospital-bag list alongside diapers + formula.
--
-- Safe to re-run.

begin;

-- ─── 1. Extend panel_kind enum ──────────────────────────────────────────────
alter table public.lab_panels drop constraint if exists lab_panels_panel_kind_check;
alter table public.lab_panels add constraint lab_panels_panel_kind_check
  check (panel_kind in (
    'blood','urine','stool','culture','genetic','other',
    'imaging',                                  -- legacy bucket, kept for back-compat
    'xray','mri','ct','ultrasound','ekg'        -- new specific scan modalities
  ));

-- ─── 2. shopping_list_items ─────────────────────────────────────────────────
create table if not exists public.shopping_list_items (
  id          uuid primary key default gen_random_uuid(),
  baby_id     uuid not null references public.babies(id) on delete cascade,
  -- Two scopes: 'baby' (default — diapers, formula, clothes, gear) and
  -- 'pregnancy' (mom-essentials list — vitamins, hospital bag, nursery prep).
  scope       text not null default 'baby' check (scope in ('baby','pregnancy')),
  name        text not null,
  category    text,                             -- "Diapers", "Feeding", "Clothes"…
  quantity    text,                             -- free-form: "2 boxes", "size 3"
  priority    text not null default 'normal' check (priority in ('low','normal','high')),
  notes       text,
  is_done     boolean not null default false,
  done_at     timestamptz,
  done_by     uuid references auth.users(id),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists shopping_list_items_baby_scope_idx
  on public.shopping_list_items (baby_id, scope, is_done, created_at desc)
  where deleted_at is null;

alter table public.shopping_list_items enable row level security;

drop policy if exists shopping_list_items_member_select on public.shopping_list_items;
create policy shopping_list_items_member_select on public.shopping_list_items
  for select using (public.has_baby_access(baby_id));

drop policy if exists shopping_list_items_writer on public.shopping_list_items;
create policy shopping_list_items_writer on public.shopping_list_items
  for all using (public.has_baby_write(baby_id))
  with check (public.has_baby_write(baby_id));

-- updated_at trigger
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists trg_shopping_list_set_updated_at on public.shopping_list_items;
    create trigger trg_shopping_list_set_updated_at
      before update on public.shopping_list_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

commit;

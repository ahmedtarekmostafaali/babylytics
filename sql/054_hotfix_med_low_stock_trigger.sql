-- 054: Hotfix — fix the med_stock_on_dose trigger that breaks dose logging.
-- ============================================================================
-- Migration 044 introduced a trigger function that fires after every dose
-- insert and, when stock falls below the threshold, tries to insert a
-- "running low" notification. The insert was wrong on two counts:
--
--   1. It writes to columns `title`, `body`, `severity` that don't exist on
--      public.notifications — the table uses `payload jsonb` for that data
--      (per sql/001 schema).
--   2. The kind it writes ('med_low_stock') isn't in notifications_kind_check
--      (last extended in sql/028 to include 'app_update' but not low-stock).
--
-- Together these caused: every dose-log attempt that crossed the threshold
-- failed with `column "title" of relation "notifications" does not exist`,
-- rolling back the entire dose insert. Users couldn't log doses for any
-- low-stock medication.
--
-- This migration:
--   - Extends the kind check to include 'med_low_stock'.
--   - Rewrites the trigger function to insert into payload jsonb instead.
--
-- Safe to run multiple times.

begin;

-- 1. Extend the kind check.
alter table public.notifications
  drop constraint if exists notifications_kind_check;
alter table public.notifications
  add  constraint notifications_kind_check
  check (kind in (
    'medication_due','medication_missed','low_ocr_confidence',
    'file_ready','feeding_alert','stool_alert',
    'app_update','med_low_stock'
  ));

-- 2. Rewrite the trigger function. Mirrors the original logic but writes
--    to (kind, payload) instead of (kind, title, body, severity).
create or replace function public.med_stock_on_dose()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_baby uuid;
  v_med_name text;
  v_threshold integer;
  v_new_total integer;
  v_last_alert timestamptz;
begin
  -- Only deduct from stock + alert when this is a 'taken' dose (not skipped/missed).
  if new.status is distinct from 'taken' then return new; end if;

  select baby_id, name, low_stock_threshold, last_low_alert_at
    into v_baby, v_med_name, v_threshold, v_last_alert
    from public.medications
   where id = new.medication_id;

  if v_baby is null then return new; end if;

  insert into public.medication_stock_txn (medication_id, baby_id, delta, reason, source_log_id, created_by)
       values (new.medication_id, v_baby, -1, 'dose', new.id, new.created_by);

  -- Recompute and alert if we just crossed the threshold (or are below).
  -- Throttled to one alert per medication per 24h to avoid spamming.
  select coalesce(sum(delta), 0) into v_new_total
    from public.medication_stock_txn where medication_id = new.medication_id;
  if v_new_total <= coalesce(v_threshold, 5)
     and (v_last_alert is null or v_last_alert < now() - interval '24 hours') then
    insert into public.notifications (baby_id, kind, payload, created_at)
         values (
           v_baby,
           'med_low_stock',
           jsonb_build_object(
             'title',           v_med_name || ' running low',
             'body',            v_med_name || ' has only ' || v_new_total || ' doses left. Time to refill.',
             'severity',        case when v_new_total <= 0 then 'high' else 'medium' end,
             'medication_id',   new.medication_id,
             'medication_name', v_med_name,
             'doses_left',      v_new_total
           ),
           now()
         );
    update public.medications set last_low_alert_at = now() where id = new.medication_id;
  end if;
  return new;
end;
$$;

-- The trigger itself was created in 044 and remains valid; just re-attach
-- to be safe.
drop trigger if exists trg_med_stock_on_dose on public.medication_logs;
create trigger trg_med_stock_on_dose
  after insert on public.medication_logs
  for each row execute function public.med_stock_on_dose();

commit;

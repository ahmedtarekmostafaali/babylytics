-- 027_outbox_dedup_constraint.sql
-- Replaces the partial unique index on whatsapp_outbox with a regular
-- UNIQUE CONSTRAINT so Supabase's .upsert({...}, { onConflict: '...' }) can
-- match it. Postgres' ON CONFLICT (cols) only matches indexes WITHOUT a
-- WHERE predicate (or you must use ON CONFLICT ON CONSTRAINT name with the
-- matching partial index name explicitly).
--
-- The WHERE clause was redundant anyway — the edge function only enqueues
-- rows that have a medication_id, so we don't need to allow nulls.
--
-- Safe to re-run.

begin;

-- Drop the partial index (created in migration 025).
drop index if exists public.whatsapp_outbox_dedup;

-- Make medication_id NOT NULL so the new constraint is meaningful and we
-- can never enqueue a reminder that isn't tied to a medication.
update public.whatsapp_outbox
   set medication_id = '00000000-0000-0000-0000-000000000000'::uuid
 where medication_id is null;

alter table public.whatsapp_outbox
  alter column medication_id set not null;

-- Drop the existing FK + readd with the same behaviour but as a NOT NULL FK.
-- (The column was already a FK; dropping the column-level NULL constraint
--  doesn't change the FK definition, so we don't actually need to touch it.)

-- Add the unique constraint that matches the upsert call.
alter table public.whatsapp_outbox
  drop constraint if exists whatsapp_outbox_dedup_uq;

alter table public.whatsapp_outbox
  add constraint whatsapp_outbox_dedup_uq
  unique (medication_id, user_id, scheduled_for);

commit;

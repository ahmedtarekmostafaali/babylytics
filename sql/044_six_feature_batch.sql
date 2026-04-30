-- 044: Six-feature mega-batch
-- ============================================================================
-- Bundles every schema change for:
--   1. Formula brand name on bottle feedings.
--   2. Post-feed effect free-text (spit-up / fussy / happy / etc.).
--   3. Vomiting tracker (new table + RLS + audit).
--   4. Solid-food name + symptom chips with KPI feeds.
--   5. Medication stock — transactions table + low-stock notification +
--      auto-decrement trigger when a dose is logged as 'taken'.
--   6. Pregnancy planner — new 'planning' lifecycle stage + cycles table
--      + fertile-window prediction RPC.
--
-- Idempotent: safe to re-run.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1, 2, 4. Feedings: formula name, post-feed effect, solid food name + chips
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.feedings
  add column if not exists formula_name      text,
  add column if not exists food_name         text,
  add column if not exists post_feed_effect  text,
  add column if not exists food_symptoms     text[];

-- Index for the food-symptoms KPI query (find feeds with non-empty symptoms
-- in a date range).
create index if not exists idx_feedings_food_symptoms
  on public.feedings (baby_id, feeding_time desc)
  where deleted_at is null and food_symptoms is not null and array_length(food_symptoms, 1) > 0;

-- KPI helper: top food types tried + symptom counts, last N days.
-- Uses array_length(food_symptoms,1) > 0 as "had any reaction".
create or replace function public.solid_food_summary(p_baby uuid, p_days int default 30)
returns table (
  food_name      text,
  times_tried    bigint,
  times_with_sym bigint,
  symptoms_seen  text[]
)
language sql stable security definer set search_path = public
as $$
  with src as (
    select
      f.food_name,
      f.food_symptoms,
      coalesce(array_length(f.food_symptoms, 1), 0) > 0 as had_symptom
    from public.feedings f
    where f.baby_id = p_baby
      and f.deleted_at is null
      and f.milk_type = 'solid'
      and f.food_name is not null
      and f.feeding_time > now() - make_interval(days => p_days)
      and public.has_baby_access(f.baby_id)
  )
  select
    s.food_name,
    count(*)::bigint                                as times_tried,
    count(*) filter (where s.had_symptom)::bigint   as times_with_sym,
    array_agg(distinct sym order by sym) filter (where sym is not null) as symptoms_seen
  from src s
  left join lateral unnest(s.food_symptoms) as sym on true
  group by s.food_name
  order by times_with_sym desc, times_tried desc;
$$;
grant execute on function public.solid_food_summary(uuid, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Vomiting tracker
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.vomiting_logs (
  id            uuid primary key default gen_random_uuid(),
  baby_id       uuid not null references public.babies(id) on delete cascade,
  vomited_at    timestamptz not null default now(),
  -- "Severity" sliders into rough buckets parents recognise.
  severity      text check (severity in ('mild','moderate','severe','projectile')) default 'mild',
  -- What came up — colour/content tells the pediatrician something specific.
  content_type  text check (content_type in ('milk','food','clear','bilious','blood_streaked','mixed','other')) default 'milk',
  -- Free-text trigger: e.g. "right after feeding", "30 min after rice cereal".
  triggered_by  text,
  related_food  text,           -- denormalized link to feedings.food_name when known
  notes         text,
  source        text not null default 'manual' check (source in ('manual','ocr','import')),
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists idx_vomiting_baby_time
  on public.vomiting_logs (baby_id, vomited_at desc) where deleted_at is null;

alter table public.vomiting_logs enable row level security;

drop policy if exists vomiting_logs_select on public.vomiting_logs;
create policy vomiting_logs_select on public.vomiting_logs
  for select using (public.has_baby_access(baby_id));

drop policy if exists vomiting_logs_insert on public.vomiting_logs;
create policy vomiting_logs_insert on public.vomiting_logs
  for insert with check (public.has_baby_access(baby_id));

drop policy if exists vomiting_logs_update on public.vomiting_logs;
create policy vomiting_logs_update on public.vomiting_logs
  for update using (public.has_baby_access(baby_id))
  with check (public.has_baby_access(baby_id));

drop policy if exists vomiting_logs_delete on public.vomiting_logs;
create policy vomiting_logs_delete on public.vomiting_logs
  for delete using (public.has_baby_access(baby_id));

-- Hook into the generic audit trigger so edits flow into audit_log.
drop trigger if exists trg_audit_vomiting on public.vomiting_logs;
create trigger trg_audit_vomiting
  after insert or update or delete on public.vomiting_logs
  for each row execute function public.audit_row_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Medication stock
-- ─────────────────────────────────────────────────────────────────────────────
-- Add per-medication threshold + unit label. Threshold defaults to 5 doses
-- — when current_stock drops at or below that, we queue a notification.
alter table public.medications
  add column if not exists low_stock_threshold int     default 5  check (low_stock_threshold >= 0),
  add column if not exists stock_unit          text    default 'doses',
  add column if not exists last_low_alert_at   timestamptz;

-- The transactions table is the single source of truth. Current stock is
-- derived as sum(delta) — never stored, never out of sync.
create table if not exists public.medication_stock_txn (
  id             uuid primary key default gen_random_uuid(),
  medication_id  uuid not null references public.medications(id) on delete cascade,
  baby_id        uuid not null references public.babies(id) on delete cascade, -- denormalized for RLS
  delta          integer not null check (delta <> 0),
  reason         text not null check (reason in ('refill','dose','manual_adjust','expiry','lost')),
  source_log_id  uuid references public.medication_logs(id) on delete set null,
  notes          text,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);
create index if not exists idx_med_stock_med_time
  on public.medication_stock_txn (medication_id, created_at desc);
create index if not exists idx_med_stock_baby_time
  on public.medication_stock_txn (baby_id, created_at desc);

alter table public.medication_stock_txn enable row level security;

drop policy if exists med_stock_txn_select on public.medication_stock_txn;
create policy med_stock_txn_select on public.medication_stock_txn
  for select using (public.has_baby_access(baby_id));

drop policy if exists med_stock_txn_insert on public.medication_stock_txn;
create policy med_stock_txn_insert on public.medication_stock_txn
  for insert with check (public.has_baby_access(baby_id));

drop policy if exists med_stock_txn_delete on public.medication_stock_txn;
create policy med_stock_txn_delete on public.medication_stock_txn
  for delete using (public.has_baby_access(baby_id));

-- Aggregated view: current stock + counts. Used by /medications/stock page.
create or replace view public.medication_stock_summary as
  select
    m.id                                            as medication_id,
    m.baby_id,
    m.name,
    m.dosage,
    m.route,
    m.stock_unit,
    m.low_stock_threshold,
    coalesce(sum(t.delta), 0)::int                  as current_stock,
    count(t.*) filter (where t.reason = 'dose')::int   as doses_taken,
    count(t.*) filter (where t.reason = 'refill')::int as refills_count,
    max(t.created_at)                               as last_txn_at
  from public.medications m
  left join public.medication_stock_txn t on t.medication_id = m.id
  where m.deleted_at is null
  group by m.id;

grant select on public.medication_stock_summary to authenticated;

-- Trigger: when a medication_logs row is INSERTed with status='taken',
-- automatically write a -1 stock txn referencing it. Also fires the low-stock
-- alert if the new total crosses the threshold.
create or replace function public.med_stock_on_dose()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_new_total int;
  v_threshold int;
  v_baby      uuid;
  v_med_name  text;
  v_last_alert timestamptz;
begin
  if new.status <> 'taken' then return new; end if;

  -- Decrement the stock by 1 dose. The medication might have been deleted
  -- meanwhile; in that case skip silently.
  select baby_id, low_stock_threshold, name, last_low_alert_at
    into v_baby, v_threshold, v_med_name, v_last_alert
    from public.medications where id = new.medication_id and deleted_at is null;
  if v_baby is null then return new; end if;

  insert into public.medication_stock_txn (medication_id, baby_id, delta, reason, source_log_id, created_by)
       values (new.medication_id, v_baby, -1, 'dose', new.id, new.created_by);

  -- Recompute and alert if we just crossed the threshold (or are below).
  -- Only one alert per 24h per medication to avoid spamming.
  select coalesce(sum(delta), 0) into v_new_total
    from public.medication_stock_txn where medication_id = new.medication_id;
  if v_new_total <= coalesce(v_threshold, 5)
     and (v_last_alert is null or v_last_alert < now() - interval '24 hours') then
    insert into public.notifications (baby_id, kind, title, body, severity, created_at)
         values (
           v_baby,
           'med_low_stock',
           v_med_name || ' running low',
           v_med_name || ' has only ' || v_new_total || ' doses left. Time to refill.',
           case when v_new_total <= 0 then 'high' else 'medium' end,
           now()
         );
    update public.medications set last_low_alert_at = now() where id = new.medication_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_med_stock_on_dose on public.medication_logs;
create trigger trg_med_stock_on_dose
  after insert on public.medication_logs
  for each row execute function public.med_stock_on_dose();

-- Convenience RPC: refill a medication's stock by N units. Records a 'refill'
-- txn under the calling user. Returns the new total.
create or replace function public.medication_refill(p_med_id uuid, p_units int, p_notes text default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_baby   uuid;
  v_total  int;
begin
  if p_units <= 0 then raise exception 'units must be positive'; end if;
  select baby_id into v_baby from public.medications where id = p_med_id and deleted_at is null;
  if v_baby is null then raise exception 'medication not found'; end if;
  if not public.has_baby_access(v_baby) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into public.medication_stock_txn (medication_id, baby_id, delta, reason, notes, created_by)
       values (p_med_id, v_baby, p_units, 'refill', p_notes, auth.uid());

  select coalesce(sum(delta), 0) into v_total from public.medication_stock_txn where medication_id = p_med_id;

  -- Refill clears the alert lockout so subsequent low-stock crossings notify
  -- again (a parent who refills doesn't want yesterday's "low" badge stuck).
  update public.medications set last_low_alert_at = null where id = p_med_id;
  return v_total;
end;
$$;
grant execute on function public.medication_refill(uuid, int, text) to authenticated;

-- Manual stock adjustment (e.g. found extra pills, lost some, expired some).
create or replace function public.medication_adjust_stock(
  p_med_id uuid, p_delta int, p_reason text, p_notes text default null
)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_baby  uuid;
  v_total int;
begin
  if p_delta = 0 then raise exception 'delta cannot be zero'; end if;
  if p_reason not in ('manual_adjust','expiry','lost') then
    raise exception 'invalid reason %', p_reason;
  end if;
  select baby_id into v_baby from public.medications where id = p_med_id and deleted_at is null;
  if v_baby is null then raise exception 'medication not found'; end if;
  if not public.has_baby_access(v_baby) then raise exception 'forbidden' using errcode = '42501'; end if;

  insert into public.medication_stock_txn (medication_id, baby_id, delta, reason, notes, created_by)
       values (p_med_id, v_baby, p_delta, p_reason, p_notes, auth.uid());
  select coalesce(sum(delta), 0) into v_total from public.medication_stock_txn where medication_id = p_med_id;
  return v_total;
end;
$$;
grant execute on function public.medication_adjust_stock(uuid, int, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Pregnancy planner — 'planning' lifecycle stage + cycle tracking
-- ─────────────────────────────────────────────────────────────────────────────
-- Add 'planning' to the lifecycle_stage check constraint. Postgres needs
-- the check dropped and re-added because we're widening the allowed set.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conname = 'babies_lifecycle_stage_check'
       and conrelid = 'public.babies'::regclass
  ) then
    alter table public.babies drop constraint babies_lifecycle_stage_check;
  end if;
exception when undefined_object then
  -- already dropped, ignore
  null;
end $$;
alter table public.babies
  add constraint babies_lifecycle_stage_check
  check (lifecycle_stage in ('planning','pregnancy','newborn','infant','toddler','child','archived'));

-- Cycle tracking — one row per recorded period start.
create table if not exists public.menstrual_cycles (
  id              uuid primary key default gen_random_uuid(),
  baby_id         uuid not null references public.babies(id) on delete cascade,
  period_start    date not null,
  period_end      date,                            -- nullable while ongoing
  cycle_length    int  check (cycle_length between 14 and 60),  -- typical = 28
  flow_intensity  text check (flow_intensity in ('spotting','light','medium','heavy')) default 'medium',
  symptoms        text[],                          -- 'cramps','headache','mood','bloating','tender_breasts','nausea'
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
create unique index if not exists ux_cycle_baby_start
  on public.menstrual_cycles (baby_id, period_start) where deleted_at is null;

alter table public.menstrual_cycles enable row level security;

drop policy if exists cycles_select on public.menstrual_cycles;
create policy cycles_select on public.menstrual_cycles
  for select using (public.has_baby_access(baby_id));

drop policy if exists cycles_insert on public.menstrual_cycles;
create policy cycles_insert on public.menstrual_cycles
  for insert with check (public.has_baby_access(baby_id));

drop policy if exists cycles_update on public.menstrual_cycles;
create policy cycles_update on public.menstrual_cycles
  for update using (public.has_baby_access(baby_id))
  with check (public.has_baby_access(baby_id));

drop policy if exists cycles_delete on public.menstrual_cycles;
create policy cycles_delete on public.menstrual_cycles
  for delete using (public.has_baby_access(baby_id));

-- Predict the fertile window for a given month, based on the most recent
-- recorded period. Returns one row per day in the requested month with the
-- cycle phase + fertility chance.
--
-- Math (standard): ovulation = next period - 14 days. Fertile window = 5
-- days before ovulation through ovulation day. Peak = ovulation day +/-1.
create or replace function public.cycle_calendar(p_baby uuid, p_month date)
returns table (
  d              date,
  phase          text,    -- 'period' | 'follicular' | 'fertile' | 'ovulation' | 'luteal' | 'unknown'
  fertility      text     -- 'none' | 'low' | 'medium' | 'high' | 'peak'
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_last  record;
  v_len   int;
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_first_in_view date;
  v_ov    date;
  v_period_end date;
  v_fert_start date;
  v_fert_end   date;
  i       date;
begin
  if not public.has_baby_access(p_baby) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Most recent period; fall back to default 28 days if user hasn't logged
  -- enough cycles yet to compute a personalised average.
  select period_start, coalesce(cycle_length, 28) as len, coalesce(period_end, period_start + 4) as p_end
    into v_last
    from public.menstrual_cycles
   where baby_id = p_baby and deleted_at is null
   order by period_start desc limit 1;

  if v_last is null then
    -- No data yet — return a calendar of "unknown" cells so the UI can
    -- still render a calendar shell with a "log your period" CTA.
    i := v_start;
    while i <= v_end loop
      d := i; phase := 'unknown'; fertility := 'none';
      return next;
      i := i + 1;
    end loop;
    return;
  end if;

  v_len   := v_last.len;
  v_first_in_view := v_last.period_start;

  -- Walk forward from the recorded period, projecting cycle anchors until we
  -- cover the requested month.
  while v_first_in_view + (v_len - 1) < v_start loop
    v_first_in_view := v_first_in_view + v_len;
  end loop;

  -- For each day in the visible month, classify against the projected cycle
  -- whose first day is <= d and whose last day (period_start + cycle_len - 1)
  -- is >= d.
  i := v_start;
  while i <= v_end loop
    -- Find the cycle window that contains this date
    declare
      cycle_start date := v_first_in_view;
      cycle_end   date;
      cycle_day   int;
      ov_day      date;
      period_end_d date;
    begin
      -- Walk backwards if the current `cycle_start` is past `i`
      while cycle_start > i loop cycle_start := cycle_start - v_len; end loop;
      -- Walk forwards while it's too far behind
      while cycle_start + v_len <= i loop cycle_start := cycle_start + v_len; end loop;
      cycle_end    := cycle_start + v_len - 1;
      cycle_day    := (i - cycle_start) + 1;
      ov_day       := cycle_start + (v_len - 14);
      -- Period: first 5 days of the cycle (or until period_end if recorded)
      period_end_d := cycle_start + 4;
      if cycle_start = v_last.period_start and v_last.p_end is not null then
        period_end_d := least(v_last.p_end, cycle_start + 7);
      end if;

      d := i;
      if i >= cycle_start and i <= period_end_d then
        phase := 'period'; fertility := 'none';
      elsif i = ov_day then
        phase := 'ovulation'; fertility := 'peak';
      elsif i >= ov_day - 1 and i <= ov_day + 1 then
        phase := 'fertile'; fertility := 'peak';
      elsif i >= ov_day - 5 and i <= ov_day - 2 then
        phase := 'fertile'; fertility := 'high';
      elsif i = ov_day + 2 then
        phase := 'luteal'; fertility := 'medium';
      elsif i > period_end_d and i < ov_day - 5 then
        phase := 'follicular'; fertility := 'low';
      else
        phase := 'luteal'; fertility := 'low';
      end if;
      return next;
    end;
    i := i + 1;
  end loop;
end;
$$;
grant execute on function public.cycle_calendar(uuid, date) to authenticated;

-- Create a planning-stage baby + owner row in one shot, mirroring
-- create_pregnancy_with_owner / create_baby_with_owner. We can't use the
-- born-baby RPC because there's no DOB yet, and we don't want to require
-- an EDD either at this stage. Returns the new baby_id.
create or replace function public.create_planning_baby_with_owner(p_name text default 'Planning')
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_baby uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  insert into public.babies (name, lifecycle_stage, gender, dob, created_by)
       values (coalesce(nullif(trim(p_name), ''), 'Planning'), 'planning', 'unspecified', null, v_user)
       returning id into v_baby;
  insert into public.baby_users (baby_id, user_id, role)
       values (v_baby, v_user, 'owner')
       on conflict do nothing;
  return v_baby;
end;
$$;
grant execute on function public.create_planning_baby_with_owner(text) to authenticated;

-- The babies table requires dob NOT NULL in the original schema. Loosen
-- it so 'planning' rows can exist without a date of birth (they get one
-- transitioning to 'pregnancy' or 'newborn' later).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'babies'
       and column_name = 'dob' and is_nullable = 'NO'
  ) then
    alter table public.babies alter column dob drop not null;
  end if;
end $$;

commit;

-- Publish a changelog entry so users see what changed.
select public.publish_app_update(
  p_title    => 'Big update: vomiting tracker, medication stock, pregnancy planner',
  p_body     => 'Six new things: (1) Bottle feedings now record formula brand. (2) Every feeding can capture a post-feed effect (spit-up, fussy, happy, rash). (3) Brand-new vomiting tracker with severity, content type, and trigger. (4) Solid food name + symptom chips so you can spot trigger foods, with a new KPI on the overview. (5) Medication stock with auto-decrement on every dose, refill button, full transaction history, and a low-stock alert when fewer than 5 doses remain. (6) New pre-pregnancy planning stage with a fertility calendar showing period, ovulation, and fertile window.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'تحديث ضخم: متعقّب القيء، مخزون الدواء، مخطط الحمل',
  p_body_ar  => 'ست إضافات: (١) تسجيل اسم الحليب الصناعي مع الرضعة. (٢) إضافة "تأثير بعد الرضعة" (ترجيع، تململ، فرح، طفح). (٣) متعقّب جديد للقيء مع الشدة ونوع المحتوى والمحفّز. (٤) اسم الطعام الصلب وأعراض الحساسية كرقائق سريعة، مع بطاقة مؤشّر في النظرة العامة. (٥) مخزون الدواء مع خصم تلقائي عند كل جرعة، زر إعادة تعبئة، سجل كامل للحركات، وتنبيه عند تبقي أقل من ٥ جرعات. (٦) مرحلة جديدة "تخطيط للحمل" مع تقويم خصوبة يعرض الدورة والتبويض ونافذة الخصوبة.'
);

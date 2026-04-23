-- ============================================================================
-- Babylytics — RPCs
-- ============================================================================
-- All client-facing reads/writes that need logic go through these. The KPI
-- engine is SQL-native so a single round-trip returns the dashboard.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- create_baby_with_owner(name, dob, gender, birth_weight_kg, feeding_factor)
--   Inserts a baby and immediately makes the caller its owner. Runs in one
--   transaction so there is never a baby without an owner row.
-- ---------------------------------------------------------------------------
create or replace function public.create_baby_with_owner(
  p_name text,
  p_dob  timestamptz,
  p_gender text default 'unspecified',
  p_birth_weight_kg numeric default null,
  p_birth_height_cm numeric default null,
  p_feeding_factor numeric default 150
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not authenticated'; end if;

  insert into public.babies(name, dob, gender, birth_weight_kg, birth_height_cm, feeding_factor_ml_per_kg_per_day, created_by)
    values (p_name, p_dob, p_gender, p_birth_weight_kg, p_birth_height_cm, p_feeding_factor, v_actor)
    returning id into v_id;

  insert into public.baby_users(baby_id, user_id, role, invited_by)
    values (v_id, v_actor, 'owner', v_actor);

  return v_id;
end; $$;
grant execute on function public.create_baby_with_owner(text,timestamptz,text,numeric,numeric,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- invite_caregiver(baby_id, email, role) — owner-only, by email lookup
-- ---------------------------------------------------------------------------
create or replace function public.invite_caregiver(p_baby uuid, p_email text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_actor uuid := auth.uid();
begin
  if not public.is_baby_owner(p_baby) then
    raise exception 'only the owner may invite caregivers';
  end if;
  if p_role not in ('editor','viewer','owner') then
    raise exception 'invalid role %', p_role;
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email) limit 1;
  if v_user is null then raise exception 'no user with email %', p_email; end if;

  insert into public.baby_users(baby_id, user_id, role, invited_by)
    values (p_baby, v_user, p_role, v_actor)
    on conflict (baby_id, user_id) do update set role = excluded.role;
end; $$;
grant execute on function public.invite_caregiver(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- current_weight_kg(baby_id) — most recent measurement or birth weight
-- ---------------------------------------------------------------------------
create or replace function public.current_weight_kg(p_baby uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select weight_kg from public.measurements
       where baby_id = p_baby and weight_kg is not null and deleted_at is null
       order by measured_at desc limit 1),
    (select birth_weight_kg from public.babies where id = p_baby)
  );
$$;
grant execute on function public.current_weight_kg(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- feeding_kpis(baby_id, day_start, day_end)
--   Returns feeding aggregates for an inclusive TIMESTAMPTZ window.
-- ---------------------------------------------------------------------------
create or replace function public.feeding_kpis(
  p_baby  uuid,
  p_start timestamptz default date_trunc('day', now()),
  p_end   timestamptz default date_trunc('day', now()) + interval '1 day'
)
returns table (
  total_feed_ml        numeric,
  avg_feed_ml          numeric,
  feed_count           integer,
  recommended_feed_ml  numeric,
  remaining_feed_ml    numeric,
  feeding_percentage   numeric
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_factor numeric;
  v_weight numeric;
begin
  if not public.has_baby_access(p_baby) then
    raise exception 'access denied';
  end if;
  select feeding_factor_ml_per_kg_per_day into v_factor from public.babies where id = p_baby;
  v_weight := public.current_weight_kg(p_baby);

  return query
    with agg as (
      select
        coalesce(sum(quantity_ml),0) as total_ml,
        count(*) filter (where quantity_ml is not null) as n
      from public.feedings
      where baby_id = p_baby
        and deleted_at is null
        and feeding_time >= p_start
        and feeding_time <  p_end
    )
    select
      agg.total_ml,
      case when agg.n = 0 then 0 else round(agg.total_ml / agg.n, 1) end,
      agg.n::int,
      round(coalesce(v_weight,0) * coalesce(v_factor,150), 1) as recommended,
      greatest(round(coalesce(v_weight,0) * coalesce(v_factor,150) - agg.total_ml, 1), 0) as remaining,
      case
        when coalesce(v_weight,0) * coalesce(v_factor,150) = 0 then 0
        else round(100.0 * agg.total_ml / (coalesce(v_weight,0) * coalesce(v_factor,150)), 1)
      end as pct
    from agg;
end; $$;
grant execute on function public.feeding_kpis(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- stool_kpis(baby_id, day_start, day_end)
-- ---------------------------------------------------------------------------
create or replace function public.stool_kpis(
  p_baby  uuid,
  p_start timestamptz default date_trunc('day', now()),
  p_end   timestamptz default date_trunc('day', now()) + interval '1 day'
)
returns table (
  stool_count   integer,
  total_ml      numeric,
  small_count   integer,
  medium_count  integer,
  large_count   integer,
  last_stool_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    count(*)::int,
    coalesce(sum(quantity_ml),0),
    count(*) filter (where quantity_category = 'small')::int,
    count(*) filter (where quantity_category = 'medium')::int,
    count(*) filter (where quantity_category = 'large')::int,
    max(stool_time)
  from public.stool_logs
  where baby_id = p_baby and deleted_at is null
    and stool_time >= p_start and stool_time < p_end
    and public.has_baby_access(p_baby);
$$;
grant execute on function public.stool_kpis(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- medication_kpis(baby_id, window_start, window_end)
--   total_doses = sum of (expected) doses for active prescriptions in window
--   taken       = count of medication_logs with status='taken' in window
--   missed      = count of medication_logs with status='missed' in window
--   remaining   = max(total_doses - taken - missed, 0)
-- ---------------------------------------------------------------------------
create or replace function public.medication_kpis(
  p_baby  uuid,
  p_start timestamptz default date_trunc('day', now()),
  p_end   timestamptz default date_trunc('day', now()) + interval '1 day'
)
returns table (
  total_doses integer,
  taken       integer,
  missed      integer,
  remaining   integer,
  adherence_pct numeric
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  return query
    with expected as (
      -- for each active prescription, compute # of dose slots that fall in window
      select m.id,
             case
               when m.frequency_hours is null or m.frequency_hours = 0 then 0
               else floor(extract(epoch from (least(coalesce(m.ends_at, p_end), p_end) - greatest(m.starts_at, p_start)))
                          / (m.frequency_hours * 3600))::int
             end as slots
      from public.medications m
      where m.baby_id = p_baby
        and m.deleted_at is null
        and m.starts_at < p_end
        and (m.ends_at is null or m.ends_at > p_start)
    ),
    logs as (
      select
        count(*) filter (where status = 'taken')  as taken_n,
        count(*) filter (where status = 'missed') as missed_n
      from public.medication_logs
      where baby_id = p_baby and deleted_at is null
        and medication_time >= p_start and medication_time < p_end
    )
    select
      coalesce(sum(expected.slots),0)::int,
      coalesce((select taken_n from logs),0)::int,
      coalesce((select missed_n from logs),0)::int,
      greatest(coalesce(sum(expected.slots),0)::int
               - coalesce((select taken_n from logs),0)::int
               - coalesce((select missed_n from logs),0)::int, 0),
      case
        when coalesce(sum(expected.slots),0) = 0 then 100
        else round(100.0 * coalesce((select taken_n from logs),0) / coalesce(sum(expected.slots),0), 1)
      end
    from expected;
end; $$;
grant execute on function public.medication_kpis(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- weight_trend(baby_id, days) — series for charting
-- ---------------------------------------------------------------------------
create or replace function public.weight_trend(p_baby uuid, p_days int default 90)
returns table (measured_at timestamptz, weight_kg numeric, height_cm numeric, head_circ_cm numeric)
language sql stable security definer set search_path = public as $$
  select measured_at, weight_kg, height_cm, head_circ_cm
  from public.measurements
  where baby_id = p_baby and deleted_at is null
    and measured_at >= now() - make_interval(days => p_days)
    and public.has_baby_access(p_baby)
  order by measured_at asc;
$$;
grant execute on function public.weight_trend(uuid,int) to authenticated;

-- ---------------------------------------------------------------------------
-- daily_feeding_series(baby_id, days) — one row per day with total_ml & recommended
-- ---------------------------------------------------------------------------
create or replace function public.daily_feeding_series(p_baby uuid, p_days int default 14)
returns table (day date, total_ml numeric, recommended_ml numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_factor numeric; v_weight numeric;
begin
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;
  select feeding_factor_ml_per_kg_per_day into v_factor from public.babies where id = p_baby;
  v_weight := public.current_weight_kg(p_baby);

  return query
    select d::date as day,
           coalesce(sum(f.quantity_ml),0) as total_ml,
           round(coalesce(v_weight,0) * coalesce(v_factor,150),1) as recommended_ml
    from generate_series(date_trunc('day', now()) - make_interval(days => p_days - 1),
                         date_trunc('day', now()),
                         interval '1 day') d
    left join public.feedings f
      on f.baby_id = p_baby
     and f.deleted_at is null
     and f.feeding_time >= d and f.feeding_time < d + interval '1 day'
    group by d
    order by d;
end; $$;
grant execute on function public.daily_feeding_series(uuid,int) to authenticated;

-- ---------------------------------------------------------------------------
-- daily_stool_series(baby_id, days)
-- ---------------------------------------------------------------------------
create or replace function public.daily_stool_series(p_baby uuid, p_days int default 14)
returns table (day date, stool_count int, total_ml numeric)
language sql stable security definer set search_path = public as $$
  select d::date as day,
         count(s.id)::int,
         coalesce(sum(s.quantity_ml),0)
  from generate_series(date_trunc('day', now()) - make_interval(days => p_days - 1),
                       date_trunc('day', now()),
                       interval '1 day') d
  left join public.stool_logs s
    on s.baby_id = p_baby
   and s.deleted_at is null
   and s.stool_time >= d and s.stool_time < d + interval '1 day'
  where public.has_baby_access(p_baby)
  group by d
  order by d;
$$;
grant execute on function public.daily_stool_series(uuid,int) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_extracted_text(extracted_id, payload jsonb)
--   Persists the user-REVIEWED structured data into the live tables inside
--   one transaction. `payload` is the edited version the user clicked
--   CONFIRM on; never the raw OCR output. We also mark the extracted_text
--   row as 'confirmed' and link new rows back to the source file.
--
--   payload shape:
--     {
--       "feedings":   [ { "feeding_time":"ISO", "quantity_ml": n, "milk_type":"..." }, ... ],
--       "stools":     [ { "stool_time":"ISO", "quantity_category":"small", "quantity_ml": n }, ... ],
--       "measurements":[{ "measured_at":"ISO", "weight_kg": n, "height_cm": n }, ...],
--       "medication_logs":[{ "medication_id":"uuid","medication_time":"ISO","status":"taken" }, ...]
--     }
-- ---------------------------------------------------------------------------
create or replace function public.confirm_extracted_text(p_extracted uuid, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row   public.extracted_text%rowtype;
  v_actor uuid := auth.uid();
  rec     jsonb;
begin
  select * into v_row from public.extracted_text where id = p_extracted;
  if not found then raise exception 'extracted_text % not found', p_extracted; end if;
  if not public.has_baby_write(v_row.baby_id) then raise exception 'access denied'; end if;

  -- feedings
  for rec in select * from jsonb_array_elements(coalesce(p_payload->'feedings','[]'::jsonb)) loop
    insert into public.feedings(baby_id, feeding_time, milk_type, quantity_ml, kcal, notes, source, source_file_id, created_by)
    values (
      v_row.baby_id,
      (rec->>'feeding_time')::timestamptz,
      coalesce(rec->>'milk_type','formula'),
      nullif(rec->>'quantity_ml','')::numeric,
      nullif(rec->>'kcal','')::numeric,
      rec->>'notes',
      'ocr',
      v_row.file_id,
      v_actor
    );
  end loop;

  -- stools
  for rec in select * from jsonb_array_elements(coalesce(p_payload->'stools','[]'::jsonb)) loop
    insert into public.stool_logs(baby_id, stool_time, quantity_category, quantity_ml, color, consistency, notes, source, source_file_id, created_by)
    values (
      v_row.baby_id,
      (rec->>'stool_time')::timestamptz,
      rec->>'quantity_category',
      nullif(rec->>'quantity_ml','')::numeric,
      rec->>'color',
      rec->>'consistency',
      rec->>'notes',
      'ocr',
      v_row.file_id,
      v_actor
    );
  end loop;

  -- measurements
  for rec in select * from jsonb_array_elements(coalesce(p_payload->'measurements','[]'::jsonb)) loop
    insert into public.measurements(baby_id, measured_at, weight_kg, height_cm, head_circ_cm, notes, source, source_file_id, created_by)
    values (
      v_row.baby_id,
      (rec->>'measured_at')::timestamptz,
      nullif(rec->>'weight_kg','')::numeric,
      nullif(rec->>'height_cm','')::numeric,
      nullif(rec->>'head_circ_cm','')::numeric,
      rec->>'notes',
      'ocr',
      v_row.file_id,
      v_actor
    );
  end loop;

  -- medication logs
  for rec in select * from jsonb_array_elements(coalesce(p_payload->'medication_logs','[]'::jsonb)) loop
    insert into public.medication_logs(medication_id, baby_id, medication_time, status, actual_dosage, notes, source, source_file_id, created_by)
    values (
      (rec->>'medication_id')::uuid,
      v_row.baby_id,
      (rec->>'medication_time')::timestamptz,
      coalesce(rec->>'status','taken'),
      rec->>'actual_dosage',
      rec->>'notes',
      'ocr',
      v_row.file_id,
      v_actor
    );
  end loop;

  update public.extracted_text
     set status = 'confirmed',
         reviewed_by = v_actor,
         reviewed_at = coalesce(reviewed_at, now()),
         confirmed_at = now(),
         structured_data = p_payload  -- store edited version too
   where id = p_extracted;

  update public.medical_files set ocr_status = 'confirmed' where id = v_row.file_id;
end; $$;
grant execute on function public.confirm_extracted_text(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_notification_read(notification_id)
-- ---------------------------------------------------------------------------
create or replace function public.mark_notification_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
   where id = p_id and (user_id = auth.uid() or user_id is null);
$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

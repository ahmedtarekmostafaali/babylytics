-- ============================================================================
-- Babylytics — Optional dev seed. Run only in a non-prod project.
-- Creates one baby for the first authenticated user and a few days of logs.
-- ============================================================================
do $$
declare v_user uuid; v_baby uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise notice 'No users yet — sign up first, then re-run 006_seed.sql.';
    return;
  end if;

  -- Skip if this user already has a baby
  if exists (select 1 from public.baby_users where user_id = v_user) then
    raise notice 'User % already has babies, skipping seed.', v_user;
    return;
  end if;

  -- Impersonate the first user so the RPC passes RLS
  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  v_baby := public.create_baby_with_owner('Demo Baby', now() - interval '60 days', 'female', 3.4, 50);

  insert into public.measurements(baby_id, measured_at, weight_kg, height_cm, head_circ_cm, created_by)
  values
    (v_baby, now() - interval '45 days', 3.8, 52, 35.5, v_user),
    (v_baby, now() - interval '30 days', 4.2, 54, 36.2, v_user),
    (v_baby, now() - interval '15 days', 4.7, 56, 37.0, v_user),
    (v_baby, now() - interval '2 days',  5.1, 57.5, 37.5, v_user);

  insert into public.feedings(baby_id, feeding_time, milk_type, quantity_ml, created_by)
  select v_baby,
         now() - (i || ' hours')::interval,
         (array['formula','breast','formula','mixed'])[1 + (i % 4)],
         (60 + random()*60)::numeric(6,1),
         v_user
  from generate_series(1, 48) i;

  insert into public.stool_logs(baby_id, stool_time, quantity_category, created_by)
  select v_baby,
         now() - (i || ' hours')::interval,
         (array['small','medium','large'])[1 + (i % 3)],
         v_user
  from generate_series(6, 48, 6) i;
end $$;

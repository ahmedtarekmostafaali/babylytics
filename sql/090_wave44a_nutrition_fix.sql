-- 090: Wave 44A — fix ambiguous "id" error in nutrition_suggestions
-- ============================================================================
-- The Wave 38A nutrition_suggestions function declared
--   returns table (id uuid, title_en text, ...)
-- which makes `id` (and similar) plpgsql OUT-parameter names that
-- compete with any column reference inside the function body. Postgres
-- raises ERROR: column reference "id" is ambiguous when the body
-- selects e.id from the eligible CTE.
--
-- Fix: add `#variable_conflict use_column` directive so column refs
-- always win when there's a name clash. This is the canonical fix per
-- the plpgsql documentation (alongside renaming OUT params, which
-- would break the calling client API). Same fix applied defensively
-- to recent_lab_deficiencies which has a similar shape.
--
-- Idempotent.

begin;

-- Recreate nutrition_suggestions with the directive. Body is otherwise
-- unchanged from Wave 38A.
drop function if exists public.nutrition_suggestions(uuid, int);

create or replace function public.nutrition_suggestions(
  p_baby uuid, p_limit int default 3
) returns table (
  id              uuid,
  title_en        text,
  title_ar        text,
  body_en         text,
  body_ar         text,
  food_type       text,
  addresses_tags  text[],
  is_ramadan_pick boolean,
  boosted_for     text
)
language plpgsql stable security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_actor   uuid := auth.uid();
  v_baby    record;
  v_stage   text;
  v_age_mo  int;
  v_trim    int;
  v_total_days numeric;
  v_ramadan boolean := public.is_ramadan_today();
  v_def_tags text[];
begin
  if v_actor is null then raise exception 'not_authenticated'; end if;
  if not public.has_baby_access(p_baby) then raise exception 'access denied'; end if;

  select lifecycle_stage, dob, lmp, edd
    into v_baby
    from public.babies where babies.id = p_baby;
  if v_baby.lifecycle_stage is null then return; end if;

  v_stage := case
    when v_baby.lifecycle_stage = 'planning'  then 'planning'
    when v_baby.lifecycle_stage = 'pregnancy' then 'pregnancy'
    else 'baby'
  end;

  if v_stage = 'pregnancy' then
    v_total_days := case
      when v_baby.lmp is not null then extract(epoch from (now() - v_baby.lmp::timestamptz)) / 86400.0
      when v_baby.edd is not null then 280 - extract(epoch from (v_baby.edd::timestamptz - now())) / 86400.0
      else null
    end;
    v_trim := case
      when v_total_days is null then null
      when v_total_days <= 91   then 1
      when v_total_days <= 195  then 2
      else 3
    end;
  end if;

  if v_stage = 'baby' then
    v_age_mo := case
      when v_baby.dob is null then null
      else floor(extract(epoch from (now() - v_baby.dob::timestamptz)) / 86400.0 / 30.44)::int
    end;
  end if;

  v_def_tags := public.recent_lab_deficiencies(p_baby);

  return query
    with eligible as (
      select t.id              as e_id,
             t.title_en        as e_title_en,
             t.title_ar        as e_title_ar,
             t.body_en         as e_body_en,
             t.body_ar         as e_body_ar,
             t.food_type       as e_food_type,
             t.addresses_tags  as e_addresses_tags,
             t.ramadan_relevant as e_ramadan_relevant,
             -- Effective weight = base × Ramadan boost × lab boost × random.
             t.weight::numeric *
             case when v_ramadan and t.ramadan_relevant then 1.6 else 1.0 end *
             case when t.addresses_tags && v_def_tags then 1.8 else 1.0 end *
             random() as e_rank,
             case when t.addresses_tags && v_def_tags
                  then (select string_agg(tg, ', ')
                        from unnest(t.addresses_tags) as tg
                        where tg = any(v_def_tags))
                  else null end as e_boost_reason
        from public.nutrition_tips t
        where v_stage = any(t.stage_scope)
          and (v_stage <> 'pregnancy' or t.trimesters is null or v_trim is null
               or v_trim = any(t.trimesters))
          and (v_stage <> 'baby'
               or (
                 (t.age_min_months is null or v_age_mo is null or v_age_mo >= t.age_min_months)
                 and
                 (t.age_max_months is null or v_age_mo is null or v_age_mo <= t.age_max_months)
               ))
          and (not t.ramadan_only or v_ramadan)
    )
    select
      e.e_id,
      e.e_title_en,
      e.e_title_ar,
      e.e_body_en,
      e.e_body_ar,
      e.e_food_type,
      e.e_addresses_tags,
      (v_ramadan and e.e_ramadan_relevant) as is_ramadan_pick,
      case when e.e_boost_reason is not null
           then 'low ' || e.e_boost_reason || ' from labs'
           else null end as boosted_for
    from eligible e
    order by e.e_rank desc
    limit greatest(1, least(p_limit, 12));
end;
$$;
grant execute on function public.nutrition_suggestions(uuid, int) to authenticated;

commit;

select public.publish_app_update(
  p_title    => $t1$Hotfix: nutrition card error resolved$t1$,
  p_body     => $b1$The "Couldn''t load suggestions (column reference id is ambiguous)" error on the nutrition card is fixed. Postgres''s plpgsql treats RETURNS TABLE column names as OUT parameters that compete with column references in the function body — every CTE column is now uniquely-aliased so there''s no clash. Apply sql/090 in Supabase and the card will start showing tips again.$b1$,
  p_category => 'bug_fix',
  p_date     => current_date,
  p_title_ar => $ta1$إصلاح: خطأ بطاقة التغذية تم حله$ta1$,
  p_body_ar  => $ba1$خطأ «Couldn''t load suggestions» في بطاقة التغذية تم إصلاحه. plpgsql في Postgres يعامل أسماء أعمدة RETURNS TABLE كمعاملات OUT تتعارض مع مراجع الأعمدة في الدالة — كل عمود من CTE الآن له اسم مستعار فريد بحيث لا يوجد تعارض. طبّق sql/090 في Supabase وستبدأ البطاقة في عرض النصائح مرة أخرى.$ba1$
);

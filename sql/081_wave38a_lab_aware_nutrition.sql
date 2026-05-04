-- 081: Wave 38A — lab-deficiency-aware nutrition boosting
-- ============================================================================
-- Wave 37 shipped the nutrition engine with a randomised + Ramadan-
-- aware ranking. This wave layers an additional boost: when the user
-- has uploaded labs in the last 6 months that flag low values for
-- known nutrients (hemoglobin, ferritin, vitamin D, calcium, folate,
-- B12, magnesium, zinc), tips whose `addresses_tags` cover those
-- nutrients get up-ranked.
--
-- The scan looks for `lab_panel_items.flag = 'low'` rows where the
-- `test_name` matches a known pattern (case-insensitive, ILIKE —
-- handles "Hemoglobin", "Hgb", "HGB", "هيموجلوبين", etc.).
--
-- Boost is multiplicative: 1.8× for any matching deficiency. Stacked
-- on top of the existing weight × Ramadan boost. So a 9-weight
-- iron-tagged tip during Ramadan with a low-Hgb lab in the user's
-- file ends up at 9 × 1.6 × 1.8 = 25.9 effective weight, comfortably
-- ahead of unboosted tips.
--
-- The signal also surfaces in the response: tips returned now carry
-- a `boosted_for` text column (e.g. "low iron from labs") so the UI
-- can show a "Why this is up-ranked" badge.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: extract deficient-nutrient tags from a baby's recent labs.
-- Looks back 6 months. Returns array of nutrition tags that any
-- low-flagged item maps to.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.recent_lab_deficiencies(p_baby uuid)
returns text[]
language plpgsql stable security definer set search_path = public
as $$
declare
  v_tags text[] := '{}';
begin
  if not public.has_baby_access(p_baby) then return v_tags; end if;

  -- Pattern → tag map. ILIKE patterns are case-insensitive.
  -- One nutrient can come from multiple test names; one test can
  -- contribute to multiple tags (e.g. ferritin → iron).
  with low_items as (
    select li.test_name
      from public.lab_panel_items li
      join public.lab_panels p on p.id = li.panel_id
      where p.baby_id = p_baby
        and p.deleted_at is null
        and p.result_at >= now() - interval '6 months'
        and li.flag = 'low'
  )
  select array(
    select distinct unnest(arr)
    from (
      select case
        -- Iron family
        when test_name ilike '%hemoglobin%' or test_name ilike '%hgb%'
          or test_name ilike '%هيموجلوبين%' or test_name ilike '%hb%'
          then array['iron']
        when test_name ilike '%ferritin%' or test_name ilike '%فيريتين%'
          then array['iron']
        when test_name ilike '%iron%' or test_name ilike '%حديد%'
          then array['iron']
        when test_name ilike '%mcv%' or test_name ilike '%mch%'  -- microcytic anaemia signal
          then array['iron','b12']
        -- Folate
        when test_name ilike '%folate%' or test_name ilike '%folic%'
          or test_name ilike '%فولات%' or test_name ilike '%فوليك%'
          then array['folate']
        -- B12
        when test_name ilike '%b12%' or test_name ilike '%cobalamin%'
          or test_name ilike '%ب١٢%'
          then array['b12']
        -- Vitamin D → drives calcium needs
        when test_name ilike '%vitamin d%' or test_name ilike '%25-oh%'
          or test_name ilike '%vit d%' or test_name ilike '%فيتامين د%'
          then array['calcium','fat']
        -- Calcium
        when test_name ilike '%calcium%' or test_name ilike '%كالسيوم%'
          then array['calcium']
        -- Magnesium
        when test_name ilike '%magnesium%' or test_name ilike '%مغنيسيوم%'
          then array['magnesium']
        -- Zinc
        when test_name ilike '%zinc%' or test_name ilike '%زنك%'
          then array['zinc']
        -- Protein
        when test_name ilike '%total protein%' or test_name ilike '%albumin%'
          or test_name ilike '%بروتين%'
          then array['protein']
        else array[]::text[]
      end as arr
      from low_items
    ) mapped
    where array_length(arr, 1) is not null
  ) into v_tags;

  return v_tags;
end;
$$;
grant execute on function public.recent_lab_deficiencies(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- nutrition_suggestions v2 — adds lab-aware boosting + boosted_for column.
-- ─────────────────────────────────────────────────────────────────────────────
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
  boosted_for     text     -- non-null when the tip was lab-deficiency-boosted
)
language plpgsql stable security definer set search_path = public
as $$
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
    from public.babies where id = p_baby;
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

  -- Wave 38A: deficient-nutrient tags from recent labs.
  v_def_tags := public.recent_lab_deficiencies(p_baby);

  return query
    with eligible as (
      select t.*,
             -- Effective weight = base × Ramadan boost × lab-deficiency boost × random tiebreak.
             t.weight::numeric *
             case when v_ramadan and t.ramadan_relevant then 1.6 else 1.0 end *
             case when t.addresses_tags && v_def_tags then 1.8 else 1.0 end *
             random() as rank_score,
             case when t.addresses_tags && v_def_tags
                  then (select string_agg(tag, ', ')
                        from unnest(t.addresses_tags) as tag
                        where tag = any(v_def_tags))
                  else null end as boost_reason
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
      e.id, e.title_en, e.title_ar, e.body_en, e.body_ar,
      e.food_type, e.addresses_tags,
      (v_ramadan and e.ramadan_relevant) as is_ramadan_pick,
      case when e.boost_reason is not null
           then 'low ' || e.boost_reason || ' from labs'
           else null end as boosted_for
    from eligible e
    order by e.rank_score desc
    limit greatest(1, least(p_limit, 12));
end;
$$;
grant execute on function public.nutrition_suggestions(uuid, int) to authenticated;

commit;

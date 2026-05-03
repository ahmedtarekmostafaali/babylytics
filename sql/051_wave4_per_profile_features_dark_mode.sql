-- 051: Wave 4 — per-profile feature visibility (move from user → baby) + dark mode polish
-- ============================================================================
-- 1. babies.enabled_features text[] — per-profile feature visibility. null =
--    unrestricted (default). When set, the sidebar narrows to just these
--    areas. Replaces the old user-level user_preferences.enabled_features
--    (kept on the table for backward compat / migration window).
--
-- 2. RPC baby_enabled_features(p_baby uuid) → text[] | null. Returns the
--    profile's enabled_features list (or null if the user can see
--    everything). SECURITY DEFINER so it works for any caregiver who can
--    see the baby; RLS still controls which babies are visible.
--
-- 3. RPC set_baby_features(p_baby uuid, p_features text[]) → void. Only
--    parents/owners may set. Pass null to clear (= unrestricted).
--
-- 4. Migrate existing user-level enabled_features → baby-level for any
--    baby owned by a user that has them set. We bucket by stage and copy
--    only the matching key, so a baby in 'pregnancy' picks up the
--    pregnancy: list. One-shot migration; safe to rerun (only fills nulls).
--
-- 5. publish_app_update for the change.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. babies.enabled_features
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.babies
  add column if not exists enabled_features text[];

comment on column public.babies.enabled_features is
  'Per-profile feature visibility. null = full access (default). Otherwise '
  'array of area keys like {feedings,stool,sleep}. Replaces the older '
  'user_preferences.enabled_features (per-user, per-stage).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. baby_enabled_features RPC
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.baby_enabled_features(p_baby uuid)
returns text[]
language sql stable security definer set search_path = public
as $$
  select enabled_features
    from public.babies
   where id = p_baby
     and (deleted_at is null)
   limit 1;
$$;
grant execute on function public.baby_enabled_features(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. set_baby_features RPC (parent/owner only)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_baby_features(
  p_baby uuid,
  p_features text[] default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_baby_parent(p_baby) then
    raise exception 'only a parent or owner may change profile features';
  end if;
  update public.babies
     set enabled_features = p_features
   where id = p_baby;
end;
$$;
grant execute on function public.set_baby_features(uuid, text[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Migrate user-level features → baby-level (one-shot, only fills nulls)
-- ─────────────────────────────────────────────────────────────────────────────
-- For every owner of a baby that doesn't yet have enabled_features set,
-- copy the matching stage bucket from their user_preferences.enabled_features.
-- Matches by lifecycle_stage: planning|pregnancy|baby (others fall back to
-- 'baby'). Only sets a non-empty array (skip empty/missing keys).
do $migrate$
declare
  rec record;
  v_stage text;
  v_arr text[];
begin
  for rec in
    select b.id as baby_id, b.lifecycle_stage,
           up.enabled_features as feats
      from public.babies b
      join public.baby_users bu on bu.baby_id = b.id and bu.role in ('owner','parent')
      join public.user_preferences up on up.user_id = bu.user_id
     where b.enabled_features is null
       and b.deleted_at is null
       and up.enabled_features is not null
       and up.enabled_features <> '{}'::jsonb
  loop
    v_stage := case
      when rec.lifecycle_stage = 'planning'  then 'planning'
      when rec.lifecycle_stage = 'pregnancy' then 'pregnancy'
      else 'baby'
    end;
    if rec.feats ? v_stage then
      v_arr := array(select jsonb_array_elements_text(rec.feats -> v_stage));
      if array_length(v_arr, 1) > 0 then
        update public.babies set enabled_features = v_arr where id = rec.baby_id;
      end if;
    end if;
  end loop;
end $migrate$;

commit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. App update notification (idempotent via publish_app_update unique idx)
-- ─────────────────────────────────────────────────────────────────────────────
select public.publish_app_update(
  p_title    => $t1$Features moved into each profile + dark mode polish$t1$,
  p_body     => $b1$Two changes: (1) The per-stage feature picker has moved from your global Preferences into each profile's Edit page. Open any profile, go to Edit, and choose which areas show in the sidebar — features are now scoped per profile and automatically filtered to that profile's stage (cycle / pregnancy / baby). Old user-level picks were copied over once. (2) Dark mode contrast fixes — profile cards on the home dashboard and the Features picker labels are now properly readable.$b1$,
  p_category => 'enhancement',
  p_date     => current_date,
  p_title_ar => $ta1$الميزات أصبحت لكل ملف + تحسينات الوضع الليلي$ta1$,
  p_body_ar  => $ba1$تغييران: (١) اختيار الميزات لكل مرحلة انتقل من الإعدادات العامة إلى صفحة "تعديل" في كل ملف. افتحي أي ملف ثم تعديل، واختاري الأقسام التي تظهر في القائمة الجانبية — الميزات الآن لكل ملف وتُفلتر تلقائيًا حسب مرحلته (دورة / حمل / طفل). نُقلت اختياراتك القديمة تلقائيًا. (٢) تحسين تباين الوضع الليلي على بطاقات الملفات في الصفحة الرئيسية وعلى محدد الميزات.$ba1$
);

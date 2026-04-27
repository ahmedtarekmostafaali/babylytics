-- 038: New trackers for vital signs (BP / HR / SpO2), blood glucose
-- with diabetes context, plus an in-app feedback / bug-report / feature-
-- request channel. All idempotent — safe to re-run.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. vital_signs_logs — combined BP, heart-rate, SpO2 per measurement
-- ────────────────────────────────────────────────────────────────────────────
-- One row = one cuff/oximeter reading. All three values are optional but at
-- least one must be present (enforced by the check constraint at the bottom).

create table if not exists public.vital_signs_logs (
    id              uuid primary key default gen_random_uuid(),
    baby_id         uuid not null references public.babies(id) on delete cascade,
    measured_at     timestamptz not null default now(),
    bp_systolic     integer check (bp_systolic between 40 and 250),
    bp_diastolic    integer check (bp_diastolic between 20 and 180),
    heart_rate_bpm  integer check (heart_rate_bpm between 20 and 300),
    oxygen_pct      numeric(4,1) check (oxygen_pct between 50 and 100),
    position        text check (position in ('sitting','lying','standing','unknown')) default 'sitting',
    notes           text,
    deleted_at      timestamptz,
    created_at      timestamptz not null default now(),
    created_by      uuid references auth.users(id) on delete set null,
    constraint chk_vital_signs_at_least_one
      check (bp_systolic is not null or bp_diastolic is not null
             or heart_rate_bpm is not null or oxygen_pct is not null)
);
create index if not exists idx_vital_signs_baby_time
  on public.vital_signs_logs(baby_id, measured_at desc) where deleted_at is null;

alter table public.vital_signs_logs enable row level security;
drop policy if exists vital_signs_select on public.vital_signs_logs;
create policy vital_signs_select on public.vital_signs_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists vital_signs_insert on public.vital_signs_logs;
create policy vital_signs_insert on public.vital_signs_logs
  for insert with check (public.has_baby_access(baby_id));
drop policy if exists vital_signs_update on public.vital_signs_logs;
create policy vital_signs_update on public.vital_signs_logs
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Blood glucose tracking — diabetes type on the baby + glucose log table
-- ────────────────────────────────────────────────────────────────────────────

alter table public.babies
  add column if not exists diabetes_type text
    check (diabetes_type in ('none','type_1','type_2','gestational','suspected'))
    default 'none';

-- One row = one finger-stick (or future CGM-spot) reading. Values are stored
-- in mg/dL because that's what Egyptian glucometers ship with; the UI can
-- show mmol/L on demand by dividing by 18.0182.
create table if not exists public.blood_sugar_logs (
    id            uuid primary key default gen_random_uuid(),
    baby_id       uuid not null references public.babies(id) on delete cascade,
    measured_at   timestamptz not null default now(),
    value_mgdl    numeric(5,1) not null check (value_mgdl between 20 and 800),
    meal_context  text not null check (meal_context in (
                    'fasting','before_meal','after_meal','bedtime','random','during_low'
                  )) default 'random',
    method        text check (method in ('finger_stick','cgm','vein_draw')) default 'finger_stick',
    notes         text,
    deleted_at    timestamptz,
    created_at    timestamptz not null default now(),
    created_by    uuid references auth.users(id) on delete set null
);
create index if not exists idx_blood_sugar_baby_time
  on public.blood_sugar_logs(baby_id, measured_at desc) where deleted_at is null;
create index if not exists idx_blood_sugar_baby_context
  on public.blood_sugar_logs(baby_id, meal_context, measured_at desc) where deleted_at is null;

alter table public.blood_sugar_logs enable row level security;
drop policy if exists blood_sugar_select on public.blood_sugar_logs;
create policy blood_sugar_select on public.blood_sugar_logs
  for select using (public.has_baby_access(baby_id));
drop policy if exists blood_sugar_insert on public.blood_sugar_logs;
create policy blood_sugar_insert on public.blood_sugar_logs
  for insert with check (public.has_baby_access(baby_id));
drop policy if exists blood_sugar_update on public.blood_sugar_logs;
create policy blood_sugar_update on public.blood_sugar_logs
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Audit-log + signature coverage for the two new log tables
-- ────────────────────────────────────────────────────────────────────────────
-- Reuses public.audit_row_change() (defined in migration 002) and the
-- whitelist in row_audit_summaries (migration 031). We re-attach the trigger
-- here so this migration is self-contained.

do $$
declare t text;
begin
  for t in select unnest(array['vital_signs_logs','blood_sugar_logs'])
  loop
    if exists (select 1 from pg_tables where schemaname='public' and tablename=t) then
      execute format('drop trigger if exists trg_audit_%I on public.%I;', t, t);
      execute format('create trigger trg_audit_%I
                      after insert or update or delete on public.%I
                      for each row execute function public.audit_row_change();', t, t);
    end if;
  end loop;
end $$;

-- Extend the audit-summary RPC's whitelist so the AuditFooter component
-- can show "Logged by …" on these tables too. We replace the function
-- with the same body but a wider allowed[] list.
create or replace function public.row_audit_summaries(
  p_table text,
  p_ids uuid[]
)
returns table(
  row_id uuid,
  created_by uuid,
  created_at timestamptz,
  last_updated_by uuid,
  last_updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array[
    'feedings','stool_logs','sleep_logs','medications','medication_logs',
    'measurements','temperature_logs','vaccinations',
    'screen_time_logs','activity_logs','teething_logs','speaking_logs',
    'developmental_milestones','shopping_list_items','allergies',
    'medical_conditions','admissions','discharges','lab_panels','lab_panel_items',
    'doctors','appointments','prenatal_visits','ultrasounds','fetal_movements',
    'maternal_symptoms','medical_files',
    'vital_signs_logs','blood_sugar_logs'
  ];
  q text;
begin
  if not (p_table = any(allowed)) then
    raise exception 'row_audit_summaries: table % not allowed', p_table;
  end if;

  q := format($f$
    with rows as (
      select id, baby_id, created_by, created_at
      from public.%I
      where id = any($1)
        and public.has_baby_access(baby_id)
    ),
    upd as (
      select row_id,
             max(edited_at)                                                    as last_updated_at,
             (array_agg(edited_by order by edited_at desc) filter (where edited_by is not null))[1]
                                                                               as last_updated_by
      from public.audit_log
      where table_name = %L
        and operation = 'UPDATE'
        and row_id = any($1)
      group by row_id
    )
    select r.id, r.created_by, r.created_at, u.last_updated_by, u.last_updated_at
    from rows r
    left join upd u on u.row_id = r.id
  $f$, p_table, p_table);
  return query execute q using p_ids;
end;
$$;
revoke all on function public.row_audit_summaries(text, uuid[]) from public;
grant execute on function public.row_audit_summaries(text, uuid[]) to authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. user_feedback — in-app channel for bug reports / suggestions / feedback
-- ────────────────────────────────────────────────────────────────────────────
-- Each user only sees their own submissions (RLS). The Babylytics team can
-- read everything via the service-role key from the dashboard or a future
-- admin page. Attachments live in the `feedback-attachments` storage bucket.

create table if not exists public.user_feedback (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users(id) on delete cascade,
    kind            text not null check (kind in ('bug','feature_request','feedback','question')),
    subject         text not null check (length(subject) between 1 and 200),
    body            text not null check (length(body) between 1 and 8000),
    attachment_path text,                       -- storage path, optional
    status          text not null default 'open'
                    check (status in ('open','triaged','in_progress','resolved','dismissed')),
    admin_response  text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);
create index if not exists idx_user_feedback_user_time
  on public.user_feedback(user_id, created_at desc) where deleted_at is null;
create index if not exists idx_user_feedback_status
  on public.user_feedback(status, created_at desc) where deleted_at is null;

alter table public.user_feedback enable row level security;

-- Users see / write only their own. Admin reads happen via the service role
-- which bypasses RLS, so no special admin policy is needed here.
drop policy if exists user_feedback_select_own on public.user_feedback;
create policy user_feedback_select_own on public.user_feedback
  for select using (auth.uid() = user_id);
drop policy if exists user_feedback_insert_own on public.user_feedback;
create policy user_feedback_insert_own on public.user_feedback
  for insert with check (auth.uid() = user_id);
drop policy if exists user_feedback_update_own on public.user_feedback;
create policy user_feedback_update_own on public.user_feedback
  for update using (auth.uid() = user_id)
  with check    (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Storage bucket for feedback attachments (screenshots etc.)
-- ────────────────────────────────────────────────────────────────────────────
-- Private bucket — every object's path is keyed by the user's uuid so the
-- policy can authorise reads/writes per-user.

insert into storage.buckets (id, name, public)
  values ('feedback-attachments', 'feedback-attachments', false)
  on conflict (id) do nothing;

-- Helper for path-prefix matching: `<auth.uid()>/...`
drop policy if exists feedback_attachments_select_own on storage.objects;
create policy feedback_attachments_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists feedback_attachments_insert_own on storage.objects;
create policy feedback_attachments_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists feedback_attachments_delete_own on storage.objects;
create policy feedback_attachments_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'feedback-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Publish the changelog entry for this shipment
-- ────────────────────────────────────────────────────────────────────────────

select public.publish_app_update(
  p_title    => 'New trackers — vital signs, blood sugar, in-app feedback',
  p_body     => 'Three new sections shipped together: (1) Vital signs tracker for blood pressure, heart rate, and oxygen saturation in a single entry — log any combination of the three with position (sitting / lying / standing). (2) Blood sugar tracker for diabetes management with meal context (fasting / before-meal / after-meal / bedtime / random / during-low) and method (finger-stick / CGM / vein-draw). Set the diabetes type on the baby record (none / type 1 / type 2 / gestational / suspected). Direct CGM sensor integration is on the roadmap — for now log readings manually or import from a CSV. (3) In-app feedback channel under Settings — file bugs, feature requests, or general feedback with optional screenshots. Each user only sees their own submissions.',
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => 'متتبعات جديدة — العلامات الحيوية وسكر الدم وقناة الملاحظات',
  p_body_ar  => 'ثلاثة أقسام جديدة تنزل معًا: (١) متتبع العلامات الحيوية لضغط الدم ونبض القلب وتشبع الأكسجين في إدخال واحد — سجلي أي تركيبة من الثلاثة مع وضعية الجسم (جلوس / استلقاء / وقوف). (٢) متتبع سكر الدم لإدارة السكري مع سياق الوجبة (صيام / قبل الأكل / بعد الأكل / النوم / عشوائي / أثناء انخفاض) والطريقة (وخز الإصبع / مستشعر مستمر CGM / سحب وريدي). حددي نوع السكري على بطاقة الطفل (لا يوجد / نوع ١ / نوع ٢ / حمل / مشتبه). تكامل مستشعر CGM المباشر في الخطة — حاليًا سجلي القراءات يدويًا أو استوردي من CSV. (٣) قناة ملاحظات داخل التطبيق ضمن الإعدادات — أرسلي بلاغات أخطاء أو طلبات ميزات أو ملاحظات عامة مع صور اختيارية. كل مستخدم يرى ملاحظاته فقط.'
);

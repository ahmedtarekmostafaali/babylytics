-- 030: Maternal symptoms tracker.
--
-- Logs how the pregnant parent is feeling — dizziness, nausea, vomiting, etc.
-- Each row is one observation. severity is 1..5 (1 = mild, 5 = severe).
-- Used by the new /prenatal/symptoms tracker page and surfaces as a recent-
-- symptom card on the pregnancy dashboard.

create table if not exists public.maternal_symptoms (
    id          uuid primary key default gen_random_uuid(),
    baby_id     uuid not null references public.babies(id) on delete cascade,
    logged_at   timestamptz not null default now(),
    kind        text not null check (kind in (
      'nausea','vomiting','dizziness','headache','swelling',
      'contractions','fatigue','heartburn','back_pain',
      'mood_swings','cramping','breathlessness','other'
    )),
    severity    int  not null check (severity between 1 and 5),
    notes       text,
    deleted_at  timestamptz,
    created_at  timestamptz not null default now(),
    created_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_maternal_symptoms_baby_logged
  on public.maternal_symptoms(baby_id, logged_at desc) where deleted_at is null;
create index if not exists idx_maternal_symptoms_kind
  on public.maternal_symptoms(baby_id, kind, logged_at desc) where deleted_at is null;

alter table public.maternal_symptoms enable row level security;

drop policy if exists maternal_symptoms_select on public.maternal_symptoms;
create policy maternal_symptoms_select on public.maternal_symptoms
  for select using (public.has_baby_access(baby_id));

drop policy if exists maternal_symptoms_write on public.maternal_symptoms;
create policy maternal_symptoms_write on public.maternal_symptoms
  for insert with check (public.has_baby_access(baby_id));

drop policy if exists maternal_symptoms_update on public.maternal_symptoms;
create policy maternal_symptoms_update on public.maternal_symptoms
  for update using (public.has_baby_access(baby_id))
  with check    (public.has_baby_access(baby_id));

-- Publish the changelog entry for this shipment.
select public.publish_app_update(
  'Pregnancy: maternal symptoms tracker',
  'Log dizziness, nausea, vomiting, headache, swelling, fatigue, contractions and more on a 1–5 severity scale. Recent symptoms surface on the pregnancy dashboard so you can see patterns over the week.',
  'new_feature'
);

select public.publish_app_update(
  'Pregnancy: daily baby-size expectations',
  'The pregnancy dashboard now shows what your baby is approximately the size and weight of TODAY (interpolated between weekly milestones), and overlays your most recent ultrasound EFW so you can see how on-track your baby is.',
  'new_feature'
);

select public.publish_app_update(
  'Pregnancy: what-to-expect by week, month, and trimester',
  'Expanded the weekly insight card on the pregnancy dashboard with what-to-expect content rolled up at three time scales — this week, this month, and this trimester — covering mom symptoms, baby development, and to-dos.',
  'enhancement'
);

-- 058: Wave 19 — community forum (category-scoped, optional anonymity)
-- ============================================================================
-- A space where users with similar profile contexts (cycle/pregnancy/baby)
-- can talk to each other. Each post chooses per-post visibility: under
-- the user's display_name OR under a deterministic anonymous handle
-- (e.g. "BraveOwl42") that's stable across all of that user's anonymous
-- posts so they have a consistent pseudonym.
--
-- Schema:
--   1. forum_categories — predefined topic buckets, seeded below.
--   2. forum_threads    — top-level posts (title + body + author).
--   3. forum_replies    — comments on threads (flat for v1).
--
-- RLS: anyone authenticated can read non-deleted content. Insert requires
-- author_id = auth.uid(). Update/delete only own posts. No moderation
-- queue yet — that's Wave 19b.
--
-- Anonymous handles: NOT stored — computed from a deterministic hash of
-- the user_id, server-side via the forum_anon_handle() helper. Same user
-- always gets the same pseudonym.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. forum_categories
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_categories (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  kind            text not null check (kind in ('cycle','pregnancy','baby','general')),
  title_en        text not null,
  title_ar        text not null,
  description_en  text,
  description_ar  text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. forum_threads
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_threads (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references public.forum_categories(id) on delete cascade,
  author_id      uuid not null references auth.users(id) on delete set null,
  anonymous      boolean not null default false,
  title          text not null check (length(trim(title)) >= 3 and length(title) <= 200),
  body           text not null check (length(trim(body)) >= 10 and length(body) <= 8000),
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  deleted_at     timestamptz,
  last_reply_at  timestamptz not null default now(),
  reply_count    int not null default 0
);
create index if not exists idx_forum_threads_cat_recent
  on public.forum_threads (category_id, last_reply_at desc) where deleted_at is null;
create index if not exists idx_forum_threads_author
  on public.forum_threads (author_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. forum_replies
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.forum_replies (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.forum_threads(id) on delete cascade,
  author_id       uuid not null references auth.users(id) on delete set null,
  anonymous       boolean not null default false,
  body            text not null check (length(trim(body)) >= 1 and length(body) <= 4000),
  parent_reply_id uuid references public.forum_replies(id) on delete cascade,
  created_at      timestamptz not null default now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);
create index if not exists idx_forum_replies_thread
  on public.forum_replies (thread_id, created_at asc) where deleted_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.forum_categories enable row level security;
alter table public.forum_threads    enable row level security;
alter table public.forum_replies    enable row level security;

drop policy if exists forum_cat_select on public.forum_categories;
create policy forum_cat_select on public.forum_categories
  for select using (true);  -- public list

drop policy if exists forum_threads_select on public.forum_threads;
create policy forum_threads_select on public.forum_threads
  for select using (deleted_at is null);

drop policy if exists forum_threads_insert on public.forum_threads;
create policy forum_threads_insert on public.forum_threads
  for insert with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists forum_threads_update on public.forum_threads;
create policy forum_threads_update on public.forum_threads
  for update using (author_id = auth.uid());

drop policy if exists forum_replies_select on public.forum_replies;
create policy forum_replies_select on public.forum_replies
  for select using (deleted_at is null);

drop policy if exists forum_replies_insert on public.forum_replies;
create policy forum_replies_insert on public.forum_replies
  for insert with check (auth.uid() is not null and author_id = auth.uid());

drop policy if exists forum_replies_update on public.forum_replies;
create policy forum_replies_update on public.forum_replies
  for update using (author_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Anonymous handle generator — deterministic from user_id. Returns a
-- friendly two-word + number combo that's stable for that user. The list
-- of adjectives + nouns is small enough that collisions can happen but
-- the trailing number reduces them. Not meant for security — just a
-- friendly pseudonym so people can recognise repeat anon commenters
-- inside a thread.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.forum_anon_handle(p_user uuid)
returns text
language sql immutable
as $$
  with adj as (
    select array['Brave','Kind','Quiet','Sunny','Wise','Bold','Calm','Gentle','Proud',
                 'Bright','Honest','Happy','Lucky','Mellow','Noble','Patient','Sincere',
                 'Steady','Swift','Warm','Witty','Zealous','Eager','Cheerful','Curious'] as a
  ),
  nouns as (
    select array['Lily','Owl','Falcon','Cedar','River','Star','Moon','Pearl','Willow',
                 'Phoenix','Sparrow','Iris','Lotus','Cypress','Comet','Aurora','Ocean',
                 'Tulip','Robin','Dolphin','Maple','Hazel','Wren','Lark','Olive'] as n
  ),
  h as (
    select abs(hashtext(p_user::text)) as v
  )
  select (select a[1 + (h.v % array_length(a, 1))] from adj, h)
      || (select n[1 + ((h.v / 31) % array_length(n, 1))] from nouns, h)
      || ((abs(h.v) % 89 + 10)::text)
    from h;
$$;
grant execute on function public.forum_anon_handle(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- forum_thread_with_meta — convenience view that joins author display
-- name (or anon handle when anonymous=true) so the UI doesn't need to
-- juggle the two cases. Reply count + last reply timestamp included.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.forum_thread_with_meta as
  select
    t.id,
    t.category_id,
    t.author_id,
    t.anonymous,
    t.title,
    t.body,
    t.created_at,
    t.edited_at,
    t.last_reply_at,
    t.reply_count,
    case when t.anonymous
      then public.forum_anon_handle(t.author_id)
      else coalesce(p.display_name, split_part(p.email, '@', 1))
    end as author_display
  from public.forum_threads t
  left join public.profiles p on p.id = t.author_id
  where t.deleted_at is null;
grant select on public.forum_thread_with_meta to authenticated;

create or replace view public.forum_reply_with_meta as
  select
    r.id,
    r.thread_id,
    r.author_id,
    r.anonymous,
    r.body,
    r.created_at,
    r.edited_at,
    r.parent_reply_id,
    case when r.anonymous
      then public.forum_anon_handle(r.author_id)
      else coalesce(p.display_name, split_part(p.email, '@', 1))
    end as author_display
  from public.forum_replies r
  left join public.profiles p on p.id = r.author_id
  where r.deleted_at is null;
grant select on public.forum_reply_with_meta to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- post_forum_thread + post_forum_reply RPCs — add safe insert helpers that
-- also bump last_reply_at + reply_count atomically when a reply is posted.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.post_forum_thread(
  p_category_slug text,
  p_title         text,
  p_body          text,
  p_anonymous     boolean default false
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cat  uuid;
  v_id   uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_cat from public.forum_categories where slug = p_category_slug;
  if v_cat is null then raise exception 'unknown_category'; end if;
  insert into public.forum_threads (category_id, author_id, anonymous, title, body)
       values (v_cat, v_user, coalesce(p_anonymous, false), p_title, p_body)
       returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.post_forum_thread(text, text, text, boolean) to authenticated;

create or replace function public.post_forum_reply(
  p_thread_id     uuid,
  p_body          text,
  p_anonymous     boolean default false,
  p_parent_reply  uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  insert into public.forum_replies (thread_id, author_id, anonymous, body, parent_reply_id)
       values (p_thread_id, v_user, coalesce(p_anonymous, false), p_body, p_parent_reply)
       returning id into v_id;
  update public.forum_threads
     set last_reply_at = now(),
         reply_count   = reply_count + 1
   where id = p_thread_id;
  return v_id;
end;
$$;
grant execute on function public.post_forum_reply(uuid, text, boolean, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Soft-delete RPCs (own posts only, enforced via update RLS).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.soft_delete_forum_thread(p_thread_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.forum_threads set deleted_at = now()
   where id = p_thread_id and author_id = auth.uid();
$$;
grant execute on function public.soft_delete_forum_thread(uuid) to authenticated;

create or replace function public.soft_delete_forum_reply(p_reply_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_thread uuid;
begin
  update public.forum_replies set deleted_at = now()
   where id = p_reply_id and author_id = auth.uid()
   returning thread_id into v_thread;
  if v_thread is not null then
    update public.forum_threads
       set reply_count = greatest(0, reply_count - 1)
     where id = v_thread;
  end if;
end;
$$;
grant execute on function public.soft_delete_forum_reply(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Seed categories. Idempotent via unique slug.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.forum_categories (slug, kind, title_en, title_ar, description_en, description_ar, sort_order) values
  ('cycle-general',    'cycle',     'Cycle — general',           'الدورة — عام',
   'Anything cycle-related — questions, vents, advice.',
   'أي شيء عن الدورة — أسئلة، فضفضة، نصائح.', 10),
  ('cycle-pcos',       'cycle',     'PCOS',                      'تكيس المبايض (PCOS)',
   'Living with polycystic ovary syndrome.',
   'الحياة مع متلازمة تكيس المبايض.', 20),
  ('cycle-ttc',        'cycle',     'Trying to conceive',         'محاولة الحمل',
   'Cycle tracking, fertility windows, the wait.',
   'تتبع الدورة، نوافذ الإخصاب، الانتظار.', 30),
  ('cycle-postpartum', 'cycle',     'Postpartum return',          'عودة الدورة بعد الولادة',
   'When cycles come back after birth.',
   'حين تعود الدورة بعد الولادة.', 40),
  ('preg-first',       'pregnancy', 'First trimester',            'الثلث الأول',
   'Weeks 1–13: nausea, fatigue, the first scans.',
   'الأسابيع ١–١٣: الغثيان، التعب، أول السونار.', 110),
  ('preg-second',      'pregnancy', 'Second trimester',           'الثلث الثاني',
   'Weeks 14–27: the calmer middle, anatomy scan, kicks.',
   'الأسابيع ١٤–٢٧: الفترة الأهدأ، فحص التشريح، الركلات.', 120),
  ('preg-third',       'pregnancy', 'Third trimester',            'الثلث الثالث',
   'Weeks 28–40+: hospital prep, Braxton-Hicks, big finish.',
   'الأسابيع ٢٨–٤٠+: التحضير للمستشفى، تقلصات براكستون-هيكس، النهاية الكبيرة.', 130),
  ('preg-birth',       'pregnancy', 'Birth & beyond',             'الولادة وما بعدها',
   'Birth stories, postpartum recovery, the fourth trimester.',
   'قصص الولادة، التعافي بعد الولادة، الثلث الرابع.', 140),
  ('baby-newborn',     'baby',      'Newborn (0–3 months)',       'حديثو الولادة (٠–٣ شهور)',
   'The blur. Feeding, sleep cycles, witching hours.',
   'الضباب. الرضعات، دورات النوم، ساعات البكاء.', 210),
  ('baby-older',       'baby',      'Older babies (3–12 months)', 'أطفال أكبر (٣–١٢ شهر)',
   'Solids, sitting, crawling, first words.',
   'الطعام الصلب، الجلوس، الحبو، أول الكلمات.', 220),
  ('baby-toddler',     'baby',      'Toddlers',                   'الأطفال الصغار',
   'Walking, talking, the toddler years.',
   'المشي، الكلام، سنوات الطفولة الصغيرة.', 230),
  ('baby-sleep',       'baby',      'Sleep',                      'النوم',
   'Naps, night wakings, regressions, sleep training.',
   'القيلولات، الاستيقاظ ليلًا، الانتكاسات، تدريب النوم.', 240),
  ('baby-feeding',     'baby',      'Feeding',                    'الرضاعة والطعام',
   'Breastfeeding, formula, weaning, picky eaters.',
   'الرضاعة الطبيعية، الحليب الصناعي، الفطام، الأكل الانتقائي.', 250),
  ('general',          'general',   'Open chat',                   'دردشة مفتوحة',
   'Off-topic — anything else.',
   'أي شيء خارج المواضيع الأخرى.', 900)
on conflict (slug) do nothing;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Community forum — talk to others on the same journey$t1$,
  p_body     => $b1$New top-level Forum tab. Categories grouped by where you are: Cycle (general, PCOS, TTC, postpartum return), Pregnancy (each trimester + birth), Baby (newborn, older babies, toddlers, sleep, feeding), and Open chat. Every post and reply has an anonymous toggle — flip it on and you appear under a friendly pseudonym (e.g. "BraveOwl42") instead of your name. The pseudonym is stable for you across the whole forum so people can recognise repeat anon commenters inside a thread.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$منتدى المجتمع — تحدثي مع من يعيشن نفس الرحلة$ta1$,
  p_body_ar  => $ba1$تبويبة "المنتدى" الجديدة. أقسام حسب مرحلتك: الدورة (عام، PCOS، محاولة الحمل، عودة الدورة بعد الولادة)، الحمل (كل ثلث + الولادة)، الطفل (حديث الولادة، أكبر، صغار، النوم، الرضاعة)، ودردشة مفتوحة. كل منشور ورد عليه زر "مجهول" — اضغطيه فتظهرين باسم مستعار ودود (مثل "BraveOwl42") بدل اسمك. الاسم المستعار ثابت لك عبر المنتدى كله، فيقدر الناس يميزون المعلقين المجهولين المتكررين داخل الموضوع.$ba1$
);

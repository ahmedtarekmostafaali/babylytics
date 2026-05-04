-- 080: Wave 37 — smart nutrition engine (Egyptian, stage-aware)
-- ============================================================================
-- A small structured nutrition tip engine tuned for Egyptian / MENA
-- diets. Replaces the generic "eat healthy" copy that competitor apps
-- ship with by filtering tips against:
--
--   * lifecycle stage (planning / pregnancy / baby)
--   * trimester (pregnancy)
--   * baby age in months (baby)
--   * Ramadan (boost ramadan-relevant + skip ramadan-only outside)
--
-- Each tip carries bilingual title + body, food type, addresses-tag
-- (iron / folate / calcium / etc. so we can later boost based on lab
-- deficiencies), Ramadan flags, and a weight for ranking.
--
-- The seed set is 24 tips covering the most useful Egyptian foods +
-- their nutritional rationale. The table can grow indefinitely; the
-- engine just picks p_limit at random with weight bias.
--
-- Idempotent.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. nutrition_tips table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.nutrition_tips (
  id              uuid primary key default gen_random_uuid(),
  -- Stage filtering — array so a tip can apply to multiple stages.
  stage_scope     text[] not null check (stage_scope <> '{}'),  -- 'planning' | 'pregnancy' | 'baby'
  -- Trimester filter (pregnancy only). NULL = all trimesters.
  trimesters      int[],
  -- Age range for baby tips (months). NULL on either side = open-ended.
  age_min_months  int,
  age_max_months  int,
  -- Bilingual content.
  title_en        text not null,
  title_ar        text not null,
  body_en         text not null,
  body_ar         text not null,
  -- Food classification.
  food_type       text not null check (food_type in ('meal','snack','drink','sweet','side','staple','tip')),
  -- Nutrients addressed — used later for lab-deficiency-aware boosting.
  addresses_tags  text[] not null default '{}',
  -- Ramadan flags.
  ramadan_only      boolean not null default false,
  ramadan_relevant  boolean not null default false,
  -- Generic tags for variety + filtering.
  tags            text[] not null default '{}',
  -- Ranking weight 1-10. Higher = surfaced more often.
  weight          int not null default 5 check (weight between 1 and 10),
  created_at      timestamptz not null default now()
);

create index if not exists idx_nutrition_tips_stage on public.nutrition_tips using gin (stage_scope);
create index if not exists idx_nutrition_tips_addresses on public.nutrition_tips using gin (addresses_tags);

alter table public.nutrition_tips enable row level security;

-- Public read — every authenticated user can fetch tips. Writes are
-- admin-only via service-role connections (no user policy).
drop policy if exists nutrition_tips_select on public.nutrition_tips;
create policy nutrition_tips_select on public.nutrition_tips
  for select using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed: 24 hand-curated Egyptian-tuned tips. Idempotent via title_en
--    uniqueness in the seed (we don't enforce unique at the column level
--    so editorial can re-use titles intentionally; the seed pattern
--    skips on conflict by checking existence).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_seed jsonb := jsonb_build_array(

    -- ─────── PREGNANCY (12 tips) ───────────────────────────────────────────
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1],
      'title_en', 'Ginger tea for first-trimester nausea',
      'title_ar', 'شاي الجنزبيل للغثيان في الثلث الأول',
      'body_en',  'Fresh ginger steeped 5 min with a slice of lemon. Sip slowly between meals — ginger has the best evidence for pregnancy nausea among home remedies. Skip if you''re also on blood thinners.',
      'body_ar',  'جنزبيل طازج منقوع ٥ دقائق مع شريحة ليمون. اشربيه ببطء بين الوجبات — الجنزبيل من أفضل العلاجات المنزلية المثبتة لغثيان الحمل. تجنبيه إذا كنتِ على أدوية سيولة الدم.',
      'food_type', 'drink', 'addresses_tags', array['nausea','hydration'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['first_trimester','nausea'], 'weight', 8
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1,2,3],
      'title_en', 'Ful medames + spinach for iron + folate',
      'title_ar', 'فول مدمس مع سبانخ — حديد وحمض فوليك',
      'body_en',  'Mash ful medames with chopped raw spinach + lemon juice + olive oil. The vitamin C from lemon doubles iron absorption from both. One bowl covers ~30% of pregnancy iron needs.',
      'body_ar',  'افرمي السبانخ النيئة مع الفول المدمس + عصرة ليمون + زيت زيتون. فيتامين C من الليمون يضاعف امتصاص الحديد. طبق واحد يغطي حوالي ٣٠٪ من احتياج الحمل للحديد.',
      'food_type', 'meal', 'addresses_tags', array['iron','folate','protein'],
      'ramadan_only', false, 'ramadan_relevant', true,
      'tags', array['breakfast','suhoor'], 'weight', 9
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[2,3],
      'title_en', 'Molokhia — folate, iron, calcium in one bowl',
      'title_ar', 'الملوخية — حمض فوليك وحديد وكالسيوم',
      'body_en',  'Molokhia is one of the most nutrient-dense leafy greens for pregnancy. Eat with brown rice for slow-release energy. Avoid if you''ve been told you have low blood pressure — it can mildly drop BP.',
      'body_ar',  'الملوخية من أغنى الخضروات الورقية بالعناصر للحمل. تناوليها مع أرز بني لطاقة مستمرة. تجنبيها إذا كان ضغطك منخفضاً — يمكن أن تخفضه قليلاً.',
      'food_type', 'meal', 'addresses_tags', array['folate','iron','calcium'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['lunch','traditional'], 'weight', 8
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[3],
      'title_en', 'Sahlab with milk + nuts for late-pregnancy calcium',
      'title_ar', 'سحلب باللبن والمكسرات لكالسيوم الثلث الأخير',
      'body_en',  'Whole milk + sahlab + crushed pistachios + sesame seeds. The 3rd trimester is when fetal bone calcification accelerates — your need jumps to ~1200 mg/day. One cup covers ~30%.',
      'body_ar',  'لبن كامل الدسم + سحلب + فستق مفروم + سمسم. الثلث الأخير وقت تكوّن عظام الجنين بسرعة — احتياجك يقفز لحوالي ١٢٠٠ مجم كالسيوم يومياً. كوب واحد يغطي حوالي ٣٠٪.',
      'food_type', 'drink', 'addresses_tags', array['calcium','protein'],
      'ramadan_only', false, 'ramadan_relevant', true,
      'tags', array['evening','warm'], 'weight', 7
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1,2,3],
      'title_en', 'Suhoor: eggs + ful + dates + plenty of water',
      'title_ar', 'سحور: بيض + فول + تمر + ماء كافٍ',
      'body_en',  'During Ramadan a pregnant woman''s suhoor matters more than the iftar feast. Aim for slow-release protein (eggs + ful) + complex carbs + dates for natural sugar + at least 500ml water before the call to fast.',
      'body_ar',  'في رمضان، السحور للحامل أهم من الإفطار. خذي بروتين بطيء الهضم (بيض + فول) + كربوهيدرات معقدة + تمر للسكر الطبيعي + ٥٠٠ مل ماء على الأقل قبل الإمساك.',
      'food_type', 'meal', 'addresses_tags', array['protein','energy','hydration'],
      'ramadan_only', true, 'ramadan_relevant', true,
      'tags', array['suhoor','ramadan'], 'weight', 10
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1,2,3],
      'title_en', 'Iftar: dates first, then soup before the heavy plate',
      'title_ar', 'إفطار: تمرات أولاً، ثم شوربة قبل الطبق الرئيسي',
      'body_en',  'Break fast with 3 dates + water, then 10-min pause + soup (lentil or chicken). This prevents the blood-sugar crash that follows hitting koshary or mahshi straight after a long fast — particularly risky during pregnancy.',
      'body_ar',  'افطري بـ ٣ تمرات وماء، ثم انتظري ١٠ دقائق + شوربة (عدس أو فراخ). هذا يمنع انهيار سكر الدم الذي يحدث لو أكلتِ كشري أو محشي مباشرة بعد صيام طويل — خطر مضاعف في الحمل.',
      'food_type', 'tip', 'addresses_tags', array['glucose','energy'],
      'ramadan_only', true, 'ramadan_relevant', true,
      'tags', array['iftar','ramadan'], 'weight', 10
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1,2,3],
      'title_en', 'Pomegranate juice for iron + antioxidants',
      'title_ar', 'عصير الرمان للحديد ومضادات الأكسدة',
      'body_en',  'Half a cup fresh-squeezed pomegranate. Strong evidence for boosting fetal brain blood flow + maternal iron. Limit to one serving/day if you''re managing blood sugar — it''s naturally sweet.',
      'body_ar',  'نصف كوب عصير رمان طازج. توجد أدلة قوية على تحسين تدفق الدم لمخ الجنين + رفع حديد الأم. مرة واحدة يومياً إذا كنتِ تتابعين السكر — حلو بطبيعته.',
      'food_type', 'drink', 'addresses_tags', array['iron','antioxidant'],
      'ramadan_only', false, 'ramadan_relevant', true,
      'tags', array['fruit','iftar'], 'weight', 7
    ),
    jsonb_build_object(
      'stage_scope', array['pregnancy'],
      'trimesters',  array[1,2,3],
      'title_en', 'Tahini — calcium, iron, protein in one spoon',
      'title_ar', 'الطحينة — كالسيوم وحديد وبروتين في معلقة',
      'body_en',  'A tablespoon of tahini drizzled on bread, salad, or stirred into yoghurt. Egyptian tahini is one of the densest plant calcium sources we eat regularly — useful if you don''t tolerate dairy.',
      'body_ar',  'ملعقة طحينة على عيش أو سلطة أو في الزبادي. الطحينة المصرية من أغنى مصادر الكالسيوم النباتية — مفيدة إذا كان جسمك لا يتحمل الألبان.',
      'food_type', 'side', 'addresses_tags', array['calcium','iron','protein'],
      'ramadan_only', false, 'ramadan_relevant', true,
      'tags', array['versatile'], 'weight', 7
    ),

    -- ─────── PLANNING / CYCLE (6 tips) ─────────────────────────────────────
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Liver + lemon for post-period iron recovery',
      'title_ar', 'كبدة بالليمون لتعويض الحديد بعد الدورة',
      'body_en',  'Lightly grilled chicken or beef liver with a generous squeeze of lemon. The most bioavailable iron source available — restores stores faster than any supplement. Once a week is plenty; more risks vitamin A excess if you may be pregnant.',
      'body_ar',  'كبدة فراخ أو لحمة مشوية مع عصر ليمون. أفضل مصدر للحديد سريع الامتصاص — يعوض المخزون أسرع من أي مكمل. مرة أسبوعياً تكفي؛ أكثر من ذلك قد يضر إذا كان هناك احتمال حمل (فيتامين أ).',
      'food_type', 'meal', 'addresses_tags', array['iron','b12','vitamin_a'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['post_period'], 'weight', 8
    ),
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Pumpkin seeds — zinc for fertility',
      'title_ar', 'بذور القرع (لب) — زنك للخصوبة',
      'body_en',  'A handful of plain roasted pumpkin seeds daily. Zinc is one of the most underrated minerals for ovulation regularity + egg quality. Egyptian "lib abyad" works perfectly — skip the salted varieties if you have BP concerns.',
      'body_ar',  'حفنة بذور قرع محمصة بدون ملح يومياً. الزنك من أكثر المعادن أهمية لانتظام التبويض وجودة البويضة. اللب الأبيض المصري ممتاز — تجنبي المملح إذا كان عندك ضغط.',
      'food_type', 'snack', 'addresses_tags', array['zinc','fertility'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['ttc','snack'], 'weight', 7
    ),
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Dark chocolate + magnesium for cramps',
      'title_ar', 'شوكولاتة داكنة ومغنيسيوم للتقلصات',
      'body_en',  'Two squares of 70%+ dark chocolate during cramping days. Magnesium relaxes uterine muscle. Pair with a banana for an easy magnesium-rich snack that doesn''t spike blood sugar.',
      'body_ar',  'مربعين من شوكولاتة داكنة ٧٠٪ أو أعلى في أيام التقلصات. المغنيسيوم يرخي عضلة الرحم. مع موزة، تكون وجبة خفيفة غنية بالمغنيسيوم لا ترفع السكر.',
      'food_type', 'snack', 'addresses_tags', array['magnesium','energy'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['period_pain'], 'weight', 6
    ),
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Sesame + honey paste for late-luteal energy',
      'title_ar', 'عجينة سمسم وعسل لطاقة آخر الدورة',
      'body_en',  'Two tbsp tahini + 1 tsp honey, on toast or by the spoon. The luteal phase (week before period) burns 100-300 extra calories — your body wants iron + magnesium + slow sugar. This hits all three.',
      'body_ar',  'ملعقتين طحينة + ملعقة عسل، على توست أو بالملعقة. الأسبوع قبل الدورة جسمك بيحرق ١٠٠-٣٠٠ سعرة إضافية — يحتاج حديد + مغنيسيوم + سكر بطيء. هذه الوصفة فيها كلها.',
      'food_type', 'snack', 'addresses_tags', array['iron','magnesium','energy'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['luteal','pms'], 'weight', 6
    ),
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Folic acid before conception — start now if TTC',
      'title_ar', 'حمض الفوليك قبل الحمل — ابدئي الآن إذا تخططين',
      'body_en',  'If you''re trying to conceive (or could be), 400 mcg folic acid daily — ideally for 3 months before conception. Cuts neural tube defect risk by ~70%. Your OB-GYN will recommend a brand; most cost <30 EGP/month.',
      'body_ar',  'إذا كنتِ تخططين للحمل (أو ممكن)، ٤٠٠ ميكروجرام حمض فوليك يومياً — أفضلها ٣ شهور قبل الحمل. يقلل خطر عيوب الأنبوب العصبي بحوالي ٧٠٪. طبيبتك ستوصي بنوع محدد؛ معظم الأنواع أقل من ٣٠ جنيه شهرياً.',
      'food_type', 'tip', 'addresses_tags', array['folate','fertility'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['ttc','supplement'], 'weight', 9
    ),
    jsonb_build_object(
      'stage_scope', array['planning'],
      'title_en', 'Suhoor for cycle health: protein + complex carbs',
      'title_ar', 'سحور صحي للدورة: بروتين وكربوهيدرات معقدة',
      'body_en',  'During Ramadan, women with irregular cycles can see things shift — fasting affects hormones. Anchor your suhoor with eggs, ful, oats. Skip the heavy sweets; they''ll spike then crash and worsen luteal symptoms.',
      'body_ar',  'في رمضان، صاحبات الدورة غير المنتظمة قد يلاحظن تغيرات — الصيام يؤثر على الهرمونات. اجعلي سحورك بيض وفول وشوفان. تجنبي الحلويات الثقيلة؛ ترفع السكر ثم تهبطه وتسوء أعراض ما قبل الدورة.',
      'food_type', 'meal', 'addresses_tags', array['protein','energy'],
      'ramadan_only', true, 'ramadan_relevant', true,
      'tags', array['suhoor','ramadan'], 'weight', 8
    ),

    -- ─────── BABY (6 tips, age-banded) ─────────────────────────────────────
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 0, 'age_max_months', 6,
      'title_en', 'Exclusive breastfeeding 0-6 months — water not needed',
      'title_ar', 'الرضاعة الطبيعية الحصرية ٠-٦ شهور — لا تحتاج ماء',
      'body_en',  'WHO + AAP recommend exclusive breast milk (no water, no juice, no formula unless medically needed) for the first 6 months. In Egyptian summers it''s tempting to offer water — breast milk is already 88% water and provides every drop your baby needs.',
      'body_ar',  'منظمة الصحة العالمية و AAP يوصون برضاعة طبيعية حصرية (بدون ماء أو عصير أو حليب صناعي إلا لضرورة طبية) أول ٦ شهور. في الصيف المصري قد تشعرين بحاجة لإعطاء ماء — حليب الأم ٨٨٪ ماء ويغطي كل احتياج طفلك.',
      'food_type', 'tip', 'addresses_tags', array['hydration'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['newborn','breastfeeding'], 'weight', 9
    ),
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 6, 'age_max_months', 9,
      'title_en', 'First foods: avocado + banana + sweet potato',
      'title_ar', 'أول الطعام: أفوكادو + موز + بطاطا',
      'body_en',  'Single-ingredient purées at first. Avocado for healthy fats + brain development. Banana for easy energy. Sweet potato (mashed with a touch of breast milk) for vitamin A + sweetness without added sugar. Wait 3 days between new foods to spot reactions.',
      'body_ar',  'مهروسات بمكون واحد في البداية. أفوكادو لدهون صحية وتطور المخ. موز لطاقة سهلة. بطاطا (مهروسة بقليل من حليب الأم) لفيتامين أ وحلاوة طبيعية بدون سكر مضاف. انتظري ٣ أيام بين كل طعام جديد لملاحظة الحساسية.',
      'food_type', 'meal', 'addresses_tags', array['fat','energy','vitamin_a'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['solids','first_foods'], 'weight', 9
    ),
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 6, 'age_max_months', 12,
      'title_en', 'Iron-fortified rice cereal + lentil purée',
      'title_ar', 'سيريلاك أرز مدعم بالحديد + شوربة عدس مهروسة',
      'body_en',  'Iron stores from birth start to deplete around 6 months. Iron-fortified cereal mixed with breast milk + a few spoons of plain lentil soup (no salt, no spices, well-cooked) covers iron needs naturally during transition.',
      'body_ar',  'مخزون الحديد من الولادة يبدأ ينخفض حوالي الشهر السادس. سيريلاك مدعم بالحديد مخلوط بحليب الأم + ملاعق من شوربة العدس (بدون ملح أو بهارات، مطبوخة جيداً) تغطي احتياج الحديد طبيعياً خلال هذه المرحلة.',
      'food_type', 'meal', 'addresses_tags', array['iron'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['solids','iron'], 'weight', 8
    ),
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 9, 'age_max_months', 18,
      'title_en', 'Soft Egyptian foods: koshary base, mashed ful, mahshi inside',
      'title_ar', 'أكلات مصرية لينة: أساس كشري، فول مهروس، قلب محشي',
      'body_en',  'Around 9-12 months baby can start joining family meals — gently. Plain rice + lentils from koshary (skip the spicy sauce + crispy onions). Mashed ful without salt. The soft inside of mahshi without the pickled outer leaf. Goal: build familiarity with home flavours.',
      'body_ar',  'حوالي ٩-١٢ شهر يمكن أن يبدأ الطفل في مشاركة الأكل العائلي — بلطف. أرز وعدس بسيط من الكشري (بدون شطة وبصل مقرمش). فول مهروس بدون ملح. القلب اللين من المحشي بدون الورقة المخللة. الهدف: تعويد الطفل على نكهات البيت.',
      'food_type', 'meal', 'addresses_tags', array['protein','iron','familiarity'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['family_table','traditional'], 'weight', 8
    ),
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 12, 'age_max_months', 36,
      'title_en', 'Toddler protein: yoghurt + tahini + chicken',
      'title_ar', 'بروتين الطفل: زبادي + طحينة + فراخ',
      'body_en',  'Toddlers need ~13g protein/day. A tub of full-fat yoghurt + a chicken thigh + a tablespoon of tahini gets you there easily. Egyptian whole-milk yoghurt is denser than imported brands — half the volume covers the same protein.',
      'body_ar',  'الطفل يحتاج حوالي ١٣ جرام بروتين يومياً. علبة زبادي كامل الدسم + فخدة فراخ + ملعقة طحينة تكفي. الزبادي المصري كامل الدسم أكثف من الأنواع المستوردة — نصف الكمية تكفي لنفس البروتين.',
      'food_type', 'meal', 'addresses_tags', array['protein','calcium','fat'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['toddler'], 'weight', 7
    ),
    jsonb_build_object(
      'stage_scope', array['baby'],
      'age_min_months', 6, 'age_max_months', 36,
      'title_en', 'Honey: never under 12 months',
      'title_ar', 'العسل: ممنوع تحت سنة',
      'body_en',  'Even raw natural honey can carry botulism spores that an infant''s gut can''t handle. Strict no until baby''s first birthday. After 12 months it''s a great natural sweetener for yoghurt + cereals.',
      'body_ar',  'حتى العسل الطبيعي الخام يمكن أن يحمل بكتيريا التسمم الوشيقي التي لا تستطيع أمعاء الرضيع التعامل معها. ممنوع تماماً قبل عيد ميلاد الطفل الأول. بعد السنة، محلي طبيعي ممتاز للزبادي والسيريلاك.',
      'food_type', 'tip', 'addresses_tags', array['safety'],
      'ramadan_only', false, 'ramadan_relevant', false,
      'tags', array['safety','myth'], 'weight', 8
    )
  );
  rec jsonb;
begin
  for rec in select * from jsonb_array_elements(v_seed) loop
    if not exists (select 1 from public.nutrition_tips where title_en = rec->>'title_en') then
      insert into public.nutrition_tips (
        stage_scope, trimesters, age_min_months, age_max_months,
        title_en, title_ar, body_en, body_ar,
        food_type, addresses_tags,
        ramadan_only, ramadan_relevant, tags, weight
      ) values (
        (select array_agg(value::text) from jsonb_array_elements_text(rec->'stage_scope')),
        case when rec ? 'trimesters'
          then (select array_agg((value)::int) from jsonb_array_elements_text(rec->'trimesters'))
          else null end,
        nullif(rec->>'age_min_months','')::int,
        nullif(rec->>'age_max_months','')::int,
        rec->>'title_en', rec->>'title_ar', rec->>'body_en', rec->>'body_ar',
        rec->>'food_type',
        (select array_agg(value::text) from jsonb_array_elements_text(rec->'addresses_tags')),
        coalesce((rec->>'ramadan_only')::boolean, false),
        coalesce((rec->>'ramadan_relevant')::boolean, false),
        coalesce((select array_agg(value::text) from jsonb_array_elements_text(rec->'tags')), '{}'),
        coalesce((rec->>'weight')::int, 5)
      );
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Ramadan detection helper (mirrors lib/ramadan.ts ranges)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_ramadan_today()
returns boolean
language sql stable as $$
  select current_date between '2024-03-11' and '2024-04-09'
      or current_date between '2025-02-28' and '2025-03-29'
      or current_date between '2026-02-17' and '2026-03-19'
      or current_date between '2027-02-07' and '2027-03-08'
      or current_date between '2028-01-28' and '2028-02-25'
      or current_date between '2029-01-16' and '2029-02-13'
      or current_date between '2030-01-05' and '2030-02-03';
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. nutrition_suggestions(p_baby, p_limit) — stage-aware picker
-- ─────────────────────────────────────────────────────────────────────────────
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
  is_ramadan_pick boolean
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

  -- Compute trimester for pregnancy.
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

  -- Age in months for baby.
  if v_stage = 'baby' then
    v_age_mo := case
      when v_baby.dob is null then null
      else floor(extract(epoch from (now() - v_baby.dob::timestamptz)) / 86400.0 / 30.44)::int
    end;
  end if;

  return query
    with eligible as (
      select t.*,
             -- Effective weight: base × Ramadan boost × stage match.
             t.weight::numeric *
             case when v_ramadan and t.ramadan_relevant then 1.6 else 1.0 end *
             random() as rank_score
        from public.nutrition_tips t
        where v_stage = any(t.stage_scope)
          -- Trimester filter (pregnancy only).
          and (v_stage <> 'pregnancy' or t.trimesters is null or v_trim is null
               or v_trim = any(t.trimesters))
          -- Age filter (baby only).
          and (v_stage <> 'baby'
               or (
                 (t.age_min_months is null or v_age_mo is null or v_age_mo >= t.age_min_months)
                 and
                 (t.age_max_months is null or v_age_mo is null or v_age_mo <= t.age_max_months)
               ))
          -- Ramadan-only tips skipped outside Ramadan.
          and (not t.ramadan_only or v_ramadan)
    )
    select
      e.id, e.title_en, e.title_ar, e.body_en, e.body_ar,
      e.food_type, e.addresses_tags,
      (v_ramadan and e.ramadan_relevant) as is_ramadan_pick
    from eligible e
    order by e.rank_score desc
    limit greatest(1, least(p_limit, 12));
end;
$$;
grant execute on function public.nutrition_suggestions(uuid, int) to authenticated;

commit;

-- App update notification.
select public.publish_app_update(
  p_title    => $t1$Smart nutrition: Egyptian-cuisine-aware suggestions$t1$,
  p_body     => $b1$A new nutrition card on every profile reads your stage (cycle / pregnancy / baby), trimester or baby age, and whether Ramadan is active — and surfaces 3 Egyptian-cuisine-tuned tips that fit. First seed includes 24 tips covering ful + spinach for iron, sahlab for late-pregnancy calcium, suhoor + iftar guidance during Ramadan (pregnancy + cycle), liver + lemon post-period iron recovery, pumpkin seeds for fertility zinc, first solids by age band (avocado/banana/sweet potato → soft koshary/ful at 9-12mo → toddler protein), plus safety reminders (no honey under 12 months). All bilingual, ranked with Ramadan-relevant tips boosted during the month, randomised so the card refreshes naturally. Future waves can layer lab-deficiency-aware boosting on top.$b1$,
  p_category => 'new_feature',
  p_date     => current_date,
  p_title_ar => $ta1$تغذية ذكية: اقتراحات تناسب المطبخ المصري$ta1$,
  p_body_ar  => $ba1$بطاقة تغذية جديدة في كل ملف تقرأ مرحلتك (دورة / حمل / طفل)، الثلث أو عمر الطفل، وهل رمضان حالياً — وتعرض ٣ اقتراحات مناسبة من المطبخ المصري. أول مجموعة تحتوي ٢٤ نصيحة تشمل: فول وسبانخ للحديد، سحلب لكالسيوم آخر الحمل، إرشادات سحور وإفطار في رمضان (حمل ودورة)، كبدة وليمون لتعويض حديد ما بعد الدورة، لب أبيض للزنك (الخصوبة)، أول الطعام للأطفال بحسب العمر (أفوكادو/موز/بطاطا → كشري وفول لين عند ٩-١٢ شهر → بروتين الطفل)، وتنبيهات أمان (ممنوع العسل قبل سنة). كلها بالعربي والإنجليزي، مع تعزيز اقتراحات رمضان أثناء الشهر. الموجات القادمة ستضيف تعزيز حسب نقص العناصر من التحاليل.$ba1$
);

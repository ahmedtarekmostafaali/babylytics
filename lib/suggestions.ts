// Static suggestion library — "Ideas for today" surfaced on each profile's
// overview. Picks 3 per day per profile via deterministic hash so the same
// trio shows all day, then rotates tomorrow. Bilingual (EN + AR).
//
// Stages:
//   - 'baby'      → age-appropriate developmental activities (sensory, motor,
//                   language, etc.). Filtered by age in days.
//   - 'pregnancy' → trimester-aware wellness tips (hydration, kegels, etc.).
//                   Filtered by gestational week.
//   - 'cycle'     → cycle-phase-aware self-care (menstrual / follicular /
//                   ovulatory / luteal). Filtered by phase computed from the
//                   most recent period_start.
//
// Marked-done state is held in localStorage (key per date+baby+id) so the
// UI shows progress for today only — no DB writes for v1.

export type SuggestionStage = 'baby' | 'pregnancy' | 'cycle';
export type CyclePhase     = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
// Wave 12: cycle mode tags suggestions to specific conditions/contexts so
// the daily ideas feel personal. Standard items have no mode tag.
export type CycleMode      = 'standard' | 'pcos' | 'endometriosis' | 'irregular' | 'athlete' | 'postpartum';

export interface Suggestion {
  id: string;
  stage: SuggestionStage;
  /** Lucide-react icon name. Renderer maps string → component. */
  icon: 'sparkles' | 'heart' | 'baby' | 'droplet' | 'milk' | 'apple' | 'moon'
      | 'activity' | 'book' | 'music' | 'sun' | 'leaf' | 'smile' | 'flame'
      | 'stretch' | 'pill' | 'utensils' | 'wind';
  /** Card tint — picks the icon-bg + accent. */
  tint: 'coral' | 'mint' | 'lavender' | 'peach' | 'brand';
  /** Estimated time in minutes. */
  duration_min: number;
  title_en: string;
  body_en: string;
  title_ar: string;
  body_ar: string;
  // Baby-only filters: age range in days. Inclusive on both ends. Omit
  // either end for open-ended.
  age_min_days?: number;
  age_max_days?: number;
  // Pregnancy-only: gestational week range, inclusive.
  week_min?: number;
  week_max?: number;
  // Cycle-only: phase, or undefined = applies to all phases.
  phase?: CyclePhase;
  // Cycle-only: restrict to specific cycle modes. Undefined = applies to
  // every mode. Used to surface PCOS-/postpartum-/athlete-specific tips
  // only to those users.
  modes?: CycleMode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BABY suggestions — categorised loosely by age. Aim for short, low-prep
// activities a tired parent can do with whatever's lying around.
// ─────────────────────────────────────────────────────────────────────────────
const BABY: Suggestion[] = [
  // 0–30 days (newborn)
  { id: 'b_tummy_time', stage: 'baby', icon: 'baby', tint: 'coral', duration_min: 3, age_min_days: 0, age_max_days: 60,
    title_en: 'Tummy time, 3 minutes',
    body_en: 'Lay baby on their tummy on a firm surface while you stay face-to-face. Builds neck strength.',
    title_ar: 'وقت البطن، ٣ دقائق',
    body_ar: 'ضعي الطفل على بطنه على سطح صلب وأنتِ أمامه. يقوي عضلات الرقبة.' },
  { id: 'b_skin_to_skin', stage: 'baby', icon: 'heart', tint: 'coral', duration_min: 15, age_min_days: 0, age_max_days: 90,
    title_en: 'Skin-to-skin cuddle',
    body_en: 'Hold baby chest-to-chest under your shirt for 15 minutes. Regulates heart rate and supports breastfeeding.',
    title_ar: 'حضن جلد لجلد',
    body_ar: 'احتضني الطفل صدر لصدر تحت قميصك لمدة ١٥ دقيقة. ينظم نبض القلب ويدعم الرضاعة.' },
  { id: 'b_sing_lullaby', stage: 'baby', icon: 'music', tint: 'lavender', duration_min: 5, age_min_days: 0, age_max_days: 365,
    title_en: 'Sing a lullaby',
    body_en: "Pick any song — yours, the radio, anything. Baby is learning your voice's rhythm.",
    title_ar: 'غني تهليلة',
    body_ar: 'أي أغنية. الطفل يتعلم إيقاع صوتك.' },
  { id: 'b_high_contrast', stage: 'baby', icon: 'sparkles', tint: 'brand', duration_min: 5, age_min_days: 0, age_max_days: 90,
    title_en: 'Show black-and-white patterns',
    body_en: 'At 0–3 months baby sees high contrast best. Hold a black-and-white card 20–30 cm from their face.',
    title_ar: 'اعرضي أنماطًا أبيض وأسود',
    body_ar: 'يرى الطفل التباين العالي أفضل في أول ٣ أشهر. أمسكي بطاقة أبيض وأسود على بُعد ٢٠-٣٠ سم من وجهه.' },
  { id: 'b_face_chat', stage: 'baby', icon: 'smile', tint: 'mint', duration_min: 5, age_min_days: 0, age_max_days: 180,
    title_en: 'Face-to-face chatting',
    body_en: "Hold baby 20–30 cm from your face and talk. Pause and they'll 'reply' with sounds.",
    title_ar: 'محادثة وجهًا لوجه',
    body_ar: 'أمسكي الطفل على بُعد ٢٠-٣٠ سم من وجهك وتحدثي معه. توقفي وسيرد بأصوات.' },

  // 30–90 days
  { id: 'b_gentle_massage', stage: 'baby', icon: 'heart', tint: 'peach', duration_min: 10, age_min_days: 14, age_max_days: 365,
    title_en: 'Gentle baby massage',
    body_en: 'A few drops of edible oil, warm hands. Long slow strokes from chest outward — calming before bath or bed.',
    title_ar: 'تدليك خفيف للطفل',
    body_ar: 'قطرات من زيت آمن ويدان دافئتان. حركات بطيئة من الصدر للأطراف — مهدئ قبل الحمام أو النوم.' },
  { id: 'b_rattle_track', stage: 'baby', icon: 'sparkles', tint: 'mint', duration_min: 5, age_min_days: 30, age_max_days: 180,
    title_en: 'Rattle tracking',
    body_en: 'Move a rattle slowly side-to-side 25 cm above baby. They learn to follow with their eyes.',
    title_ar: 'تتبع الخشخيشة',
    body_ar: 'حركي خشخيشة ببطء يمينًا ويسارًا فوق الطفل بـ ٢٥ سم. يتعلم متابعتها بعينيه.' },
  { id: 'b_mirror_play', stage: 'baby', icon: 'smile', tint: 'lavender', duration_min: 5, age_min_days: 60, age_max_days: 365,
    title_en: 'Mirror play',
    body_en: "Sit with baby in front of a mirror. Point at features ('that's your nose!'). Builds self-recognition.",
    title_ar: 'لعب أمام المرآة',
    body_ar: 'اجلسي مع الطفل أمام مرآة. أشيري للملامح ("ده أنفك!"). يدعم تمييز الذات.' },

  // 90–180 days
  { id: 'b_textures', stage: 'baby', icon: 'leaf', tint: 'mint', duration_min: 5, age_min_days: 90, age_max_days: 365,
    title_en: 'Texture exploration',
    body_en: 'Brush silk, wool, a soft sponge across baby\'s palm. Name each texture as you go.',
    title_ar: 'استكشاف الملمس',
    body_ar: 'مرري حرير وصوف وإسفنجة على راحة يد الطفل. سمي كل ملمس وأنتِ تفعلين ذلك.' },
  { id: 'b_peekaboo', stage: 'baby', icon: 'smile', tint: 'coral', duration_min: 5, age_min_days: 120, age_max_days: 730,
    title_en: 'Peek-a-boo',
    body_en: 'Cover your face, then reveal with a smile. Builds object permanence — and a lot of giggles.',
    title_ar: 'لعبة "بُو"',
    body_ar: 'غطي وجهك ثم أظهريه مع ابتسامة. يدعم فهم بقاء الأشياء — وضحكات كتيرة.' },
  { id: 'b_name_things', stage: 'baby', icon: 'book', tint: 'brand', duration_min: 10, age_min_days: 90, age_max_days: 730,
    title_en: 'Narrate your day',
    body_en: "Say what you see: 'I'm cutting an apple. It's red and crunchy.' Vocabulary exposure adds up.",
    title_ar: 'احكي يومك',
    body_ar: 'قولي اللي بتشوفيه: "بقطع تفاحة. حمرا وقرمشة." التعرض اللغوي يتراكم.' },

  // 180–365 days
  { id: 'b_stack_cups', stage: 'baby', icon: 'sparkles', tint: 'peach', duration_min: 10, age_min_days: 180, age_max_days: 730,
    title_en: 'Stack and topple cups',
    body_en: 'Plastic cups, paper cups, anything stackable. Baby loves the crash. Hand-eye coordination.',
    title_ar: 'كؤوس للتكويم والإطاحة',
    body_ar: 'كاسات بلاستيك أو ورق. الطفل بيحب صوت الوقوع. تنسيق يد-عين.' },
  { id: 'b_finger_food', stage: 'baby', icon: 'apple', tint: 'mint', duration_min: 15, age_min_days: 180, age_max_days: 730,
    title_en: 'Finger-food self-feeding',
    body_en: 'Soft banana, ripe avocado, well-cooked carrot strips. Let baby grab — pinch grip practice.',
    title_ar: 'إطعام ذاتي بالأصابع',
    body_ar: 'موز طري، أفوكادو ناضج، شرائح جزر مسلوقة. اتركي الطفل يمسك — تدريب على القبضة الدقيقة.' },
  { id: 'b_body_parts', stage: 'baby', icon: 'baby', tint: 'lavender', duration_min: 5, age_min_days: 240, age_max_days: 1095,
    title_en: 'Name body parts',
    body_en: '"Where\'s your nose? Where are your toes?" Touch each as you say it. Builds vocabulary + body awareness.',
    title_ar: 'سمي أعضاء الجسم',
    body_ar: '"فين أنفك؟ فين صوابعك؟" المسي كل جزء وأنتِ بتقولي. يدعم اللغة والوعي بالجسم.' },

  // 12+ months
  { id: 'b_water_play', stage: 'baby', icon: 'droplet', tint: 'brand', duration_min: 15, age_min_days: 365, age_max_days: 1460,
    title_en: 'Water-pour play',
    body_en: 'A big bowl, two cups, a few spoons. Pouring teaches volume + grip. Stay close — supervised always.',
    title_ar: 'لعب بصب الماء',
    body_ar: 'وعاء كبير وكاسين وملاعق. الصب بيعلم الحجم والقبضة. ابقي قريبة — دائمًا تحت إشراف.' },
  { id: 'b_dance_party', stage: 'baby', icon: 'music', tint: 'coral', duration_min: 10, age_min_days: 270, age_max_days: 1825,
    title_en: 'Mini dance party',
    body_en: 'Pick three songs. Dance, clap, sway, freeze. Gross motor + rhythm + pure joy.',
    title_ar: 'حفلة رقص صغيرة',
    body_ar: 'اختاري ٣ أغاني. ارقصوا، صفقوا، توقفوا. حركة كبرى + إيقاع + فرح خالص.' },
  { id: 'b_color_sort', stage: 'baby', icon: 'sparkles', tint: 'mint', duration_min: 10, age_min_days: 540, age_max_days: 1825,
    title_en: 'Sort by colour',
    body_en: 'Three bowls, mixed coloured blocks (or buttons, pom-poms). Sort one colour at a time.',
    title_ar: 'فرز حسب اللون',
    body_ar: '٣ سلطانيات ومكعبات بألوان مختلطة. فرز لون واحد كل مرة.' },
  { id: 'b_simple_story', stage: 'baby', icon: 'book', tint: 'lavender', duration_min: 10, age_min_days: 180, age_max_days: 1825,
    title_en: 'Read a short story',
    body_en: "Even a tired-of-it board book counts. Point at pictures, ask 'what's that?'. Reading at any age is a win.",
    title_ar: 'اقرئي قصة قصيرة',
    body_ar: 'حتى كتاب مكرر مفيد. أشيري للصور واسألي "ده إيه؟". القراءة في أي سن مكسب.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// PREGNANCY suggestions — by trimester. Daily-actionable wellness tips.
// ─────────────────────────────────────────────────────────────────────────────
const PREGNANCY: Suggestion[] = [
  // 1st trimester (weeks 1–13)
  { id: 'p_folic', stage: 'pregnancy', icon: 'pill', tint: 'mint', duration_min: 1, week_min: 1, week_max: 14,
    title_en: 'Folic acid, today',
    body_en: '400–800 mcg daily through the first trimester reduces neural tube defects. Same time each day helps you remember.',
    title_ar: 'حمض الفوليك اليوم',
    body_ar: '٤٠٠-٨٠٠ ميكروجرام يوميًا في الأشهر الثلاثة الأولى يقلل عيوب الأنبوب العصبي. وقت ثابت كل يوم يساعد على التذكر.' },
  { id: 'p_hydration', stage: 'pregnancy', icon: 'droplet', tint: 'brand', duration_min: 1, week_min: 1, week_max: 41,
    title_en: 'Drink 10 glasses of water',
    body_en: "Pregnancy needs ~2.3 L/day. Keep a bottle in sight; sip every time you check your phone.",
    title_ar: 'اشربي ١٠ أكواب ماء',
    body_ar: 'الحمل يحتاج ~٢.٣ لتر يوميًا. ابقِ زجاجة في مرأى عينك؛ ارشفي كل مرة تتفحصين الموبايل.' },
  { id: 'p_ginger', stage: 'pregnancy', icon: 'leaf', tint: 'peach', duration_min: 5, week_min: 4, week_max: 14,
    title_en: 'Ginger tea for nausea',
    body_en: 'A few slices of fresh ginger in hot water, optional honey. Sip slowly. Studies back ginger for first-trimester nausea.',
    title_ar: 'شاي زنجبيل للغثيان',
    body_ar: 'شرائح زنجبيل طازج في ماء ساخن، عسل اختياري. رشفات بطيئة. الزنجبيل مدعوم علميًا لغثيان الثلث الأول.' },
  { id: 'p_short_walk_t1', stage: 'pregnancy', icon: 'sun', tint: 'mint', duration_min: 15, week_min: 5, week_max: 14,
    title_en: 'Take a 15-minute walk',
    body_en: "Light walking eases fatigue and helps with bloating. Stop if you feel dizzy.",
    title_ar: 'مشية ١٥ دقيقة',
    body_ar: 'المشي الخفيف يقلل التعب والانتفاخ. توقفي لو حسيتي بدوخة.' },
  { id: 'p_rest_t1', stage: 'pregnancy', icon: 'moon', tint: 'lavender', duration_min: 30, week_min: 1, week_max: 14,
    title_en: 'Permission to nap',
    body_en: 'First-trimester fatigue is the placenta working overtime. A 20–30 min nap is medically smart, not lazy.',
    title_ar: 'مسموح تنامي القيلولة',
    body_ar: 'التعب في الثلث الأول لأن المشيمة شغالة بقوة. قيلولة ٢٠-٣٠ دقيقة قرار صحي، مش كسل.' },

  // 2nd trimester (weeks 14–27)
  { id: 'p_kegels', stage: 'pregnancy', icon: 'activity', tint: 'coral', duration_min: 5, week_min: 14, week_max: 41,
    title_en: 'Kegels, 3 sets of 10',
    body_en: "Squeeze the muscles you'd use to stop urine for 5 seconds, release. Helps with delivery and post-partum recovery.",
    title_ar: 'تمارين كيجل، ٣ مجموعات × ١٠',
    body_ar: 'اضغطي العضلات اللي بتمنع البول ٥ ثوانٍ ثم استرخي. يساعد على الولادة والتعافي بعدها.' },
  { id: 'p_prenatal_yoga', stage: 'pregnancy', icon: 'stretch', tint: 'lavender', duration_min: 20, week_min: 14, week_max: 38,
    title_en: '15-minute prenatal stretch',
    body_en: 'Cat-cow, butterfly stretch, pelvic tilts. Eases lower-back tightness and opens hips for delivery.',
    title_ar: 'تمدد للحامل ١٥ دقيقة',
    body_ar: 'القطة والبقرة، الفراشة، إمالة الحوض. يخفف شد أسفل الظهر ويفتح الورك للولادة.' },
  { id: 'p_hospital_research', stage: 'pregnancy', icon: 'book', tint: 'brand', duration_min: 20, week_min: 16, week_max: 28,
    title_en: 'Research your hospital choice',
    body_en: 'Visit, ask about delivery rooms, c-section rates, NICU, breastfeeding support. Pick before week 28 if you can.',
    title_ar: 'ابحثي عن المستشفى',
    body_ar: 'زوريها، اسألي عن غرف الولادة ومعدلات القيصرية والحضانة ودعم الرضاعة. اختاري قبل الأسبوع ٢٨ لو تقدري.' },
  { id: 'p_journal_kicks', stage: 'pregnancy', icon: 'sparkles', tint: 'coral', duration_min: 5, week_min: 18, week_max: 41,
    title_en: 'Journal a baby kick',
    body_en: "Note the time and what you were doing. Builds emotional bond and helps you notice patterns.",
    title_ar: 'دوّني ركلة الطفل',
    body_ar: 'سجلي الوقت وأنتِ بتعملي إيه. يقوي الرابطة العاطفية ويساعدك تلاحظي الأنماط.' },

  // 3rd trimester (weeks 28–40)
  { id: 'p_kick_count', stage: 'pregnancy', icon: 'activity', tint: 'mint', duration_min: 30, week_min: 28, week_max: 41,
    title_en: 'Daily kick count',
    body_en: '10 movements within 2 hours after a meal. Lie on your left side. Call the doctor if 10 takes longer than 2 h.',
    title_ar: 'عد الركلات اليومي',
    body_ar: '١٠ حركات خلال ساعتين بعد الأكل. استلقي على جانبك الأيسر. اتصلي بالدكتور لو الـ١٠ ركلات استغرقت أكتر من ساعتين.' },
  { id: 'p_hospital_bag', stage: 'pregnancy', icon: 'sparkles', tint: 'peach', duration_min: 30, week_min: 32, week_max: 40,
    title_en: 'Pack the hospital bag',
    body_en: 'For you: nightgown, slippers, phone charger, snacks. Baby: 2 outfits, hat, blanket, going-home outfit.',
    title_ar: 'حضري شنطة المستشفى',
    body_ar: 'لكِ: قميص نوم، شبشب، شاحن، سناك. الطفل: ٢ ملابس، طاقية، بطانية، لبس الخروج.' },
  { id: 'p_perineal', stage: 'pregnancy', icon: 'heart', tint: 'lavender', duration_min: 5, week_min: 34, week_max: 40,
    title_en: 'Perineal massage, 5 minutes',
    body_en: 'Daily from week 34 reduces tearing risk in vaginal delivery. Use sweet almond or olive oil.',
    title_ar: 'تدليك العجان، ٥ دقائق',
    body_ar: 'يوميًا من الأسبوع ٣٤ يقلل خطر التمزق في الولادة الطبيعية. استخدمي زيت لوز حلو أو زيتون.' },
  { id: 'p_side_sleep', stage: 'pregnancy', icon: 'moon', tint: 'brand', duration_min: 1, week_min: 28, week_max: 41,
    title_en: 'Sleep on your left side',
    body_en: "After week 28, side-sleeping (left preferred) protects placental blood flow. Pillow between knees helps.",
    title_ar: 'نامي على جنبك الأيسر',
    body_ar: 'بعد الأسبوع ٢٨، النوم على الجنب (الأيسر أفضل) يحمي تدفق الدم للمشيمة. مخدة بين الركبتين بتساعد.' },
  { id: 'p_freezer_meals', stage: 'pregnancy', icon: 'utensils', tint: 'mint', duration_min: 60, week_min: 34, week_max: 40,
    title_en: 'Cook 2 freezer meals',
    body_en: "First 6 weeks post-partum you'll be too tired to cook. Future-you is grateful.",
    title_ar: 'حضري وجبتين للفريزر',
    body_ar: 'أول ٦ أسابيع بعد الولادة هتكوني تعبانة جدًا للطبخ. هتشكري نفسك بعدين.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE suggestions — phase-aware self-care for menstrual / follicular /
// ovulatory / luteal. Untagged ones (no `phase`) apply to all phases.
// ─────────────────────────────────────────────────────────────────────────────
const CYCLE: Suggestion[] = [
  // Any phase
  { id: 'c_hydration', stage: 'cycle', icon: 'droplet', tint: 'brand', duration_min: 1,
    title_en: 'Drink 8 glasses of water',
    body_en: 'Hydration smooths cycle symptoms across every phase. Glass of water with each meal + between.',
    title_ar: 'اشربي ٨ أكواب ماء',
    body_ar: 'الترطيب بيخفف أعراض الدورة في كل المراحل. كاسة مع كل وجبة وبين الوجبات.' },
  { id: 'c_sleep', stage: 'cycle', icon: 'moon', tint: 'lavender', duration_min: 1,
    title_en: 'Aim for 7–9 hours sleep',
    body_en: 'Sleep regulates the hormones that run your cycle. Same wake time daily matters more than total hours.',
    title_ar: 'حاولي تنامي ٧-٩ ساعات',
    body_ar: 'النوم بينظم الهرمونات اللي بتدير دورتك. وقت استيقاظ ثابت أهم من العدد الإجمالي للساعات.' },
  { id: 'c_folic_pre', stage: 'cycle', icon: 'pill', tint: 'mint', duration_min: 1,
    title_en: 'Folic acid (if planning)',
    body_en: 'Start 400 mcg/day at least 3 months before conception. Catches the neural tube window before you know you\'re pregnant.',
    title_ar: 'حمض الفوليك (لو بتخططي)',
    body_ar: 'ابدئي ٤٠٠ ميكروجرام يوميًا قبل الحمل بـ٣ أشهر على الأقل. يحمي الأنبوب العصبي قبل ما تعرفي إنك حامل.' },
  { id: 'c_vit_d', stage: 'cycle', icon: 'sun', tint: 'peach', duration_min: 1,
    title_en: 'Vitamin D, daily',
    body_en: '1000–2000 IU per day for hormone health, mood, fertility. Most adults in MENA are deficient.',
    title_ar: 'فيتامين د يوميًا',
    body_ar: '١٠٠٠-٢٠٠٠ وحدة يوميًا لصحة الهرمونات والمزاج والخصوبة. أغلب البالغين في المنطقة عندهم نقص.' },
  { id: 'c_breath', stage: 'cycle', icon: 'wind', tint: 'lavender', duration_min: 5,
    title_en: '5 minutes of slow breathing',
    body_en: 'In for 4, hold 4, out for 6. Chronic stress raises cortisol which messes with cycle regularity.',
    title_ar: '٥ دقائق تنفس بطيء',
    body_ar: 'شهيق ٤، احبسي ٤، زفير ٦. الإجهاد المزمن يرفع الكورتيزول اللي يخل بانتظام الدورة.' },

  // Menstrual (days 1–5)
  { id: 'c_iron_food', stage: 'cycle', icon: 'apple', tint: 'coral', duration_min: 5, phase: 'menstrual',
    title_en: 'Eat an iron-rich meal',
    body_en: 'Beef, lentils, spinach, dates. Pair with vitamin C (lemon, orange) for absorption. Replenishes period blood loss.',
    title_ar: 'وجبة غنية بالحديد',
    body_ar: 'لحمة، عدس، سبانخ، تمر. مع فيتامين C (ليمون أو برتقال) للامتصاص. يعوض فقد دم الدورة.' },
  { id: 'c_heat_pad', stage: 'cycle', icon: 'flame', tint: 'coral', duration_min: 20, phase: 'menstrual',
    title_en: 'Heat pad on lower belly',
    body_en: '15–20 min of warmth eases cramps as well as ibuprofen in some studies. Hot water bottle works.',
    title_ar: 'كمادة دافئة على البطن',
    body_ar: '١٥-٢٠ دقيقة دفء تخفف التقلصات بقوة الإيبوبروفين في بعض الدراسات. زجاجة ماء سخن تكفي.' },
  { id: 'c_gentle_yoga', stage: 'cycle', icon: 'stretch', tint: 'lavender', duration_min: 15, phase: 'menstrual',
    title_en: 'Gentle period yoga',
    body_en: "Child's pose, supine twist, reclined butterfly. Avoid inversions. Eases cramps and lower-back ache.",
    title_ar: 'يوجا خفيفة في الدورة',
    body_ar: 'وضعية الطفل، اللف الجانبي، الفراشة المستلقية. تجنبي الوضعيات المقلوبة. يخفف التقلصات والظهر.' },
  { id: 'c_magnesium', stage: 'cycle', icon: 'pill', tint: 'mint', duration_min: 1, phase: 'menstrual',
    title_en: 'Magnesium for cramps',
    body_en: '300–400 mg in the evening. Reduces menstrual pain and helps sleep. Try magnesium glycinate for tummy comfort.',
    title_ar: 'ماغنسيوم للتقلصات',
    body_ar: '٣٠٠-٤٠٠ ملج مساءً. يقلل ألم الدورة ويساعد على النوم. جربي ماغنسيوم جلايسينات للراحة.' },

  // Follicular (days 6–13)
  { id: 'c_cardio', stage: 'cycle', icon: 'activity', tint: 'mint', duration_min: 30, phase: 'follicular',
    title_en: '30-min cardio',
    body_en: "Energy is climbing now. Brisk walk, run, or cycling. Estrogen makes you recover faster — push a little harder.",
    title_ar: 'كارديو ٣٠ دقيقة',
    body_ar: 'الطاقة بتزيد دلوقتي. مشي سريع، جري، أو دراجة. الإستروجين بيسرع التعافي — اضغطي شوية أكتر.' },
  { id: 'c_strength', stage: 'cycle', icon: 'activity', tint: 'brand', duration_min: 25, phase: 'follicular',
    title_en: 'Strength training day',
    body_en: 'Squats, push-ups, rows. The follicular phase is your peak window for muscle gain.',
    title_ar: 'يوم تدريب قوة',
    body_ar: 'سكوات، بوش-أب، تجديف. الطور الجريبي هو أفضل نافذة لبناء العضلات.' },
  { id: 'c_plan_week', stage: 'cycle', icon: 'sparkles', tint: 'peach', duration_min: 15, phase: 'follicular',
    title_en: 'Plan something new',
    body_en: 'Mood and creativity peak in the follicular phase. Write down one thing to start this week.',
    title_ar: 'خططي لشيء جديد',
    body_ar: 'المزاج والإبداع بيوصلوا للذروة في الطور الجريبي. اكتبي حاجة واحدة تبدئيها الأسبوع ده.' },

  // Ovulatory (days 14–16)
  { id: 'c_track_bbt', stage: 'cycle', icon: 'sparkles', tint: 'coral', duration_min: 1, phase: 'ovulatory',
    title_en: 'Note ovulation signs',
    body_en: "Egg-white cervical mucus, mild side-twinge, libido bump. Useful whether you're trying or avoiding pregnancy.",
    title_ar: 'دوّني علامات التبويض',
    body_ar: 'إفرازات شفافة، وخز جانبي خفيف، زيادة الرغبة. مفيد لو بتحاولي تحملي أو بتتفادي.' },
  { id: 'c_socialize', stage: 'cycle', icon: 'smile', tint: 'lavender', duration_min: 30, phase: 'ovulatory',
    title_en: 'Lean into a social plan',
    body_en: 'Energy, confidence, and verbal fluency peak around ovulation. Use it for that conversation you\'ve been putting off.',
    title_ar: 'استفيدي من النشاط الاجتماعي',
    body_ar: 'الطاقة والثقة والطلاقة اللفظية بيوصلوا الذروة حوالين التبويض. استغليها للمحادثة اللي بتأجليها.' },

  // Luteal (days 17+)
  { id: 'c_low_caffeine', stage: 'cycle', icon: 'apple', tint: 'peach', duration_min: 1, phase: 'luteal',
    title_en: 'Cut caffeine after noon',
    body_en: 'Progesterone disrupts sleep in the luteal phase. Less caffeine = less PMS irritability and better sleep.',
    title_ar: 'قللي الكافيين بعد الظهر',
    body_ar: 'البروجسترون بيعكر النوم في الطور الأصفر. كافيين أقل = توتر ما قبل الدورة أقل ونوم أفضل.' },
  { id: 'c_walk_luteal', stage: 'cycle', icon: 'sun', tint: 'mint', duration_min: 20, phase: 'luteal',
    title_en: '20-minute walk outside',
    body_en: 'Lighter movement matches lower energy. Sunlight + walking ease PMS mood symptoms more than gym sessions do.',
    title_ar: 'مشية ٢٠ دقيقة في الجو',
    body_ar: 'حركة أخف تناسب طاقة أقل. الشمس والمشي بيخففوا أعراض ما قبل الدورة أكتر من الجيم.' },
  { id: 'c_complex_carbs', stage: 'cycle', icon: 'utensils', tint: 'brand', duration_min: 5, phase: 'luteal',
    title_en: 'Complex-carb dinner',
    body_en: 'Sweet potato, brown rice, oats. Steady serotonin overnight = fewer PMS mood swings tomorrow.',
    title_ar: 'عشاء كربوهيدرات معقدة',
    body_ar: 'بطاطا، أرز بني، شوفان. سيروتونين ثابت بالليل = تقلب مزاج أقل بكرة.' },

  // ── Mode-specific suggestions (Wave 12) ─────────────────────────────
  // PCOS — insulin sensitivity, inositol, lower-glycemic eating.
  { id: 'c_pcos_inositol', stage: 'cycle', icon: 'pill', tint: 'mint', duration_min: 1, modes: ['pcos'],
    title_en: 'Myo-inositol, twice daily',
    body_en: '2 g morning + 2 g evening (with food) is the most-studied PCOS supplement — improves insulin sensitivity and ovulation regularity over 3 months.',
    title_ar: 'ميو-إينوزيتول مرتين يوميًا',
    body_ar: '٢ جرام صباحًا و٢ مساءً مع الطعام — أكثر مكمل مدروس لـ PCOS، يحسن حساسية الإنسولين وانتظام التبويض خلال ٣ أشهر.' },
  { id: 'c_pcos_low_gi', stage: 'cycle', icon: 'apple', tint: 'mint', duration_min: 5, modes: ['pcos'],
    title_en: 'Lower-glycemic plate',
    body_en: 'Half the plate non-starchy vegetables, quarter protein, quarter whole grains. Insulin spikes worsen PCOS symptoms — gentler glucose curves help.',
    title_ar: 'طبق منخفض الجلايسيمي',
    body_ar: 'نصف الطبق خضار غير نشوية، ربع بروتين، ربع حبوب كاملة. ارتفاع الإنسولين يزيد أعراض PCOS — منحنى جلوكوز أهدأ يساعد.' },
  { id: 'c_pcos_strength', stage: 'cycle', icon: 'activity', tint: 'brand', duration_min: 30, modes: ['pcos'],
    title_en: 'Strength training, 3×/week',
    body_en: 'Resistance training improves insulin sensitivity faster than cardio for PCOS. Squats, push-ups, rows — bodyweight is fine.',
    title_ar: 'تمارين قوة ٣ مرات أسبوعيًا',
    body_ar: 'تمارين المقاومة تحسن حساسية الإنسولين أسرع من الكارديو لـ PCOS. سكوات، بوش-أب، تجديف — وزن الجسم كافٍ.' },

  // Endometriosis — anti-inflammatory, omega-3, heat, gentle movement.
  { id: 'c_endo_omega3', stage: 'cycle', icon: 'pill', tint: 'lavender', duration_min: 1, modes: ['endometriosis'],
    title_en: 'Omega-3, 1–2 g daily',
    body_en: 'EPA + DHA reduce prostaglandin-driven pain in endometriosis. Take with a meal containing fat for absorption.',
    title_ar: 'أوميجا-٣ ١-٢ جرام يوميًا',
    body_ar: 'EPA + DHA يقللان الألم المرتبط بالبروستاجلاندين في الانتباذ البطاني. خذيها مع وجبة فيها دهون للامتصاص.' },
  { id: 'c_endo_anti_inflam', stage: 'cycle', icon: 'leaf', tint: 'lavender', duration_min: 5, modes: ['endometriosis'],
    title_en: 'Anti-inflammatory swap',
    body_en: 'Less red meat + processed sugar this week, more leafy greens, berries, fatty fish. The endo evidence here is real, not just folk wisdom.',
    title_ar: 'استبدال مضاد للالتهاب',
    body_ar: 'لحم أحمر وسكر معالج أقل هذا الأسبوع، خضار ورقي وتوت وسمك دهني أكثر. الأدلة على الانتباذ البطاني حقيقية وليست مجرد حكمة شعبية.' },
  { id: 'c_endo_pelvic_yoga', stage: 'cycle', icon: 'stretch', tint: 'lavender', duration_min: 15, modes: ['endometriosis'],
    title_en: 'Pelvic-release yoga, 15 min',
    body_en: "Happy baby, supported child's pose, supine twist. Eases pelvic-floor tension that worsens endo cramping.",
    title_ar: 'يوجا إرخاء الحوض ١٥ دقيقة',
    body_ar: 'وضعية الطفل السعيد، وضعية الطفل المدعومة، اللف المستلقي. تخفف توتر قاع الحوض الذي يزيد تقلصات الانتباذ.' },

  // Athlete — recovery awareness, fueling, iron, BBT/cycle-load matching.
  { id: 'c_athlete_recovery', stage: 'cycle', icon: 'moon', tint: 'mint', duration_min: 1, modes: ['athlete'], phase: 'luteal',
    title_en: 'Lower training intensity',
    body_en: 'Core temp is up ~0.3°C, perceived exertion higher, recovery slower. Drop one hard session this week and add 8h sleep.',
    title_ar: 'قللي شدة التدريب',
    body_ar: 'حرارة الجسم أعلى ~٠.٣°م، الإحساس بالمجهود أعلى، التعافي أبطأ. اسقطي جلسة شاقة هذا الأسبوع وأضيفي ٨ ساعات نوم.' },
  { id: 'c_athlete_iron', stage: 'cycle', icon: 'apple', tint: 'coral', duration_min: 5, modes: ['athlete'],
    title_en: 'Track iron status',
    body_en: 'Female athletes lose iron through both periods AND foot-strike hemolysis. Annual ferritin lab + iron-rich meals weekly = steady performance.',
    title_ar: 'راقبي مستوى الحديد',
    body_ar: 'الرياضيات يفقدن الحديد من الدورة + انحلال الدم بالجري. تحليل فيريتين سنوي + وجبات غنية بالحديد أسبوعيًا = أداء ثابت.' },
  { id: 'c_athlete_carbload', stage: 'cycle', icon: 'utensils', tint: 'brand', duration_min: 5, modes: ['athlete'], phase: 'follicular',
    title_en: 'Higher-carb training week',
    body_en: 'Estrogen rising = better carb utilization. Push the heavy lifts and intervals now; use the energy.',
    title_ar: 'أسبوع تدريب عالي الكربوهيدرات',
    body_ar: 'ارتفاع الإستروجين = استخدام أفضل للكربوهيدرات. ادفعي الأوزان الثقيلة والتدريب البيني الآن.' },

  // Postpartum — gentle return, pelvic floor, breastfeeding-aware.
  { id: 'c_pp_kegels', stage: 'cycle', icon: 'activity', tint: 'coral', duration_min: 5, modes: ['postpartum'],
    title_en: 'Kegels — 3 sets of 10',
    body_en: 'Daily pelvic-floor work for at least 6 months postpartum. Squeeze 5 sec, release 5 sec. Do during a feed for built-in routine.',
    title_ar: 'تمارين كيجل — ٣ مجموعات × ١٠',
    body_ar: 'تمارين قاع الحوض يوميًا لمدة ٦ أشهر على الأقل بعد الولادة. اضغطي ٥ ثوانٍ، استرخي ٥. مارسيها أثناء الرضاعة كروتين تلقائي.' },
  { id: 'c_pp_ferritin', stage: 'cycle', icon: 'pill', tint: 'mint', duration_min: 1, modes: ['postpartum'],
    title_en: 'Check ferritin at 6 weeks',
    body_en: 'Post-birth iron stores are often depleted. A quick ferritin lab catches deficiency before it tanks energy and milk supply.',
    title_ar: 'افحصي الفيريتين بعد ٦ أسابيع',
    body_ar: 'مخزون الحديد بعد الولادة يكون منخفضًا. تحليل فيريتين سريع يكتشف النقص قبل أن يضعف الطاقة وإدرار الحليب.' },
  { id: 'c_pp_first_period', stage: 'cycle', icon: 'sparkles', tint: 'lavender', duration_min: 5, modes: ['postpartum'],
    title_en: 'First period back?',
    body_en: 'Post-birth cycles often arrive heavier and irregular for 3–6 months — completely normal. Track flow and pain so you have a baseline if it doesn\'t settle.',
    title_ar: 'أول دورة بعد الولادة؟',
    body_ar: 'الدورات بعد الولادة غالبًا أغزر وغير منتظمة لـ ٣-٦ أشهر — طبيعي تمامًا. سجلي الغزارة والألم لتكون عندك مرجعية لو ما استقرت.' },

  // Irregular — gentler tone, no fertility predictions over-confidence.
  { id: 'c_irreg_journal', stage: 'cycle', icon: 'book', tint: 'peach', duration_min: 10, modes: ['irregular'],
    title_en: 'Add a quick journal note',
    body_en: 'Stress, travel, sleep changes, illness, weight changes — all shift cycles. Journaling these helps spot what affects yours.',
    title_ar: 'دوّني ملاحظة سريعة',
    body_ar: 'الإجهاد، السفر، تغيرات النوم، المرض، تغير الوزن — كلها تؤثر على الدورة. تدوين هذه يساعدك على معرفة ما يؤثر عليك.' },
];

const ALL: Suggestion[] = [...BABY, ...PREGNANCY, ...CYCLE];

// ─────────────────────────────────────────────────────────────────────────────
// Picker — pick 3 deterministic suggestions for a given profile, today.
// ─────────────────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  // FNV-1a 32-bit. Stable, fast, no deps.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** YYYY-MM-DD in caller's local time. Matches localDayKey from lib/dates
 *  but kept dependency-free for SSR. */
function todayKey(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compute current cycle phase from days since last period start. */
export function cyclePhaseFor(daysSincePeriodStart: number, cycleLength = 28): CyclePhase {
  if (daysSincePeriodStart <= 5) return 'menstrual';
  // Ovulation usually 14 days BEFORE next period. Window ±2 days.
  const ovulationDay = cycleLength - 14;
  if (daysSincePeriodStart < ovulationDay - 1) return 'follicular';
  if (daysSincePeriodStart <= ovulationDay + 1) return 'ovulatory';
  return 'luteal';
}

export interface PickContext {
  babyId: string;
  stage: SuggestionStage;
  /** For baby: age in days. For pregnancy: gestational week. For cycle: days
   *  since most-recent period start (or null when no cycles logged yet). */
  marker: number | null;
  /** Cycle phase, only used when stage='cycle'. */
  phase?: CyclePhase;
  /** Wave 12: cycle mode. When provided we surface mode-specific items
   *  (and still mix in the unrestricted ones). When null/'standard' we
   *  filter out mode-specific items so standard users don't see PCOS
   *  copy etc. */
  mode?: CycleMode | null;
}

/** Filter suggestions to those that match the profile's stage + marker. */
function eligible(ctx: PickContext): Suggestion[] {
  const pool = ALL.filter(s => s.stage === ctx.stage);
  if (ctx.stage === 'baby') {
    if (ctx.marker == null) return pool;
    return pool.filter(s =>
      (s.age_min_days == null || ctx.marker! >= s.age_min_days) &&
      (s.age_max_days == null || ctx.marker! <= s.age_max_days),
    );
  }
  if (ctx.stage === 'pregnancy') {
    if (ctx.marker == null) return pool;
    return pool.filter(s =>
      (s.week_min == null || ctx.marker! >= s.week_min) &&
      (s.week_max == null || ctx.marker! <= s.week_max),
    );
  }
  // cycle — filter by phase first, then mode.
  let filtered = ctx.phase
    ? pool.filter(s => s.phase == null || s.phase === ctx.phase)
    : pool.filter(s => s.phase == null);
  // Mode filter:
  //   - standard / null: drop anything tagged with a mode (PCOS-only,
  //     postpartum-only, athlete-only, etc.) so the average user doesn't
  //     get clinical copy that doesn't apply to them.
  //   - specific mode: keep untagged items + items tagged with this mode.
  const mode = ctx.mode ?? 'standard';
  if (mode === 'standard') {
    filtered = filtered.filter(s => !s.modes || s.modes.length === 0);
  } else {
    filtered = filtered.filter(s => !s.modes || s.modes.length === 0 || s.modes.includes(mode));
  }
  return filtered;
}

/** Deterministic 3-pick for today. Same trio all day; rotates at midnight. */
export function pickToday(ctx: PickContext, n = 3): Suggestion[] {
  const pool = eligible(ctx);
  if (pool.length === 0) return [];
  const seed = hashStr(`${todayKey()}::${ctx.babyId}::${ctx.stage}`);
  // Shuffle the eligible pool with a seeded Fisher-Yates, then take n.
  const arr = [...pool];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr.slice(0, Math.min(n, arr.length));
}

/** Today's localStorage key for completion tracking. */
export function doneKey(babyId: string, suggestionId: string): string {
  return `bx:done:${todayKey()}:${babyId}:${suggestionId}`;
}

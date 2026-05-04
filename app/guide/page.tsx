import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { loadUserPrefs } from '@/lib/user-prefs';
import { type Lang } from '@/lib/i18n';
import { Wordmark } from '@/components/Wordmark';
import { PrintGuideButton } from '@/components/PrintGuideButton';
import {
  Heart, Baby, Sparkles, Stethoscope, Bell, Droplet, Activity, Apple,
  MessagesSquare, FileText, Upload, Users, ShieldCheck, Moon, Pill,
  CalendarDays, AlertTriangle, BookOpen,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'User guide' };

export default async function UserGuide() {
  // Same language resolution as the landing page so the guide reads
  // naturally for whichever audience opens it.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const cookieLang = cookies().get('lang')?.value;
  const guestLang: Lang = cookieLang === 'ar' ? 'ar' : 'en';
  let lang: Lang = guestLang;
  if (user) {
    const prefs = await loadUserPrefs(supabase);
    lang = prefs.language;
  }
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const sections = isAr ? GUIDE_AR : GUIDE_EN;

  return (
    <div dir={dir} className="bg-white min-h-screen">
      {/* Print-only header — appears at the top of every printed page */}
      <div className="hidden print:block">
        <Wordmark size="md" />
        <hr className="mt-2 mb-4 border-slate-300" />
      </div>

      {/* Screen-only header */}
      <header className="print:hidden sticky top-0 z-30 backdrop-blur bg-white/85 border-b border-slate-200/60">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="shrink-0"><Wordmark size="md" /></Link>
          <div className="flex items-center gap-2">
            <PrintGuideButton lang={lang} />
            <Link href={user ? '/dashboard' : '/login'}
              className="text-sm rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-1.5">
              {user ? (isAr ? 'لوحة التحكم' : 'Dashboard') : (isAr ? 'دخول' : 'Sign in')}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8 py-10 print:py-0 print:max-w-none print-compact">
        <div className="text-center mb-8 print:text-start print:mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 text-mint-700 text-[11px] font-bold uppercase tracking-wider px-3 py-1 print:hidden">
            <BookOpen className="h-3 w-3" />
            {isAr ? 'دليل الاستخدام' : 'User guide'}
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl print:text-2xl font-bold text-ink-strong">
            {isAr ? 'كل ميزة في Babylytics — مشروحة' : 'Every Babylytics feature, explained'}
          </h1>
          <p className="mt-2 text-sm text-ink-muted max-w-2xl mx-auto print:text-xs">
            {isAr
              ? 'دليل مرجعي شامل بكل الميزات حسب المرحلة. اطبعيه أو احفظيه PDF بضغطة زر فوق.'
              : 'A reference covering every feature by life stage. Print to PDF with the button above for an offline copy.'}
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-8 rounded-2xl border border-slate-200 bg-slate-50/40 p-5 print:bg-white print:p-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">
            {isAr ? 'المحتويات' : 'Contents'}
          </h2>
          <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="text-ink-muted shrink-0 tabular-nums">{i + 1}.</span>
                <a href={`#${s.id}`} className="text-ink-strong hover:text-coral-700 print:text-ink-strong">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10 print:space-y-4">
          {sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <section key={s.id} id={s.id} className="scroll-mt-20">
                <div className="flex items-center gap-3 mb-4 print:mb-2">
                  <span className={`h-10 w-10 rounded-xl bg-${s.tint}-100 text-${s.tint}-700 grid place-items-center shrink-0 print:hidden`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-2xl print:text-lg font-bold text-ink-strong">
                    <span className="text-ink-muted me-2 tabular-nums">{i + 1}.</span>
                    {s.title}
                  </h2>
                </div>
                {s.intro && (
                  <p className="text-sm print:text-xs text-ink leading-relaxed mb-4 print:mb-2">{s.intro}</p>
                )}
                <div className="space-y-4 print:space-y-2">
                  {s.items.map((it, j) => (
                    <div key={j} className="rounded-xl border border-slate-200 bg-white p-4 print:p-2 print:border-slate-100">
                      <h3 className="text-sm print:text-xs font-bold text-ink-strong">{it.title}</h3>
                      <p className="mt-1 text-xs print:text-[11px] text-ink leading-relaxed">{it.body}</p>
                      {it.where && (
                        <p className="mt-2 text-[11px] print:text-[10px] text-ink-muted">
                          <strong className="text-ink">{isAr ? 'مكانه: ' : 'Where: '}</strong>{it.where}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <footer className="mt-12 print:mt-4 pt-6 print:pt-2 border-t border-slate-200 text-[11px] text-ink-muted text-center">
          {isAr
            ? 'هذا الدليل ليس استشارة طبية. كل التنبيهات الصحية في التطبيق تنتهي بـ«تحدثي مع طبيبكِ» — لسبب وجيه.'
            : 'This guide is not medical advice. Every health alert in the app ends with "talk to your doctor" — for good reason.'}
          <div className="mt-1">babylytics.org</div>
        </footer>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Guide content. Per-language hand-written copy keeps this honest +
// avoids translation drift. Adding a new section = add an object here.
// ─────────────────────────────────────────────────────────────────────────────
type Item = { title: string; body: string; where?: string };
type Section = { id: string; title: string; tint: string; icon: React.ComponentType<{ className?: string }>; intro?: string; items: Item[] };

const GUIDE_EN: Section[] = [
  {
    id: 'getting-started', title: 'Getting started', tint: 'brand', icon: BookOpen,
    intro: 'Babylytics handles three life stages on one platform: cycle (planning before pregnancy), pregnancy, and baby. You can run profiles for each separately and they transition smoothly when the time comes.',
    items: [
      { title: 'Create your first profile', body: 'From "My profiles", tap "Add profile" and pick the stage that fits — Cycle, Pregnancy, or Baby. Each stage shows a different sidebar tuned to what you actually need at that point.' },
      { title: 'Caregivers + roles', body: 'Invite a partner, doctor, nurse, or pharmacy by email. Each role sees a different slice of the data — partners see a curated summary (no raw symptom logs), doctors see the medical record, pharmacies see only medications.', where: 'Profile → Caregivers' },
      { title: 'Switching profiles', body: 'The profile picker at the top of the sidebar lets you jump between profiles instantly. The sidebar refreshes to show the right pages for the active profile\'s stage.' },
    ],
  },
  {
    id: 'cycle', title: 'Cycle (planning) features', tint: 'coral', icon: Heart,
    intro: 'For tracking your cycle, planning a pregnancy, or just understanding your body better.',
    items: [
      { title: 'Cycle calendar + prediction', body: 'Log periods, see fertile windows + predicted ovulation, track cycle length over time.', where: 'Cycle → Cycle calendar' },
      { title: 'Energy forecast + 25+ daily ideas', body: 'Reads your phase + cycle mode + Egyptian/MENA context, surfaces a "today\'s read" and a phase-tuned suggestion.' },
      { title: 'BBT + vital signs', body: 'Basal body temperature, BP, blood sugar — all useful for fertility + general health tracking. Auto-converts F → C and lb → kg on import.' },
      { title: 'Personal pattern engine', body: 'After a few cycles, spots patterns in your data and drafts ready-to-send questions for your OB-GYN.' },
      { title: 'Partner mode', body: 'Invite a partner with the "Partner" role — they see a curated summary (current phase, days to next period, how to support) without your symptom logs.' },
      { title: 'Ramadan + cultural awareness', body: 'During Ramadan, suggestions and nutrition tips shift to suhoor + iftar guidance.' },
    ],
  },
  {
    id: 'pregnancy', title: 'Pregnancy features', tint: 'lavender', icon: Sparkles,
    intro: 'Through the 40 weeks. Risk-aware, week-by-week guided.',
    items: [
      { title: 'Pregnancy dashboard', body: 'Gestational age, trimester, weight gain band (IOM-based), latest BP / glucose / fetal heart rate, week-by-week "baby is the size of…"' },
      { title: 'Risk-pattern detection (ACOG / ADA)', body: 'Reads your tracked BP / glucose / weight / kicks and surfaces signals when patterns match published thresholds — preeclampsia screening, gestational diabetes screening, sudden weight gain, low fetal movement. Screening, not diagnosis.', where: 'Pregnancy overview · top of page when active' },
      { title: 'Kick counter + maternal vitals', body: 'Tap-to-count fetal movements with the standard "10 in 2 hours" rule. BP / glucose / weight all log from one place.' },
      { title: 'Prenatal visits + ultrasound OCR', body: 'Upload a scan PDF or photo and Babylytics extracts gestational age, EFW, biometry, summary fields automatically.' },
      { title: 'Partner mode (pregnancy)', body: 'Curated view for your partner: gestational age, trimester, days to EDD, "how to support this trimester" copy. Never sees your symptom logs.' },
      { title: 'Pumping log (postpartum)', body: 'Appears once you\'ve marked the baby as born. Track sessions: side, volume, duration, location.' },
    ],
  },
  {
    id: 'baby', title: 'Baby features', tint: 'mint', icon: Baby,
    intro: 'Daily care + intelligence layer. Logging plus prediction.',
    items: [
      { title: 'Daily logs', body: 'Feedings (with food name + symptoms), stool, sleep sessions, temperature, vaccinations, medications, measurements — all in one place with the right form for each.' },
      { title: 'Tonight\'s outlook', body: 'When asleep: predicted next wake (median nap duration). When awake: optimal next-nap window using age-banded wake windows from Polly Moore + Weissbluth research.', where: 'Baby overview · top of page' },
      { title: 'Sleep regression detection', body: 'Flags ≥30% week-over-week drops in total sleep — catches the famous 4-month, 8-month, 12-month regressions.' },
      { title: 'Pattern alerts', body: 'Overtired pattern (short naps + frequent wakings → counter-intuitive earlier bedtime helps). Growth spurt (feed count up ≥30% week-over-week → feed on demand).' },
      { title: 'Risk signals (AAP / NICE)', body: 'Fever rules tuned to age — any fever under 3 months is treated as urgent per AAP/NICE. High fever, persistent fever, vomiting frequency, red-flag vomiting (projectile / bilious / blood) all flagged separately.' },
      { title: 'Pumping log', body: 'Sessions with side / volume / duration. Quick-log mode (full session) or Start now mode (open session you stop later).', where: 'Baby → Care → Pumping log' },
    ],
  },
  {
    id: 'ai', title: 'AI companion', tint: 'lavender', icon: Sparkles,
    intro: 'Available on every stage. Strict no-medical-advice rails.',
    items: [
      { title: 'Two modes: explain / draft', body: 'Explain a reading you logged (plain language + reference range + cite the guideline). Or draft a precise question for your next visit (cycle: OB-GYN, pregnancy: OB-GYN, baby: pediatrician).' },
      { title: 'Reads only your data', body: 'The AI sees only the structured snapshot the server sends — recent BP, glucose, weight, symptoms, etc. Never invents numbers. Never gives treatment recommendations.' },
      { title: '5 calls / day / user', body: 'Rate-limited across all stages combined to keep API costs predictable.' },
    ],
  },
  {
    id: 'mental-health', title: 'Mental health check-in (EPDS + PHQ-2)', tint: 'lavender', icon: Heart,
    intro: 'Self-screening at the right windows. Private to you only — partners and other caregivers never see results.',
    items: [
      { title: 'When prompts appear', body: '1st-trimester PHQ-2 baseline · 3rd-trimester EPDS at ~32 weeks · postpartum EPDS at 2 weeks / 6 weeks / 3 months / 6 months. Cools down 21 days after any submission.' },
      { title: 'Crisis path', body: 'If your score is high or item 10 (self-harm thoughts) is non-zero, the result panel surfaces Egypt-specific crisis resources (Mental Health Hotline 0800-2000-200, Ambulance 123, nearest emergency room) and recommends contacting your doctor that day.' },
      { title: 'Privacy', body: 'Three-layer enforcement: row-level security (only your screenings, even other caregivers can\'t see them), partner-deny restrictive policy, server-side validation on insert. Never shared.' },
    ],
  },
  {
    id: 'nutrition', title: 'Smart nutrition (Egyptian-tuned)', tint: 'mint', icon: Apple,
    intro: 'Stage-aware tips drawn from Egyptian / MENA cuisine. Not generic "eat healthy" — actual dishes with their nutritional rationale.',
    items: [
      { title: 'How tips are picked', body: 'Each tip carries stage scope (cycle / pregnancy / baby), trimester or age-band filter, addresses-tag (iron / folate / calcium / etc.), and Ramadan flags. Engine ranks by weight × random × Ramadan boost × lab-deficiency boost.' },
      { title: 'Lab-deficiency boost', body: 'When you upload labs that flag a low value (Hgb, Ferritin, Vit D, etc.), tips that address that nutrient up-rank with a "For your labs" badge.' },
      { title: 'During Ramadan', body: 'Suhoor + iftar tips boost. Tips that don\'t make sense during fasting hide.' },
    ],
  },
  {
    id: 'forum', title: 'Community forum', tint: 'brand', icon: MessagesSquare,
    intro: 'Talk to other women in the same stage — by name or anonymously per post.',
    items: [
      { title: 'Stage-categorised', body: 'Cycle (general / PCOS / TTC / postpartum return), pregnancy (each trimester + birth), baby (newborn / older / toddler / sleep / feeding), general open chat.' },
      { title: 'Anonymous handles', body: 'Per-post toggle. When anonymous, you appear as a deterministic pseudonym (e.g. "BraveOwl42") that\'s consistent across the whole forum.' },
      { title: 'Reactions, follow, search', body: 'React with ❤️ 🤗 ✋ 🙏. Follow a thread to get reply pings even if you didn\'t post in it. Full-text search works for both English and Arabic queries.' },
      { title: 'Notification modes', body: 'In Preferences: instant (one ping per reply), daily digest (one summary per day), or off.' },
      { title: 'Moderation', body: 'Report any post for spam, harassment, medical misinformation, or other reasons. Admins review and can soft-delete.' },
    ],
  },
  {
    id: 'imports', title: 'Imports + uploads', tint: 'coral', icon: Upload,
    intro: 'Bring history in from anywhere — whether it lives on your phone, in a spreadsheet, or as PDFs / scans.',
    items: [
      { title: 'Apple Health import', body: 'Drop your export.zip — Babylytics parses it locally in your browser and lets you choose categories: cycle history, weight, BBT, sleep, BP, glucose. Re-importing the same file is a no-op.', where: 'Profile → Records → Import' },
      { title: 'Bulk CSV import', body: 'Paste or upload CSV for any tabular category. Categories shown depend on the profile\'s stage.', where: 'Profile → Records → Bulk import' },
      { title: 'Bulk file upload', body: 'Drag up to 50 PDFs / scan images at once. Each file\'s kind is auto-guessed from the filename and overridable per-file.' },
      { title: 'OCR Smart Scan', body: 'Single-file flow that uploads + auto-extracts content from prescriptions, labs, ultrasounds, reports. Sets up structured data you can review and confirm.' },
    ],
  },
  {
    id: 'privacy', title: 'Privacy + data', tint: 'lavender', icon: ShieldCheck,
    intro: 'How your data is protected and what we don\'t do with it.',
    items: [
      { title: 'Data isolation', body: 'Postgres row-level security ensures every query is scoped to your account. Other users — even other caregivers on the same baby — only see what you explicitly grant.' },
      { title: 'Partner mode lockdown', body: 'When you give someone the partner role, sensitive tables (cycle logs, symptoms, BP, glucose, sleep, kick counts, ultrasound notes, mental health) are blocked at the database level — not just hidden in the UI.' },
      { title: 'No data selling', body: 'Babylytics does not sell or share your data with advertisers. AI calls go to Anthropic with no training opt-in.' },
      { title: 'Account deletion', body: 'Contact support to request full deletion. Cascade removes everything — babies, logs, photos, messages, forum posts.' },
    ],
  },
];

// Arabic version — hand-written, not auto-translated.
const GUIDE_AR: Section[] = [
  {
    id: 'getting-started', title: 'البداية', tint: 'brand', icon: BookOpen,
    intro: 'Babylytics يدعم ثلاث مراحل في منصة واحدة: الدورة (التخطيط قبل الحمل)، الحمل، والطفل. يمكنك إنشاء ملف لكل مرحلة، وينتقل الملف بسلاسة حين يحين وقت الانتقال.',
    items: [
      { title: 'إنشاء أول ملف', body: 'من «ملفاتي»، اضغطي «إضافة ملف» واختاري المرحلة — دورة، حمل، أو طفل. كل مرحلة تعرض شريطاً جانبياً مختلفاً يناسب احتياجاتها فعلياً.' },
      { title: 'الرعاة + الأدوار', body: 'ادعي شريك، طبيبة، ممرضة، أو صيدلية بالبريد الإلكتروني. كل دور يرى جزءاً مختلفاً من البيانات — الشركاء يرون ملخصاً، الأطباء يرون السجل الطبي، الصيدليات ترى الأدوية فقط.', where: 'الملف ← الرعاة' },
      { title: 'التبديل بين الملفات', body: 'منتقي الملف أعلى الشريط الجانبي يتيح القفز بين الملفات فوراً. الشريط يتحدث تلقائياً ليُظهر الصفحات المناسبة لمرحلة الملف النشط.' },
    ],
  },
  {
    id: 'cycle', title: 'ميزات الدورة (التخطيط)', tint: 'coral', icon: Heart,
    intro: 'لتتبع دورتك، التخطيط للحمل، أو فهم جسمك بشكل أفضل.',
    items: [
      { title: 'تقويم الدورة + التنبؤ', body: 'سجلي الدورات، شاهدي النوافذ الخصبة + التبويض المتوقع، تتبعي طول الدورة عبر الزمن.', where: 'الدورة ← تقويم الدورة' },
      { title: 'توقع الطاقة + ٢٥+ فكرة يومية', body: 'يقرأ مرحلتك + نمط دورتك + سياق الشرق الأوسط، ويعرض «قراءة اليوم» واقتراحاً مناسباً لمرحلتك.' },
      { title: 'BBT + المؤشرات الحيوية', body: 'حرارة الجسم القاعدية، الضغط، السكر — كلها مفيدة لتتبع الإخصاب والصحة العامة. يحوّل تلقائياً F → C و lb → kg عند الاستيراد.' },
      { title: 'محرك الأنماط الشخصي', body: 'بعد بضع دورات، يكتشف الأنماط في بياناتك ويصيغ أسئلة جاهزة لطبيبتك.' },
      { title: 'وضع الشريك', body: 'ادعي شريكك بدور «شريك» — يرى ملخصاً منسقاً (المرحلة الحالية، الأيام للدورة القادمة، كيف يدعم) بدون سجلات الأعراض.' },
      { title: 'وعي رمضان والثقافة', body: 'في رمضان، الاقتراحات ونصائح التغذية تتحول إلى إرشادات السحور والإفطار.' },
    ],
  },
  {
    id: 'pregnancy', title: 'ميزات الحمل', tint: 'lavender', icon: Sparkles,
    intro: 'عبر ٤٠ أسبوع. واعٍ بالمخاطر، مرشد أسبوعاً بأسبوع.',
    items: [
      { title: 'لوحة الحمل', body: 'عمر الحمل، الثلث، نطاق زيادة الوزن (مبني على IOM)، آخر ضغط / سكر / نبض الجنين، «الجنين بحجم …» أسبوعياً.' },
      { title: 'كشف أنماط المخاطر (ACOG / ADA)', body: 'يقرأ الضغط / السكر / الوزن / الحركات ويعرض إشارات عند مطابقة الأنماط للحدود المنشورة — فحص تسمم الحمل، فحص سكري الحمل، الزيادة المفاجئة، قلة الحركة. فحص لا تشخيص.', where: 'صفحة الحمل · أعلى الصفحة عند التفعيل' },
      { title: 'عداد الحركات + المؤشرات الحيوية للأم', body: 'اضغطي للعد بقاعدة «١٠ في ساعتين». الضغط / السكر / الوزن كلها من مكان واحد.' },
      { title: 'زيارات الحمل + قراءة السونار', body: 'ارفعي PDF أو صورة سونار، يستخرج Babylytics عمر الحمل، EFW، القياسات، الملخص تلقائياً.' },
      { title: 'وضع الشريك (الحمل)', body: 'عرض منسق لشريكك: عمر الحمل، الثلث، الأيام للموعد، نص «كيف يدعمك في هذا الثلث». لا يرى سجلات الأعراض.' },
      { title: 'سجل الشفط (ما بعد الولادة)', body: 'يظهر بعد تسجيل ميلاد الطفل. تتبعي الجلسات: الجانب، الكمية، المدة، المكان.' },
    ],
  },
  {
    id: 'baby', title: 'ميزات الطفل', tint: 'mint', icon: Baby,
    intro: 'الرعاية اليومية + طبقة الذكاء. تسجيل + تنبؤ.',
    items: [
      { title: 'السجلات اليومية', body: 'الرضعات (مع اسم الطعام والأعراض)، البراز، النوم، الحرارة، التطعيمات، الأدوية، القياسات — كلها في مكان واحد بنموذج مناسب لكل واحد.' },
      { title: 'توقعات الليلة', body: 'لما الطفل نائم: استيقاظ متوقع (متوسط مدة القيلولة). لما مستيقظ: أنسب وقت للقيلولة بناءً على فترات استيقاذ مناسبة لعمره من أبحاث Polly Moore و Weissbluth.', where: 'صفحة الطفل · أعلى الصفحة' },
      { title: 'كشف تراجع النوم', body: 'ينبه لانخفاض النوم ٣٠٪+ مقارنة بالأسبوع السابق — يكتشف تراجعات الـ ٤ شهور و٨ شهور و١٢ شهر المعروفة.' },
      { title: 'تنبيهات الأنماط', body: 'نمط الإجهاد الزائد (قيلولات قصيرة + استيقاذ متكرر — الحل المفاجئ تقديم وقت النوم). طفرة نمو (عدد الرضعات زاد ٣٠٪+ — أرضعي على الطلب).' },
      { title: 'إشارات المخاطر (AAP / NICE)', body: 'قواعد حرارة حسب العمر — أي حرارة تحت ٣ شهور تعتبر عاجلة. حرارة مرتفعة، حرارة مستمرة، تكرار القيء، قيء تحذيري (قذفي / مائل للأخضر / فيه دم) — كلها منفصلة.' },
      { title: 'سجل شفط الحليب', body: 'جلسات بالجانب / الكمية / المدة. وضع تسجيل سريع (جلسة كاملة) أو وضع «ابدأ الآن» (تُغلقها لاحقاً).', where: 'الطفل ← الرعاية ← سجل الشفط' },
    ],
  },
  {
    id: 'ai', title: 'المساعد الذكي', tint: 'lavender', icon: Sparkles,
    intro: 'متاح في كل مرحلة. قواعد صارمة لعدم تقديم نصائح طبية.',
    items: [
      { title: 'وضعان: شرح / صياغة', body: 'اشرحي قراءة سجلتيها (لغة بسيطة + النطاق المرجعي + ذكر المرجع). أو صيغي سؤالاً دقيقاً لزيارتكِ القادمة (دورة وحمل: طبيبة النساء، طفل: طبيب الأطفال).' },
      { title: 'يقرأ بياناتك فقط', body: 'الذكاء الاصطناعي يرى فقط اللقطة المنظمة التي يرسلها الخادم — آخر ضغط، سكر، وزن، أعراض. لا يخترع أرقاماً. لا يعطي نصيحة علاجية.' },
      { title: '٥ استدعاءات / يوم / مستخدم', body: 'محدود لكل مرحلة لإبقاء التكلفة متوقعة.' },
    ],
  },
  {
    id: 'mental-health', title: 'فحص الصحة النفسية (EPDS + PHQ-2)', tint: 'lavender', icon: Heart,
    intro: 'فحص ذاتي في الأوقات المناسبة. خاصة بكِ فقط — الشركاء والرعاة الآخرون لا يرون النتائج.',
    items: [
      { title: 'متى تظهر الإشعارات', body: 'PHQ-2 أساسي في الثلث الأول · EPDS في الثلث الأخير حوالي الأسبوع ٣٢ · EPDS بعد الولادة بأسبوعين / ٦ أسابيع / ٣ شهور / ٦ شهور. تهدأ ٢١ يوماً بعد أي إرسال.' },
      { title: 'مسار الأزمات', body: 'إذا كانت النتيجة مرتفعة أو السؤال ١٠ (أفكار إيذاء النفس) غير صفر، تظهر موارد أزمات مصرية (الخط الساخن للصحة النفسية ٠٨٠٠-٢٠٠٠-٢٠٠، الإسعاف ١٢٣، أقرب طوارئ) ونوصي بالتواصل مع طبيبتكِ في نفس اليوم.' },
      { title: 'الخصوصية', body: 'تطبيق ثلاثي الطبقات: أمان على مستوى الصف (فحوصاتك فقط — حتى الرعاة الآخرون لا يرونها)، سياسة منع الشريك، تحقق من جانب الخادم عند الإدراج. لا تُشارك أبداً.' },
    ],
  },
  {
    id: 'nutrition', title: 'تغذية ذكية (تناسب المطبخ المصري)', tint: 'mint', icon: Apple,
    intro: 'نصائح تناسب مرحلتك من المطبخ المصري / الشرق أوسطي. ليست «كلي صحياً» عامة — أطباق فعلية مع منطقها الغذائي.',
    items: [
      { title: 'كيف تُختار النصائح', body: 'كل نصيحة لها نطاق المرحلة (دورة / حمل / طفل)، فلتر الثلث أو نطاق العمر، وسم العنصر (حديد / فولات / كالسيوم / إلخ)، وإشارات رمضان. المحرك يرتب بـ الوزن × عشوائي × تعزيز رمضان × تعزيز نقص التحاليل.' },
      { title: 'تعزيز نقص التحاليل', body: 'لما ترفعين تحاليل تظهر فيها قيمة منخفضة (Hgb، فيريتين، فيتامين د، إلخ)، النصائح المعالجة لهذا العنصر ترتفع مع شارة «لتحاليلكِ».' },
      { title: 'في رمضان', body: 'نصائح السحور والإفطار ترتفع. النصائح غير المناسبة أثناء الصيام تختفي.' },
    ],
  },
  {
    id: 'forum', title: 'منتدى المجتمع', tint: 'brand', icon: MessagesSquare,
    intro: 'تحدثي مع نساء في نفس مرحلتك — باسمكِ أو باسم مستعار لكل مشاركة.',
    items: [
      { title: 'مصنف بالمراحل', body: 'دورة (عام / PCOS / محاولة الحمل / ما بعد الولادة)، حمل (كل ثلث + الولادة)، طفل (مولود / أكبر / دارج / نوم / تغذية)، دردشة عامة.' },
      { title: 'أسماء مستعارة', body: 'اختياري لكل مشاركة. عند اختيار الإخفاء، تظهرين باسم مستعار ثابت (مثل «BraveOwl42») يبقى نفسه عبر المنتدى كله.' },
      { title: 'تفاعلات، متابعة، بحث', body: 'تفاعلي بـ ❤️ 🤗 ✋ 🙏. تابعي موضوعاً لتصلكِ إشعارات الردود حتى لو لم تكتبي فيه. البحث الكامل بالعربي والإنجليزي.' },
      { title: 'أوضاع الإشعارات', body: 'في الإعدادات: فوري (إشعار لكل رد)، ملخص يومي (واحد فقط في اليوم)، أو إيقاف.' },
      { title: 'الإدارة', body: 'بلّغي عن أي مشاركة لأسباب: سبام، تحرش، معلومات طبية مغلوطة، أو غيرها. الإدارة تراجع وتستطيع الحذف.' },
    ],
  },
  {
    id: 'imports', title: 'الاستيراد + الرفع', tint: 'coral', icon: Upload,
    intro: 'أحضري تاريخك من أي مكان — سواء على هاتفك، في جدول، أو ملفات PDF / صور.',
    items: [
      { title: 'استيراد Apple Health', body: 'ارفعي export.zip — يحلله Babylytics محلياً في متصفحكِ ويتيح اختيار الفئات: الدورة، الوزن، BBT، النوم، الضغط، السكر. إعادة الاستيراد آمنة بدون تكرار.', where: 'الملف ← السجلات ← استيراد' },
      { title: 'استيراد جماعي بصيغة CSV', body: 'الصقي أو ارفعي CSV لأي فئة جدولية. الفئات المعروضة تعتمد على مرحلة الملف.', where: 'الملف ← السجلات ← استيراد جماعي' },
      { title: 'رفع ملفات بالجملة', body: 'اسحبي حتى ٥٠ PDF / صورة سونار دفعة واحدة. نوع كل ملف يُخمَّن من الاسم وقابل للتعديل.' },
      { title: 'Smart Scan بـ OCR', body: 'مسار ملف واحد يرفع + يستخرج المحتوى من الروشتات، التحاليل، السونار، التقارير. يعد بيانات منظمة لمراجعتها وتأكيدها.' },
    ],
  },
  {
    id: 'privacy', title: 'الخصوصية + البيانات', tint: 'lavender', icon: ShieldCheck,
    intro: 'كيف تُحمى بياناتك وما لا نفعله بها.',
    items: [
      { title: 'عزل البيانات', body: 'أمان على مستوى الصف في Postgres يضمن أن كل استعلام محدود بحسابك. المستخدمون الآخرون — حتى الرعاة الآخرون على نفس الطفل — يرون فقط ما تمنحينه صراحةً.' },
      { title: 'إغلاق وضع الشريك', body: 'لما تعطين شخصاً دور الشريك، الجداول الحساسة (سجلات الدورة، الأعراض، الضغط، السكر، النوم، الحركات، ملاحظات السونار، الصحة النفسية) محظورة على مستوى قاعدة البيانات — ليس فقط مخفية في الواجهة.' },
      { title: 'لا بيع للبيانات', body: 'Babylytics لا يبيع أو يشارك بياناتك مع المعلنين. استدعاءات الذكاء الاصطناعي تذهب لـ Anthropic بدون موافقة على التدريب.' },
      { title: 'حذف الحساب', body: 'تواصلي مع الدعم لطلب حذف كامل. الحذف المتسلسل يزيل كل شيء — الأطفال، السجلات، الصور، الرسائل، مشاركات المنتدى.' },
    ],
  },
];

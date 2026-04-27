import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/Wordmark';
import { HeroOrbit } from '@/components/HeroOrbit';
import { LanguageToggle } from '@/components/LanguageToggle';
import {
  Milk, Moon, Baby, Check, ArrowRight, Brain, Sparkles, Apple, Smartphone,
  LayoutDashboard, Heart, Activity, Pill, Syringe, Stethoscope, Thermometer,
  Ruler, ScanLine, FileText, BarChart3, Shield, BookOpen,
  CalendarDays, AlertTriangle, MessageCircle, Tv, Smile, FlaskConical,
  Languages, Bell, ClipboardList, ShieldCheck, Megaphone, Droplet,
  HeartPulse, MessagesSquare, ChevronRight,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = !!user;

  return (
    <div className="bg-gradient-to-b from-white to-brand-50 min-h-screen">
      {/* ======= Header ======= */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/75 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/"><Wordmark size="md" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-ink">
            <a href="#features"   className="hover:text-ink-strong">Features</a>
            <a href="#pregnancy"  className="hover:text-ink-strong">Pregnancy</a>
            <a href="#family"     className="hover:text-ink-strong">Family</a>
            <a href="#smart-scan" className="hover:text-ink-strong">Smart Scan</a>
            <Link href="/updates" className="hover:text-ink-strong inline-flex items-center gap-1">
              <Megaphone className="h-3.5 w-3.5 text-mint-600" /> What&apos;s new
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {isAuthed ? (
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 rounded-md bg-coral-500 px-4 py-2 text-sm font-medium text-white hover:bg-coral-600 shadow-sm">
                <LayoutDashboard className="h-4 w-4" /> Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/login"    className="hidden sm:inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Log in</Link>
                <Link href="/register" className="inline-flex items-center rounded-md bg-coral-500 px-4 py-2 text-sm font-medium text-white hover:bg-coral-600 shadow-sm">Get started free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ======= Hero ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-12 lg:pt-16 pb-10 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 text-mint-700 text-[11px] font-bold uppercase tracking-wider px-3 py-1">
            <Sparkles className="h-3 w-3" /> From the first kick to first words
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="text-coral-500">Track today.</span><br />
            <span className="text-mint-600">Nurture tomorrow.</span>
          </h1>
          <p className="mt-5 text-lg text-ink max-w-xl">
            One app for the entire journey — pregnancy, newborn, infant, toddler.
            Feedings, sleep, meds, pregnancy weight gain, kick counts, maternal
            symptoms, growth charts, vaccinations, and a portable medical record
            you can share with any clinician. Bilingual English &amp; Arabic.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-5 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-ink hover:bg-slate-50">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              See everything you can track
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Pill2 tint="coral"    icon={Languages}>EN · العربية · RTL</Pill2>
            <Pill2 tint="mint"     icon={Shield}>Per-baby roles &amp; audit trail</Pill2>
            <Pill2 tint="lavender" icon={ScanLine}>Smart Scan OCR</Pill2>
            <Pill2 tint="peach"    icon={Bell}>WhatsApp dose reminders</Pill2>
          </div>
        </div>

        <div className="relative"><HeroOrbit /></div>
      </section>

      {/* ======= Lifecycle stages ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-10">
        <div className="text-center mb-8">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">Built for the whole journey</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            One app, four stages, no swapping.
          </h2>
          <p className="mt-2 text-sm text-ink max-w-2xl mx-auto">
            Babylytics adapts as your baby grows. Start tracking pregnancy, hit
            &ldquo;Mark as born&rdquo; the moment they arrive, and the dashboard
            transforms into a newborn / infant / toddler view — without losing
            any of the history.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StageCard tint="lavender" Icon={Heart}    eyebrow="Stage 1" title="Pregnancy"
            text="Kick counts, maternal vitals, weight gain bands (IOM), prenatal visits, ultrasounds with EFW, daily fetal size, what-to-expect rollups, maternal symptoms (nausea, swelling, contractions…)." />
          <StageCard tint="coral"    Icon={Baby}     eyebrow="Stage 2" title="Newborn"
            text="Feedings (breast/bottle/mixed) with ml-per-kg targets, diaper logs, sleep, temperature, measurements, vaccinations, paediatrician visits, and your medical profile." />
          <StageCard tint="mint"     Icon={Activity} eyebrow="Stage 3" title="Infant"
            text="Growth charts vs WHO percentiles, milestone reference (rolling, sitting, crawling, walking), feed pace KPIs, weekly insight cards, and timeline of every event." />
          <StageCard tint="peach"    Icon={Smile}    eyebrow="Stage 4" title="Toddler"
            text="Teething, speaking milestones, screen-time, activities, allergies (with cow's-milk allergy guide), labs &amp; scans archive, shareable PDF reports." />
        </div>
      </section>

      {/* ======= Feature deep dive ======= */}
      <section id="features" className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">What you can track</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            Every detail, organised so it&apos;s easy to find.
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Vital signs */}
          <CategoryCard tint="coral" title="Vital signs" Icon={HeartPulse}>
            <FeatureChip Icon={Milk}        title="Feedings"      sub="Breast, bottle, formula, mixed, solid. Daily ml-per-kg targets. Rolling 7-day pace." />
            <FeatureChip Icon={Droplet}     title="Stool"         sub="Size, color, consistency, diaper rash flag. Daily breakdown chart." />
            <FeatureChip Icon={Moon}        title="Sleep"         sub="Live timer or manual entry. Location + quality. Weekly hours line." />
            <FeatureChip Icon={Thermometer} title="Temperature"   sub="Axillary, oral, ear, forehead, rectal. Fever alerts at ≥ 38°C." />
            <FeatureChip Icon={Ruler}       title="Measurements"  sub="Weight, height, head circumference. WHO percentile charts." />
          </CategoryCard>

          {/* Care */}
          <CategoryCard tint="lavender" title="Care &amp; medical" Icon={Stethoscope}>
            <FeatureChip Icon={Pill}         title="Medications"   sub="Schedules, doses, missed/skipped/taken, overdue alerts, OCR-imported prescriptions." />
            <FeatureChip Icon={Syringe}      title="Vaccinations"  sub="Plan + history, dose number, batch, provider, overdue chips." />
            <FeatureChip Icon={AlertTriangle} title="Allergies"    sub="11 quick-pick templates incl. a full cow's-milk allergy (CMPA) guide for parents." />
            <FeatureChip Icon={FlaskConical} title="Labs &amp; Scans" sub="Lab panels with per-marker results. Ultrasounds with biometry &amp; EFW." />
            <FeatureChip Icon={Stethoscope}  title="Doctors"       sub="Multi-doctor list, primary tag, contact info, appointments per doctor." />
            <FeatureChip Icon={CalendarDays} title="Appointments"  sub="Schedule, reminders, post-visit conclusion, attached uploads." />
          </CategoryCard>

          {/* Pregnancy */}
          <CategoryCard tint="mint" title="Pregnancy mode" Icon={Heart}>
            <FeatureChip Icon={Heart}        title="Daily fetal size"        sub="What baby looks like today — interpolated cm + grams + fruit emoji." />
            <FeatureChip Icon={ScanLine}     title="Ultrasounds"             sub="BPD, HC, AC, FL, EFW, FHR, anomaly notes. Auto-fill from scan PDFs via OCR." />
            <FeatureChip Icon={Activity}     title="Kick counter"            sub="Live session timer + tally, ≥10-in-2-hours guidance after 28 weeks." />
            <FeatureChip Icon={HeartPulse}   title="Maternal symptoms"       sub="Nausea, vomiting, dizziness, headache, swelling, contractions on a 1–5 scale." />
            <FeatureChip Icon={Heart}        title="Maternal vitals + IOM band" sub="BP, weight, FHR. Pre-preg BMI → recommended weight-gain range with on-track chip." />
            <FeatureChip Icon={BookOpen}     title="What-to-expect rollups"  sub="This week, this month, this trimester — for mom, baby, and your to-do list." />
          </CategoryCard>

          {/* Development */}
          <CategoryCard tint="peach" title="Development &amp; growth" Icon={Activity}>
            <FeatureChip Icon={Smile}        title="Teething"      sub="Eruption + symptom logs by tooth, with a visual chart." />
            <FeatureChip Icon={MessageCircle} title="Speaking"     sub="First words, sentences, language milestones." />
            <FeatureChip Icon={Tv}           title="Screen time"   sub="Daily exposure with AAP-band reminders." />
            <FeatureChip Icon={Activity}     title="Activities"    sub="Tummy time, swimming, music, outdoor, mood + intensity." />
            <FeatureChip Icon={BarChart3}    title="Growth charts" sub="WHO percentile lines for weight / height / head, with growth-spurt heads-up." />
            <FeatureChip Icon={ClipboardList} title="Milestones reference" sub="Crawling, sitting, walking, words — typical age windows + your baby's progress dot." />
          </CategoryCard>
        </div>
      </section>

      {/* ======= Pregnancy spotlight ======= */}
      <section id="pregnancy" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-lavender-700 uppercase">Pregnancy mode</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            A pregnancy companion that doesn&apos;t end at delivery.
          </h2>
          <p className="mt-3 text-ink max-w-lg">
            Track from the moment you have a positive test. When baby arrives,
            your whole pregnancy timeline becomes a shareable archive in their
            medical profile — every prenatal visit, every ultrasound, every
            symptom logged.
          </p>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="mint">IOM weight-gain bands by pre-pregnancy BMI</Bullet>
            <Bullet tint="lavender">Daily fetal size — what your baby is roughly the size of today</Bullet>
            <Bullet tint="coral">Ultrasound EFW overlaid on the daily-size card so you can see how on-track baby is</Bullet>
            <Bullet tint="peach">Symptom tracker (nausea, dizziness, contractions, mood swings…) with severity 1–5</Bullet>
            <Bullet tint="brand">What-to-expect cards rolled up at week, month, and trimester scale</Bullet>
            <Bullet tint="mint">Mark-as-born flow that keeps your pregnancy archive intact</Bullet>
          </ul>
        </div>

        {/* Pregnancy mockup */}
        <div className="rounded-3xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5 shadow-card">
          <div className="rounded-2xl border border-coral-200 bg-white/80 p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="text-5xl leading-none">🥭</div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-coral-700">Today, baby is the size of</div>
                <div className="text-xl font-bold text-ink-strong">a mango</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-mint-50 text-mint-700 border border-mint-200 px-2 py-0.5 font-semibold">15.3 cm</span>
                  <span className="rounded-full bg-coral-50 text-coral-700 border border-coral-200 px-2 py-0.5 font-semibold">≈ 240 g</span>
                  <span className="rounded-full bg-slate-50 text-ink-muted border border-slate-200 px-2 py-0.5">19w 2d</span>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-3">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mint-700">Weight gain · normal BMI</div>
              <div className="text-[10px] text-ink-muted">IOM 11.5–16 kg</div>
            </div>
            <div className="mt-2 text-2xl font-bold text-ink-strong">+5.2 kg</div>
            <div className="relative h-2 rounded-full bg-slate-100 mt-2">
              <div className="absolute inset-y-0 bg-mint-200" style={{ left: '20%', width: '50%' }} />
              <div className="absolute inset-y-0 bg-mint-400" style={{ left: '28%', width: '14%' }} />
              <div className="absolute -top-0.5 h-3 w-1 rounded-full bg-coral-600 shadow-sm" style={{ left: '34%' }} />
            </div>
            <div className="text-[10px] text-mint-700 font-semibold mt-2">✓ On track</div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="h-3 w-3 text-lavender-600" />
              <div className="font-semibold text-ink-strong">Recent symptoms</div>
              <span className="ml-auto text-[10px] text-lavender-700 bg-lavender-50 rounded-full px-1.5">Last 7d · 4</span>
            </div>
            <div className="space-y-1.5">
              <SympLine emoji="🤢" label="Nausea"    sev={3} />
              <SympLine emoji="😵‍💫" label="Dizziness" sev={2} />
              <SympLine emoji="🦶" label="Swelling"  sev={2} />
            </div>
          </div>
        </div>
      </section>

      {/* ======= Family & roles ======= */}
      <section id="family" className="bg-gradient-to-r from-mint-50 via-white to-brand-50 border-y border-slate-200/70 py-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">Family &amp; clinicians</div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
              Everyone who cares for your baby, on the same page.
            </h2>
            <p className="mt-3 text-ink max-w-lg">
              Babylytics is built for households, not just one parent. Invite
              the other parent, a grandparent, a nanny, or your paediatrician
              — each with their own role and only the access they need.
            </p>
            <ul className="mt-5 space-y-3 text-ink">
              <Bullet tint="mint">Five roles: parent, editor, doctor, nurse, viewer — fine-grained per baby</Bullet>
              <Bullet tint="lavender">Per-record audit trail — see &ldquo;Logged by Sarah · 2h ago&rdquo; and &ldquo;Edited by Ahmed&rdquo;</Bullet>
              <Bullet tint="coral">Comments threads scoped to a date or a specific log — leave notes for the next caregiver</Bullet>
              <Bullet tint="peach">Personal notification feed — broadcasts (e.g. &ldquo;Smart Scan needs review&rdquo;) read independently per user</Bullet>
              <Bullet tint="brand">Doctor view: read-only with an &ldquo;Add comment&rdquo; box — perfect for sharing during a visit</Bullet>
            </ul>
          </div>
          <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">Today&apos;s caregiver feed</div>
            <ul className="divide-y divide-slate-100">
              <CaregiverRow tint="coral"    name="Sarah"  role="parent" what="logged a feeding" detail="180 ml · bottle · 2 hours ago" />
              <CaregiverRow tint="lavender" name="Ahmed"  role="parent" what="logged a temperature" detail="37.2 °C · axillary · 1 hour ago" />
              <CaregiverRow tint="mint"     name="Mona"   role="nanny"  what="logged a sleep session" detail="1 h 45 m · crib · 30 min ago" />
              <CaregiverRow tint="peach"    name="Dr. K." role="doctor" what="commented on the appointment" detail="&ldquo;Continue probiotics for one more week.&rdquo; · just now" />
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 border border-mint-200 p-2.5 text-xs text-mint-900">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-700 shrink-0" />
              <span>Every change is captured in the audit log — including who, when, and what changed.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======= Smart Scan (OCR) ======= */}
      <section id="smart-scan" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">Smart Scan · OCR</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            From handwritten notes &amp; PDFs to structured data.
          </h2>
          <p className="mt-3 text-ink max-w-lg">
            Photograph a daily-log notebook page, an ultrasound report, or a
            lab printout. Babylytics extracts the events, items, and values —
            you review and confirm before anything lands in your tracker.
            Nothing is auto-applied.
          </p>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="coral">Daily notes — feedings, stools, sleep, temperature, meds</Bullet>
            <Bullet tint="brand">Ultrasound reports — auto-fills BPD / HC / AC / FL / EFW / FHR</Bullet>
            <Bullet tint="mint">Lab panels — extracts each marker with units</Bullet>
            <Bullet tint="lavender">Prescriptions — creates active medication entries</Bullet>
            <Bullet tint="peach">Confidence flag — low-confidence extractions surface in your inbox for review</Bullet>
          </ul>
          <div className="mt-7">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-4 py-2.5 text-white text-sm font-medium hover:bg-coral-600 shadow-sm">
              Try Smart Scan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <OcrBeforeAfter />
      </section>

      {/* ======= Reports + bilingual + WhatsApp ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <SmallSpotlight tint="brand" Icon={FileText} title="Shareable reports"
            body="Daily report and full report — one tap to save as PDF or image, ready to send your paediatrician. The full report inlines comments, audit trail, and KPIs for any time window." />
          <SmallSpotlight tint="lavender" Icon={Languages} title="English + العربية + RTL"
            body="Switch language any time — even before you sign up. Right-to-left layouts auto-flip. Full Arabic copy across forms, dashboards, reports, and the cow's-milk allergy guide." />
          <SmallSpotlight tint="mint" Icon={MessagesSquare} title="WhatsApp dose reminders"
            body="Active medications can ping caregivers on WhatsApp when a dose is due — handy when you and the other parent split responsibilities." />
        </div>
      </section>

      {/* ======= How it works (kept, tightened) ======= */}
      <section id="how" className="max-w-6xl mx-auto px-4 lg:px-8 pt-4 pb-16">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">How it works</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">Three steps to a clearer picture.</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-8 relative">
          <svg className="hidden md:block absolute top-10 left-[16%] right-[16%] h-6 pointer-events-none" viewBox="0 0 400 24" preserveAspectRatio="none">
            <path d="M0,12 C80,-8 120,32 200,12 C280,-8 320,32 400,12" stroke="#C2D9EE" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
          </svg>
          <Step n={1} tint="brand" Icon={ClipboardList} title="Log it"
            text="Type it in seconds, snap a handwritten page, or import an ultrasound PDF — every input goes through Smart Scan when relevant." />
          <Step n={2} tint="mint"  Icon={Brain} title="See the patterns"
            text="The dashboard auto-aggregates feedings, sleep, growth, and pregnancy KPIs — no spreadsheets, no manual math." />
          <Step n={3} tint="coral" Icon={BarChart3} title="Share with your team"
            text="Caregivers stay in sync via comments &amp; audit trail. Save a PDF for the paediatrician in one tap." />
        </div>
      </section>

      {/* ======= What's new strip ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-16">
        <Link href="/updates"
          className="block group rounded-2xl border border-mint-200 bg-gradient-to-r from-mint-50 via-white to-coral-50 p-5 hover:shadow-card transition">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="h-10 w-10 rounded-xl bg-mint-100 text-mint-700 grid place-items-center shrink-0">
              <Megaphone className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-[240px]">
              <div className="text-[11px] font-bold uppercase tracking-wider text-mint-700">Recently shipped</div>
              <div className="text-sm font-bold text-ink-strong">
                Daily fetal-size card · Maternal symptoms tracker · Audit trail by name · Cow&apos;s-milk allergy guide
              </div>
              <div className="text-xs text-ink-muted mt-0.5">See the full changelog and turn on notifications for new updates.</div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-mint-700 group-hover:gap-2 transition-all">
              What&apos;s new <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </section>

      {/* ======= CTA ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-24">
        <div className="rounded-3xl bg-gradient-to-r from-coral-50 via-peach-50 to-mint-50 border border-slate-200 p-10 text-center relative overflow-hidden">
          <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-coral-100 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-mint-100 blur-2xl" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
              Start tracking your baby&apos;s journey today.
            </h2>
            <p className="mt-2 text-sm text-ink">It&apos;s free, easy and made with love.</p>
            <div className="mt-6 flex items-center justify-center flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-6 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
                Create free account
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-ink hover:bg-slate-50">
                Log in
              </Link>
            </div>
            <p className="mt-2 text-xs text-ink-muted">No credit card required.</p>

            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <StoreBadge platform="apple" />
              <StoreBadge platform="google" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= Footer ======= */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <Wordmark size="sm" />
            <p className="mt-3 text-ink-muted">Track today. Nurture tomorrow.</p>
          </div>
          <FooterCol title="Product">
            <a href="#features">Features</a>
            <a href="#pregnancy">Pregnancy mode</a>
            <a href="#smart-scan">Smart Scan</a>
            <a href="#family">Family &amp; roles</a>
            <Link href="/updates">What&apos;s new</Link>
            <Link href="/register">Sign up</Link>
          </FooterCol>
          <FooterCol title="Company">
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </FooterCol>
          <FooterCol title="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/disclaimer">Medical disclaimer</Link>
          </FooterCol>
        </div>
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-8 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} Babylytics. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

// ---- Sub-components -------------------------------------------------------

type Tint = 'brand'|'mint'|'coral'|'lavender'|'peach';

function Pill2({ tint, icon: Icon, children }: {
  tint: Tint;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const css = {
    coral:    'bg-coral-100 text-coral-700',
    mint:     'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    peach:    'bg-peach-100 text-peach-700',
    brand:    'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${css}`}>
      <Icon className="h-3 w-3" /> {children}
    </span>
  );
}

function StageCard({ tint, Icon, eyebrow, title, text }: {
  tint: Tint;
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string; title: string; text: string;
}) {
  const eye = {
    coral: 'text-coral-700', mint: 'text-mint-700', lavender: 'text-lavender-700',
    peach: 'text-peach-700', brand: 'text-brand-700',
  }[tint];
  const grad = {
    coral:    'from-coral-50 to-white',
    mint:     'from-mint-50 to-white',
    lavender: 'from-lavender-50 to-white',
    peach:    'from-peach-50 to-white',
    brand:    'from-brand-50 to-white',
  }[tint];
  const iconBg = {
    coral: 'bg-coral-100 text-coral-600', mint: 'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600', peach: 'bg-peach-100 text-peach-600',
    brand: 'bg-brand-100 text-brand-600',
  }[tint];
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-gradient-to-br ${grad} p-5 shadow-card`}>
      <div className={`h-10 w-10 rounded-xl grid place-items-center ${iconBg}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${eye}`}>{eyebrow}</div>
      <h3 className="mt-1 text-xl font-bold text-ink-strong">{title}</h3>
      <p className="mt-2 text-sm text-ink leading-relaxed">{text}</p>
    </div>
  );
}

function CategoryCard({ tint, title, Icon, children }: {
  tint: Tint;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const tintCss = {
    coral: 'bg-coral-100 text-coral-600', mint: 'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600', peach: 'bg-peach-100 text-peach-600',
    brand: 'bg-brand-100 text-brand-600',
  }[tint];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <span className={`h-9 w-9 rounded-xl grid place-items-center ${tintCss}`}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-lg font-bold text-ink-strong" dangerouslySetInnerHTML={{ __html: title }} />
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function FeatureChip({ Icon, title, sub }: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string; sub: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 transition">
      <span className="h-8 w-8 rounded-lg bg-slate-100 text-ink grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-strong">{title}</div>
        <div className="text-xs text-ink-muted leading-relaxed" dangerouslySetInnerHTML={{ __html: sub }} />
      </div>
    </div>
  );
}

function SympLine({ emoji, label, sev }: { emoji: string; label: string; sev: number }) {
  const sevCss = sev >= 4 ? 'bg-coral-100 text-coral-700'
               : sev === 3 ? 'bg-peach-100 text-peach-700'
               : 'bg-mint-100 text-mint-700';
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <span className="flex-1 font-medium text-ink-strong">{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${sevCss}`}>{sev}/5</span>
    </div>
  );
}

function CaregiverRow({ tint, name, role, what, detail }: {
  tint: Tint;
  name: string; role: string; what: string; detail: string;
}) {
  const css = {
    coral: 'bg-coral-100 text-coral-700', mint: 'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700', peach: 'bg-peach-100 text-peach-700',
    brand: 'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <li className="flex items-start gap-3 py-3 px-1">
      <span className={`h-9 w-9 rounded-full grid place-items-center font-bold text-sm shrink-0 ${css}`}>
        {name[0]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-semibold text-ink-strong">{name}</span>
          <span className="text-ink-muted"> · {role}</span>
          <span className="text-ink"> {what}</span>
        </div>
        <div className="text-xs text-ink-muted truncate">{detail}</div>
      </div>
    </li>
  );
}

function SmallSpotlight({ tint, Icon, title, body }: {
  tint: Tint;
  Icon: React.ComponentType<{ className?: string }>;
  title: string; body: string;
}) {
  const css = {
    coral: 'bg-coral-100 text-coral-700', mint: 'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700', peach: 'bg-peach-100 text-peach-700',
    brand: 'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <span className={`h-10 w-10 rounded-xl grid place-items-center ${css}`}>
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-base font-bold text-ink-strong">{title}</h3>
      <p className="mt-1 text-sm text-ink leading-relaxed">{body}</p>
    </div>
  );
}

function Bullet({ tint, children }: { tint: Tint; children: React.ReactNode }) {
  const bg = {
    brand: 'bg-brand-100 text-brand-700',
    mint:  'bg-mint-100 text-mint-700',
    coral: 'bg-coral-100 text-coral-700',
    peach: 'bg-peach-100 text-peach-700',
    lavender: 'bg-lavender-100 text-lavender-700',
  }[tint];
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 h-6 w-6 rounded-full grid place-items-center shrink-0 ${bg}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function Step({ n, tint, Icon, title, text }: {
  n:number; tint: Tint;
  Icon:React.ComponentType<{ className?: string }>;
  title:string; text:string;
}) {
  const ring = {
    brand:'bg-brand-100 text-brand-700',
    mint: 'bg-mint-100 text-mint-700',
    coral:'bg-coral-100 text-coral-700',
    peach:'bg-peach-100 text-peach-700',
    lavender:'bg-lavender-100 text-lavender-700',
  }[tint];
  const badge = {
    brand:'bg-brand-500', mint:'bg-mint-500', coral:'bg-coral-500', peach:'bg-peach-500', lavender:'bg-lavender-500',
  }[tint];
  return (
    <div className="relative text-center">
      <div className={`mx-auto h-20 w-20 rounded-full grid place-items-center ring-4 ring-white shadow-card ${ring}`}>
        <Icon className="h-8 w-8" />
      </div>
      <span className={`absolute top-0 left-1/2 translate-x-6 -translate-y-1 h-6 w-6 rounded-full text-white text-xs font-bold grid place-items-center ${badge}`}>{n}</span>
      <h4 className="mt-3 font-semibold text-ink-strong">{title}</h4>
      <p className="mt-1 text-sm text-ink max-w-xs mx-auto">{text}</p>
    </div>
  );
}

function FooterCol({ title, children }: { title:string; children:React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</div>
      <div className="mt-3 space-y-2 flex flex-col [&>*]:text-ink [&>*]:hover:text-ink-strong">{children}</div>
    </div>
  );
}

function OcrBeforeAfter() {
  return (
    <div className="grid sm:grid-cols-[1fr_auto_1fr] items-center gap-4">
      {/* Before */}
      <div className="rounded-2xl bg-beige/50 border border-peach-200 p-5 font-mono text-sm text-ink shadow-card relative">
        <span className="absolute -top-2 left-4 text-[10px] uppercase tracking-wider rounded-full bg-peach-500 text-white px-2 py-0.5">Before</span>
        <div className="pt-2 space-y-1 leading-6">
          <div>May 14</div>
          <div>8am — BF 15min each side</div>
          <div>10am — 120ml formula</div>
          <div>1pm — Nap 1.5hr</div>
          <div>3pm — Dirty diaper</div>
          <div>6pm — 100ml formula</div>
          <div>9pm — BF 10min each side</div>
        </div>
      </div>

      <ArrowRight className="mx-auto h-6 w-6 text-brand-500 rotate-90 sm:rotate-0" />

      {/* After */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-card relative">
        <span className="absolute -top-2 right-4 text-[10px] uppercase tracking-wider rounded-full bg-mint-600 text-white px-2 py-0.5">After · detected</span>
        <div className="pt-2 text-sm">
          <div className="font-semibold text-ink-strong mb-2">May 14, 2024</div>
          <div className="divide-y divide-slate-100">
            <OcrRow time="08:00" Icon={Milk} tint="coral"    title="Breastfeeding" sub="15 min each side" />
            <OcrRow time="10:00" Icon={Milk} tint="peach"    title="Bottle feeding" sub="120 ml" />
            <OcrRow time="13:00" Icon={Moon} tint="lavender" title="Nap"           sub="1 h 30m" />
            <OcrRow time="15:00" Icon={Baby} tint="mint"     title="Diaper"        sub="Dirty" />
            <OcrRow time="18:00" Icon={Milk} tint="peach"    title="Bottle feeding" sub="100 ml" />
            <OcrRow time="21:00" Icon={Milk} tint="coral"    title="Breastfeeding" sub="10 min each side" />
          </div>
          <button className="mt-3 w-full rounded-md bg-mint-500 text-white text-sm font-medium py-2 hover:bg-mint-600">
            Review &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
}

function OcrRow({ time, Icon, tint, title, sub }: {
  time:string;
  Icon:React.ComponentType<{ className?: string }>;
  tint:'coral'|'peach'|'mint'|'lavender';
  title:string; sub:string;
}) {
  const bg = {
    coral: 'bg-coral-100 text-coral-700',
    peach: 'bg-peach-100 text-peach-700',
    mint:  'bg-mint-100 text-mint-700',
    lavender: 'bg-lavender-100 text-lavender-700',
  }[tint];
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`h-6 w-6 rounded-full grid place-items-center ${bg}`}><Icon className="h-3 w-3" /></span>
      <span className="font-medium text-ink-strong">{time}</span>
      <span className="flex-1">{title}</span>
      <span className="text-xs text-ink-muted">{sub}</span>
    </div>
  );
}

function StoreBadge({ platform }: { platform: 'apple'|'google' }) {
  const Icon = platform === 'apple' ? Apple : Smartphone;
  const top = platform === 'apple' ? 'Download on the' : 'GET IT ON';
  const bottom = platform === 'apple' ? 'App Store' : 'Google Play';
  return (
    <a href="#" className="inline-flex items-center gap-3 rounded-lg bg-ink-strong text-white px-4 py-2.5 hover:bg-black">
      <Icon className="h-6 w-6" />
      <span className="text-left leading-tight">
        <span className="block text-[10px] uppercase tracking-wider opacity-80">{top}</span>
        <span className="block text-sm font-semibold">{bottom}</span>
      </span>
    </a>
  );
}

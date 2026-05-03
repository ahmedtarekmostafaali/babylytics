import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { Wordmark } from '@/components/Wordmark';
import { HeroOrbit } from '@/components/HeroOrbit';
import { LanguageToggle } from '@/components/LanguageToggle';
import { tFor, type Lang, type TFunc, isRtl } from '@/lib/i18n';
import { loadUserPrefs } from '@/lib/user-prefs';
import {
  Milk, Moon, Baby, Check, ArrowRight, Brain, Sparkles, Apple, Smartphone,
  LayoutDashboard, Heart, Activity, Pill, Syringe, Stethoscope, Thermometer,
  Ruler, ScanLine, FileText, BarChart3, Shield, BookOpen,
  CalendarDays, AlertTriangle, MessageCircle, Tv, Smile, FlaskConical,
  Languages, Bell, ClipboardList, ShieldCheck, Megaphone, Droplet,
  HeartPulse, MessagesSquare, ChevronRight, Mic,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = !!user;

  // Pick the language: signed-in users honour their saved preference;
  // visitors get whatever the client-side LanguageToggle has cookied
  // (defaults to English).
  const cookieLang = cookies().get('lang')?.value;
  const guestLang: Lang = cookieLang === 'ar' ? 'ar' : 'en';
  let lang: Lang = guestLang;
  if (isAuthed) {
    const prefs = await loadUserPrefs(supabase);
    lang = prefs.language;
  }
  const t = tFor(lang);
  const rtl = isRtl(lang);

  return (
    <div className="bg-gradient-to-b from-white to-brand-50 min-h-screen" dir={rtl ? 'rtl' : 'ltr'}>
      {/* ======= Header ======= */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/75 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/"><Wordmark size="md" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-ink">
            <a href="#features"   className="hover:text-ink-strong">{t('landing.nav_features')}</a>
            <a href="#pregnancy"  className="hover:text-ink-strong">{t('landing.nav_pregnancy')}</a>
            <a href="#family"     className="hover:text-ink-strong">{t('landing.nav_family')}</a>
            <a href="#smart-scan" className="hover:text-ink-strong">{t('landing.nav_smart_scan')}</a>
            <Link href="/updates" className="hover:text-ink-strong inline-flex items-center gap-1">
              <Megaphone className="h-3.5 w-3.5 text-mint-600" /> {t('landing.nav_whats_new')}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            {isAuthed ? (
              <Link href="/dashboard"
                className="inline-flex items-center gap-2 rounded-md bg-coral-500 px-4 py-2 text-sm font-medium text-white hover:bg-coral-600 shadow-sm">
                <LayoutDashboard className="h-4 w-4" /> {t('landing.cta_open_dash')}
              </Link>
            ) : (
              <>
                <Link href="/login"    className="hidden sm:inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">{t('landing.cta_login')}</Link>
                <Link href="/register" className="inline-flex items-center rounded-md bg-coral-500 px-4 py-2 text-sm font-medium text-white hover:bg-coral-600 shadow-sm">{t('landing.cta_get_started')}</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ======= Hero ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-12 lg:pt-16 pb-10 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 text-mint-700 text-[11px] font-bold uppercase tracking-wider px-3 py-1">
            <Sparkles className="h-3 w-3" /> {t('landing.hero_eyebrow')}
          </div>
          <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="text-coral-500">{t('landing.hero_h1_l1')}</span><br />
            <span className="text-mint-600">{t('landing.hero_h1_l2')}</span>
          </h1>
          <p className="mt-5 text-lg text-ink max-w-xl">{t('landing.hero_sub')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-5 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
              {t('landing.hero_cta_start')} <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-ink hover:bg-slate-50">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              {t('landing.hero_cta_see')}
            </a>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            <Pill2 tint="coral"    icon={Languages}>{t('landing.pill_bilingual')}</Pill2>
            <Pill2 tint="mint"     icon={Shield}>{t('landing.pill_roles')}</Pill2>
            <Pill2 tint="lavender" icon={ScanLine}>{t('landing.pill_ocr')}</Pill2>
            <Pill2 tint="brand"    icon={Mic}>{t('landing.pill_voice')}</Pill2>
            <Pill2 tint="peach"    icon={Bell}>{t('landing.pill_whatsapp')}</Pill2>
          </div>
        </div>

        <div className="relative"><HeroOrbit /></div>
      </section>

      {/* ======= Lifecycle stages ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pb-10">
        <div className="text-center mb-8">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">{t('landing.stages_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.stages_h2')}</h2>
          <p className="mt-2 text-sm text-ink max-w-2xl mx-auto">{t('landing.stages_p')}</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StageCard tint="lavender" Icon={Heart}    eyebrow={t('landing.stage1_eb')} title={t('landing.stage1_t')} text={t('landing.stage1_x')} />
          <StageCard tint="coral"    Icon={Baby}     eyebrow={t('landing.stage2_eb')} title={t('landing.stage2_t')} text={t('landing.stage2_x')} />
          <StageCard tint="mint"     Icon={Activity} eyebrow={t('landing.stage3_eb')} title={t('landing.stage3_t')} text={t('landing.stage3_x')} />
          <StageCard tint="peach"    Icon={Smile}    eyebrow={t('landing.stage4_eb')} title={t('landing.stage4_t')} text={t('landing.stage4_x')} />
        </div>
      </section>

      {/* ======= Feature deep dive ======= */}
      <section id="features" className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">{t('landing.feat_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.feat_h2')}</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <CategoryCard tint="coral" title={t('landing.cat_vital_t')} Icon={HeartPulse}>
            <FeatureChip Icon={Milk}        title={t('landing.feat_feed_t')}  sub={t('landing.feat_feed_x')} />
            <FeatureChip Icon={Droplet}     title={t('landing.feat_stool_t')} sub={t('landing.feat_stool_x')} />
            <FeatureChip Icon={Moon}        title={t('landing.feat_sleep_t')} sub={t('landing.feat_sleep_x')} />
            <FeatureChip Icon={Thermometer} title={t('landing.feat_temp_t')}  sub={t('landing.feat_temp_x')} />
            <FeatureChip Icon={Activity}    title={t('landing.feat_vitals_t')}  sub={t('landing.feat_vitals_x')} />
            <FeatureChip Icon={Droplet}     title={t('landing.feat_glucose_t')} sub={t('landing.feat_glucose_x')} />
            <FeatureChip Icon={Ruler}       title={t('landing.feat_meas_t')}  sub={t('landing.feat_meas_x')} />
          </CategoryCard>

          <CategoryCard tint="lavender" title={t('landing.cat_care_t')} Icon={Stethoscope}>
            <FeatureChip Icon={Pill}          title={t('landing.feat_meds_t')} sub={t('landing.feat_meds_x')} />
            <FeatureChip Icon={Syringe}       title={t('landing.feat_vax_t')}  sub={t('landing.feat_vax_x')} />
            <FeatureChip Icon={AlertTriangle} title={t('landing.feat_alle_t')} sub={t('landing.feat_alle_x')} />
            <FeatureChip Icon={FlaskConical}  title={t('landing.feat_labs_t')} sub={t('landing.feat_labs_x')} />
            <FeatureChip Icon={Stethoscope}   title={t('landing.feat_docs_t')} sub={t('landing.feat_docs_x')} />
            <FeatureChip Icon={CalendarDays}  title={t('landing.feat_appt_t')} sub={t('landing.feat_appt_x')} />
          </CategoryCard>

          <CategoryCard tint="mint" title={t('landing.cat_preg_t')} Icon={Heart}>
            <FeatureChip Icon={Heart}      title={t('landing.feat_size_t')} sub={t('landing.feat_size_x')} />
            <FeatureChip Icon={ScanLine}   title={t('landing.feat_us_t')}   sub={t('landing.feat_us_x')} />
            <FeatureChip Icon={Activity}   title={t('landing.feat_kick_t')} sub={t('landing.feat_kick_x')} />
            <FeatureChip Icon={HeartPulse} title={t('landing.feat_msym_t')} sub={t('landing.feat_msym_x')} />
            <FeatureChip Icon={Heart}      title={t('landing.feat_iom_t')}  sub={t('landing.feat_iom_x')} />
            <FeatureChip Icon={BookOpen}   title={t('landing.feat_xpt_t')}  sub={t('landing.feat_xpt_x')} />
          </CategoryCard>

          <CategoryCard tint="peach" title={t('landing.cat_dev_t')} Icon={Activity}>
            <FeatureChip Icon={Smile}         title={t('landing.feat_teeth_t')}  sub={t('landing.feat_teeth_x')} />
            <FeatureChip Icon={MessageCircle} title={t('landing.feat_speak_t')}  sub={t('landing.feat_speak_x')} />
            <FeatureChip Icon={Tv}            title={t('landing.feat_screen_t')} sub={t('landing.feat_screen_x')} />
            <FeatureChip Icon={Activity}      title={t('landing.feat_act_t')}    sub={t('landing.feat_act_x')} />
            <FeatureChip Icon={BarChart3}     title={t('landing.feat_growth_t')} sub={t('landing.feat_growth_x')} />
            <FeatureChip Icon={ClipboardList} title={t('landing.feat_miles_t')}  sub={t('landing.feat_miles_x')} />
          </CategoryCard>
        </div>
      </section>

      {/* ======= Pregnancy spotlight ======= */}
      <section id="pregnancy" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-lavender-700 uppercase">{t('landing.spotlight_preg_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.spotlight_preg_h2')}</h2>
          <p className="mt-3 text-ink max-w-lg">{t('landing.spotlight_preg_p')}</p>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="mint">{t('landing.spotlight_preg_b1')}</Bullet>
            <Bullet tint="lavender">{t('landing.spotlight_preg_b2')}</Bullet>
            <Bullet tint="coral">{t('landing.spotlight_preg_b3')}</Bullet>
            <Bullet tint="peach">{t('landing.spotlight_preg_b4')}</Bullet>
            <Bullet tint="brand">{t('landing.spotlight_preg_b5')}</Bullet>
            <Bullet tint="mint">{t('landing.spotlight_preg_b6')}</Bullet>
          </ul>
        </div>

        <div className="rounded-3xl border border-lavender-200 bg-gradient-to-br from-lavender-50 via-white to-coral-50 p-5 shadow-card">
          <div className="rounded-2xl border border-coral-200 bg-white/80 p-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="text-5xl leading-none">🥭</div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-coral-700">{t('landing.mock_today')}</div>
                <div className="text-xl font-bold text-ink-strong">{t('landing.mock_mango')}</div>
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-mint-700">{t('landing.mock_gain_eyebrow')}</div>
              <div className="text-[10px] text-ink-muted">{t('landing.mock_gain_iom')}</div>
            </div>
            <div className="mt-2 text-2xl font-bold text-ink-strong">+5.2 kg</div>
            <div className="relative h-2 rounded-full bg-slate-100 mt-2">
              <div className="absolute inset-y-0 bg-mint-200" style={{ left: '20%', width: '50%' }} />
              <div className="absolute inset-y-0 bg-mint-400" style={{ left: '28%', width: '14%' }} />
              <div className="absolute -top-0.5 h-3 w-1 rounded-full bg-coral-600 shadow-sm" style={{ left: '34%' }} />
            </div>
            <div className="text-[10px] text-mint-700 font-semibold mt-2">{t('landing.mock_gain_track')}</div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-3 text-xs">
            <div className="flex items-center gap-2 mb-2">
              <HeartPulse className="h-3 w-3 text-lavender-600" />
              <div className="font-semibold text-ink-strong">{t('landing.mock_recent_symp')}</div>
              <span className="ms-auto text-[10px] text-lavender-700 bg-lavender-50 rounded-full px-1.5">{t('landing.mock_last_7d')}</span>
            </div>
            <div className="space-y-1.5">
              <SympLine emoji="🤢" label={t('landing.mock_sym_nausea')} sev={3} />
              <SympLine emoji="😵‍💫" label={t('landing.mock_sym_dizzy')} sev={2} />
              <SympLine emoji="🦶" label={t('landing.mock_sym_swell')} sev={2} />
            </div>
          </div>
        </div>
      </section>

      {/* ======= Family & roles ======= */}
      <section id="family" className="bg-gradient-to-r from-mint-50 via-white to-brand-50 border-y border-slate-200/70 py-16">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">{t('landing.family_eyebrow')}</div>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.family_h2')}</h2>
            <p className="mt-3 text-ink max-w-lg">{t('landing.family_p')}</p>
            <ul className="mt-5 space-y-3 text-ink">
              <Bullet tint="mint">{t('landing.family_b1')}</Bullet>
              <Bullet tint="lavender">{t('landing.family_b2')}</Bullet>
              <Bullet tint="coral">{t('landing.family_b3')}</Bullet>
              <Bullet tint="peach">{t('landing.family_b4')}</Bullet>
              <Bullet tint="brand">{t('landing.family_b5')}</Bullet>
            </ul>
          </div>
          <div className="rounded-3xl bg-white border border-slate-200 shadow-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">{t('landing.feed_eyebrow')}</div>
            <ul className="divide-y divide-slate-100">
              <CaregiverRow tint="coral"    name="Sarah"  role="parent" what="logged a feeding" detail="180 ml · bottle · 2 hours ago" />
              <CaregiverRow tint="lavender" name="Ahmed"  role="parent" what="logged a temperature" detail="37.2 °C · axillary · 1 hour ago" />
              <CaregiverRow tint="mint"     name="Mona"   role="nanny"  what="logged a sleep session" detail="1 h 45 m · crib · 30 min ago" />
              <CaregiverRow tint="peach"    name="Dr. K." role="doctor" what="commented on the appointment" detail="&ldquo;Continue probiotics for one more week.&rdquo; · just now" />
            </ul>
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-50 border border-mint-200 p-2.5 text-xs text-mint-900">
              <ShieldCheck className="h-3.5 w-3.5 text-mint-700 shrink-0" />
              <span>{t('landing.feed_audit_note')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ======= Smart Scan (OCR) ======= */}
      <section id="smart-scan" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">{t('landing.ocr_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.ocr_h2')}</h2>
          <p className="mt-3 text-ink max-w-lg">{t('landing.ocr_p')}</p>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="coral">{t('landing.ocr_b1')}</Bullet>
            <Bullet tint="brand">{t('landing.ocr_b2')}</Bullet>
            <Bullet tint="mint">{t('landing.ocr_b3')}</Bullet>
            <Bullet tint="lavender">{t('landing.ocr_b4')}</Bullet>
            <Bullet tint="peach">{t('landing.ocr_b5')}</Bullet>
          </ul>
          <div className="mt-7">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-4 py-2.5 text-white text-sm font-medium hover:bg-coral-600 shadow-sm">
              {t('landing.ocr_cta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <OcrBeforeAfter />
      </section>

      {/* ======= Reports + bilingual + voice + WhatsApp ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <SmallSpotlight tint="brand"    Icon={FileText}      title={t('landing.sp_reports_t')} body={t('landing.sp_reports_x')} />
          <SmallSpotlight tint="lavender" Icon={Languages}     title={t('landing.sp_lang_t')}    body={t('landing.sp_lang_x')} />
          <SmallSpotlight tint="coral"    Icon={Mic}           title={t('landing.sp_voice_t')}   body={t('landing.sp_voice_x')} />
          <SmallSpotlight tint="mint"     Icon={MessagesSquare} title={t('landing.sp_wa_t')}      body={t('landing.sp_wa_x')} />
        </div>
      </section>

      {/* ======= How it works ======= */}
      <section id="how" className="max-w-6xl mx-auto px-4 lg:px-8 pt-4 pb-16">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">{t('landing.how_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.how_h2')}</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-8 relative">
          <svg className="hidden md:block absolute top-10 left-[16%] right-[16%] h-6 pointer-events-none" viewBox="0 0 400 24" preserveAspectRatio="none">
            <path d="M0,12 C80,-8 120,32 200,12 C280,-8 320,32 400,12" stroke="#C2D9EE" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
          </svg>
          <Step n={1} tint="brand" Icon={ClipboardList} title={t('landing.how_s1_t')} text={t('landing.how_s1_x')} />
          <Step n={2} tint="mint"  Icon={Brain}         title={t('landing.how_s2_t')} text={t('landing.how_s2_x')} />
          <Step n={3} tint="coral" Icon={BarChart3}     title={t('landing.how_s3_t')} text={t('landing.how_s3_x')} />
        </div>
      </section>

      {/* ======= Recently added — compact summary of latest waves ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-4 pb-12">
        <div className="text-center mb-8">
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">{t('landing.recent_eyebrow')}</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">{t('landing.recent_h2')}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SmallSpotlight tint="coral"    Icon={Heart}            title={t('landing.recent_cycleos_t')}    body={t('landing.recent_cycleos_x')} />
          <SmallSpotlight tint="lavender" Icon={Brain}            title={t('landing.recent_pattern_t')}    body={t('landing.recent_pattern_x')} />
          <SmallSpotlight tint="mint"     Icon={Activity}         title={t('landing.recent_lifestyle_t')}  body={t('landing.recent_lifestyle_x')} />
          <SmallSpotlight tint="lavender" Icon={Moon}             title={t('landing.recent_ramadan_t')}    body={t('landing.recent_ramadan_x')} />
          <SmallSpotlight tint="brand"    Icon={Apple}            title={t('landing.recent_apple_t')}      body={t('landing.recent_apple_x')} />
          <SmallSpotlight tint="lavender" Icon={MessagesSquare}   title={t('landing.recent_chat_t')}       body={t('landing.recent_chat_x')} />
        </div>

        {/* Coming soon row — what's next, kept honest. */}
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          <ComingSoonTile tint="lavender" Icon={Stethoscope} eyebrow={t('landing.soon_eyebrow')}
            title={t('landing.soon_consult_t')} body={t('landing.soon_consult_x')} />
          <ComingSoonTile tint="mint" Icon={HeartPulse} eyebrow={t('landing.soon_eyebrow')}
            title={t('landing.soon_integrations_t')} body={t('landing.soon_integrations_x')} />
          <ComingSoonTile tint="brand" Icon={Smartphone} eyebrow={t('landing.soon_eyebrow')}
            title={t('landing.soon_native_t')} body={t('landing.soon_native_x')} />
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-mint-700">{t('landing.whats_new_eyebrow')}</div>
              <div className="text-sm font-bold text-ink-strong">{t('landing.whats_new_title')}</div>
              <div className="text-xs text-ink-muted mt-0.5">{t('landing.whats_new_sub')}</div>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-mint-700 group-hover:gap-2 transition-all">
              {t('landing.whats_new_cta')} <ChevronRight className="h-4 w-4" />
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
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">{t('landing.cta_h2')}</h2>
            <p className="mt-2 text-sm text-ink">{t('landing.cta_p')}</p>
            <div className="mt-6 flex items-center justify-center flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-coral-500 px-6 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
                {t('landing.cta_create')}
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-ink hover:bg-slate-50">
                {t('landing.cta_login')}
              </Link>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{t('landing.cta_no_card')}</p>

            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              <StoreBadge platform="apple" comingSoonLabel={t('landing.app_coming_soon')} />
              <StoreBadge platform="google" comingSoonLabel={t('landing.app_coming_soon')} />
            </div>
          </div>
        </div>
      </section>

      {/* ======= Footer ======= */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 grid md:grid-cols-4 gap-8 text-sm">
          <div>
            <Wordmark size="sm" />
            <p className="mt-3 text-ink-muted">{t('landing.footer_tagline')}</p>
          </div>
          <FooterCol title={t('landing.footer_product')}>
            <a href="#features">{t('landing.nav_features')}</a>
            <a href="#pregnancy">{t('landing.nav_pregnancy')}</a>
            <a href="#smart-scan">{t('landing.nav_smart_scan')}</a>
            <a href="#family">{t('landing.nav_family')}</a>
            <Link href="/updates">{t('landing.nav_whats_new')}</Link>
            <Link href="/register">{t('landing.footer_signup')}</Link>
          </FooterCol>
          <FooterCol title={t('landing.footer_company')}>
            <a href="#">{t('landing.footer_about')}</a>
            <a href="#">{t('landing.footer_blog')}</a>
            <a href="#">{t('landing.footer_contact')}</a>
          </FooterCol>
          <FooterCol title={t('landing.footer_legal')}>
            <Link href="/privacy">{t('landing.footer_privacy')}</Link>
            <Link href="/terms">{t('landing.footer_terms')}</Link>
            <Link href="/disclaimer">{t('landing.footer_disclaim')}</Link>
          </FooterCol>
        </div>
        <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-8 text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} Babylytics. {t('landing.footer_rights')}
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
        <h3 className="text-lg font-bold text-ink-strong">{title}</h3>
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
        <div className="text-xs text-ink-muted leading-relaxed">{sub}</div>
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

function ComingSoonTile({
  tint, Icon, eyebrow, title, body,
}: {
  tint: 'lavender' | 'brand' | 'mint' | 'coral' | 'peach';
  Icon: React.ComponentType<{ className?: string }>;
  eyebrow: string; title: string; body: string;
}) {
  const ring = {
    lavender: 'border-lavender-200 from-lavender-50 to-brand-50',
    brand:    'border-brand-200    from-brand-50    to-lavender-50',
    mint:     'border-mint-200     from-mint-50     to-coral-50',
    coral:    'border-coral-200    from-coral-50    to-peach-50',
    peach:    'border-peach-200    from-peach-50    to-coral-50',
  }[tint];
  const iconCls = {
    lavender: 'bg-lavender-100 text-lavender-700',
    brand:    'bg-brand-100    text-brand-700',
    mint:     'bg-mint-100     text-mint-700',
    coral:    'bg-coral-100    text-coral-700',
    peach:    'bg-peach-100    text-peach-700',
  }[tint];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${ring}`}>
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${iconCls}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-ink-strong">{title}</h3>
            <span className="inline-flex items-center rounded-full bg-coral-100 text-coral-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
              {eyebrow}
            </span>
          </div>
          <p className="text-xs text-ink leading-relaxed mt-1">{body}</p>
        </div>
      </div>
    </div>
  );
}

function StoreBadge({ platform, comingSoonLabel }: { platform: 'apple'|'google'; comingSoonLabel: string }) {
  const Icon = platform === 'apple' ? Apple : Smartphone;
  const bottom = platform === 'apple' ? 'App Store' : 'Google Play';
  // Wave 11: native apps not shipped yet — render as a static badge with
  // a "Coming soon" eyebrow instead of a link. Disabled visual state so
  // visitors know it's not interactive.
  return (
    <span aria-disabled
      className="inline-flex items-center gap-3 rounded-lg bg-ink-strong/85 text-white px-4 py-2.5 cursor-not-allowed select-none">
      <Icon className="h-6 w-6 opacity-90" />
      <span className="text-left leading-tight">
        <span className="block text-[10px] uppercase tracking-wider opacity-80">{comingSoonLabel}</span>
        <span className="block text-sm font-semibold">{bottom}</span>
      </span>
    </span>
  );
}

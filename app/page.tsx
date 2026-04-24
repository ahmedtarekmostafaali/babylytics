import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/Wordmark';
import { HeroOrbit } from '@/components/HeroOrbit';
import {
  Milk, Moon, Baby, Check, Star, ArrowRight,
  BarChart3, Brain, Clipboard, Sparkles,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <div className="bg-gradient-to-b from-white to-brand-50 min-h-screen">
      {/* ======= Header ======= */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200/60">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/"><Wordmark size="md" /></Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-ink">
            <a href="#features"  className="hover:text-ink-strong">Features</a>
            <a href="#how"       className="hover:text-ink-strong">How it works</a>
            <a href="#ocr"       className="hover:text-ink-strong">Smart Scan</a>
            <a href="#testimonials" className="hover:text-ink-strong">Parents</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"    className="hidden sm:inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50">Log in</Link>
            <Link href="/register" className="inline-flex items-center rounded-md bg-coral-500 px-4 py-2 text-sm font-medium text-white hover:bg-coral-600 shadow-sm">Sign up free</Link>
          </div>
        </div>
      </header>

      {/* ======= Hero ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-12 lg:pt-20 pb-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
            <span className="text-coral-500">Track today.</span><br />
            <span className="text-mint-600">Nurture tomorrow.</span>
          </h1>
          <p className="mt-5 text-lg text-ink max-w-lg">
            Clinical-grade tracking for feedings, stool, medications, growth and medical records —
            with handwritten-note OCR that understands English and Arabic.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-md bg-coral-500 px-5 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 font-medium text-ink hover:bg-slate-50">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 grid place-items-center">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              See how it works
            </a>
          </div>

          {/* Social proof */}
          <div className="mt-8 flex items-center gap-3">
            <div className="flex -space-x-2">
              <Avatar tint="coral"    initial="S" />
              <Avatar tint="mint"     initial="J" />
              <Avatar tint="lavender" initial="P" />
              <Avatar tint="peach"    initial="A" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex text-peach-500">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <span className="text-sm text-ink">Loved by caregivers worldwide</span>
            </div>
          </div>
        </div>

        <div className="relative">
          <HeroOrbit />
        </div>
      </section>

      {/* ======= Feature cards ======= */}
      <section id="features" className="max-w-6xl mx-auto px-4 lg:px-8 py-6 grid gap-5 md:grid-cols-3">
        <FeatureCard
          tint="coral"
          Icon={Milk}
          title="Feeding tracker"
          text="Log every bottle, breastfeed, and solid. See daily and weekly totals against your pediatrician's recommended intake."
        />
        <FeatureCard
          tint="lavender"
          Icon={Moon}
          title="Sleep & quiet time"
          text="Track rest patterns and quiet time. Record sleep logs so you and your co-parent stay on the same page."
        />
        <FeatureCard
          tint="peach"
          Icon={Baby}
          title="Diaper & stool health"
          text="Record stool size, color, and consistency. Catch changes early and share a clear log with your doctor."
        />
      </section>

      {/* ======= Patterns / Dashboard ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">Smart insights</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            Understand your baby&apos;s patterns effortlessly.
          </h2>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="mint">Rolling-window KPIs: total feed, recommended, remaining, feeding %</Bullet>
            <Bullet tint="brand">Weight trend with automatic growth curve</Bullet>
            <Bullet tint="peach">Daily feed/stool summaries and printable reports</Bullet>
            <Bullet tint="lavender">Medication adherence at a glance</Bullet>
          </ul>
          <div className="mt-7">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-white text-sm font-medium hover:bg-brand-600 shadow-sm">
              Explore the dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="rounded-2xl bg-white shadow-panel border border-slate-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-ink-strong">Dashboard</div>
            <span className="text-xs text-ink-muted">Today</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MockKpi tint="peach"    icon={<Milk     className="h-4 w-4" />} title="Feeding" value="5 feeds" sub="680 ml" />
            <MockKpi tint="lavender" icon={<Moon     className="h-4 w-4" />} title="Sleep"   value="8h 45m"  sub="score 85" />
            <MockKpi tint="mint"     icon={<Baby     className="h-4 w-4" />} title="Diaper"  value="4 times" sub="normal"  />
          </div>
          <MockBarChart />
          <div className="mt-4 text-xs font-semibold text-ink-muted uppercase tracking-wider">Daily timeline</div>
          <div className="mt-2 divide-y divide-slate-100 text-sm">
            <TimelineRow time="08:00" tint="coral"    icon={<Milk className="h-3.5 w-3.5" />} title="Breastfeeding" sub="Left 15 min, Right 10 min" />
            <TimelineRow time="10:30" tint="peach"    icon={<Baby className="h-3.5 w-3.5" />} title="Diaper change" sub="Pee" />
            <TimelineRow time="13:00" tint="lavender" icon={<Moon className="h-3.5 w-3.5" />} title="Nap"           sub="1 h 30m" />
          </div>
        </div>
      </section>

      {/* ======= How it works ======= */}
      <section id="how" className="max-w-6xl mx-auto px-4 lg:px-8 py-16">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">How it works</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">Three steps to a clearer picture.</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          <Step n={1} tint="brand"    Icon={Clipboard} title="Log daily activities" text="Feedings, stools, meds, measurements — entered in seconds or uploaded as handwritten notes." />
          <Step n={2} tint="mint"     Icon={Brain}     title="Automatic analysis"   text="Every entry runs through smart rules and aggregations — no spreadsheets, no manual math." />
          <Step n={3} tint="coral"    Icon={BarChart3} title="Get insights"         text="Daily & full reports, trend charts, adherence tracking. Print for your pediatrician." />
        </div>
      </section>

      {/* ======= Smart Scan (OCR) ======= */}
      <section id="ocr" className="max-w-6xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="text-xs font-semibold tracking-wider text-coral-500 uppercase">Smart Scan · OCR</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">
            Upload handwritten notes.<br />We digitize everything.
          </h2>
          <ul className="mt-5 space-y-3 text-ink">
            <Bullet tint="coral">Scan daily logs — English, Arabic, or mixed</Bullet>
            <Bullet tint="mint">Auto-detect feeding &amp; stool data</Bullet>
            <Bullet tint="peach">Edit &amp; confirm before saving — nothing is auto-applied</Bullet>
          </ul>
          <div className="mt-7">
            <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-coral-500 px-4 py-2.5 text-white text-sm font-medium hover:bg-coral-600 shadow-sm">
              Try Smart Scan <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <OcrBeforeAfter />
      </section>

      {/* ======= Testimonials ======= */}
      <section id="testimonials" className="max-w-6xl mx-auto px-4 lg:px-8 py-16">
        <div className="text-center">
          <div className="text-xs font-semibold tracking-wider text-mint-600 uppercase">Parents love Babylytics</div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-ink-strong">The calm your brain has been asking for.</h2>
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          <Quote
            name="Sarah M."
            tint="coral"
            text="This app changed how I understand my baby's routine. The OCR for my handwritten logs saves me hours."
          />
          <Quote
            name="James T."
            tint="mint"
            text="The daily report feels like a weekly briefing from a NICU nurse. We bring it to every pediatrician visit."
          />
          <Quote
            name="Priya K."
            tint="lavender"
            text="Arabic + English handwriting recognition is what sold us — nothing else on the market does this well."
          />
        </div>
      </section>

      {/* ======= CTA ======= */}
      <section className="max-w-6xl mx-auto px-4 lg:px-8 pt-16 pb-24">
        <div className="rounded-3xl bg-gradient-to-r from-coral-50 via-peach-50 to-mint-50 border border-slate-200 p-10 text-center relative overflow-hidden">
          <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-coral-100 blur-2xl" />
          <div className="absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-mint-100 blur-2xl" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong">
              Start tracking your baby&apos;s journey today.
            </h2>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-coral-500 px-6 py-3 text-white font-medium hover:bg-coral-600 shadow-sm">
                Create free account
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-6 py-3 font-medium text-ink hover:bg-slate-50">
                Log in
              </Link>
            </div>
            <p className="mt-3 text-xs text-ink-muted">No credit card required.</p>
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
            <a href="#how">How it works</a>
            <a href="#ocr">Smart Scan</a>
            <Link href="/register">Sign up</Link>
          </FooterCol>
          <FooterCol title="Company">
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </FooterCol>
          <FooterCol title="Legal">
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Security</a>
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

function Avatar({ tint, initial }: { tint: 'coral'|'mint'|'lavender'|'peach'; initial: string }) {
  const bg = { coral: 'bg-coral-300', mint: 'bg-mint-300', lavender: 'bg-lavender-300', peach: 'bg-peach-300' }[tint];
  return (
    <span className={`h-8 w-8 rounded-full ring-2 ring-white grid place-items-center text-white text-xs font-bold ${bg}`}>
      {initial}
    </span>
  );
}

function FeatureCard({
  tint, Icon, title, text,
}: {
  tint: 'coral'|'mint'|'lavender'|'peach'|'brand';
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  const bgIcon = {
    coral:    'bg-coral-100 text-coral-600',
    mint:     'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600',
    peach:    'bg-peach-100 text-peach-600',
    brand:    'bg-brand-100 text-brand-600',
  }[tint];
  const linkColor = {
    coral: 'text-coral-600', mint: 'text-mint-600', lavender: 'text-lavender-600',
    peach: 'text-peach-600', brand: 'text-brand-600',
  }[tint];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-card">
      <div className={`h-12 w-12 rounded-full grid place-items-center ${bgIcon}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink-strong">{title}</h3>
      <p className="mt-2 text-sm text-ink">{text}</p>
      <a href="#features" className={`mt-3 inline-flex items-center gap-1 text-sm font-medium ${linkColor}`}>
        Learn more <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function Bullet({ tint, children }: { tint: 'brand'|'mint'|'coral'|'lavender'|'peach'; children: React.ReactNode }) {
  const bg = {
    brand: 'bg-brand-100 text-brand-700',
    mint:  'bg-mint-100 text-mint-700',
    coral: 'bg-coral-100 text-coral-700',
    peach: 'bg-peach-100 text-peach-700',
    lavender: 'bg-lavender-100 text-lavender-700',
  }[tint];
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 h-6 w-6 rounded-full grid place-items-center ${bg}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function MockKpi({ tint, title, value, sub, icon }: {
  tint: 'peach'|'lavender'|'mint'|'brand'|'coral';
  title: string; value: string; sub: string;
  icon: React.ReactNode;
}) {
  const bg = { peach:'bg-peach-50', lavender:'bg-lavender-50', mint:'bg-mint-50', brand:'bg-brand-50', coral:'bg-coral-50' }[tint];
  const fg = { peach:'text-peach-600', lavender:'text-lavender-600', mint:'text-mint-600', brand:'text-brand-600', coral:'text-coral-600' }[tint];
  return (
    <div className={`rounded-lg ${bg} p-3`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{title}</div>
        <div className={fg}>{icon}</div>
      </div>
      <div className="mt-1 text-lg font-bold text-ink-strong">{value}</div>
      <div className="text-xs text-ink-muted">{sub}</div>
    </div>
  );
}

function MockBarChart() {
  const bars = [30, 45, 60, 75, 50, 80, 95];
  return (
    <div className="mt-5 rounded-lg bg-brand-50 p-4">
      <div className="flex items-end gap-2 h-24">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-peach-500" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-ink-muted">
        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
      </div>
    </div>
  );
}

function TimelineRow({ time, tint, title, sub, icon }: {
  time: string;
  tint: 'coral'|'peach'|'lavender'|'mint'|'brand';
  title: string; sub: string;
  icon: React.ReactNode;
}) {
  const bg = {
    coral: 'bg-coral-100 text-coral-700',
    peach: 'bg-peach-100 text-peach-700',
    lavender: 'bg-lavender-100 text-lavender-700',
    mint: 'bg-mint-100 text-mint-700',
    brand: 'bg-brand-100 text-brand-700',
  }[tint];
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-12 text-xs text-ink-muted">{time}</span>
      <span className={`h-7 w-7 rounded-full grid place-items-center ${bg}`}>{icon}</span>
      <span className="flex-1">
        <span className="block font-medium text-ink-strong">{title}</span>
        <span className="block text-xs text-ink-muted">{sub}</span>
      </span>
    </div>
  );
}

function Step({ n, tint, Icon, title, text }: {
  n: number;
  tint: 'brand'|'mint'|'coral'|'peach'|'lavender';
  Icon: React.ComponentType<{ className?: string }>;
  title: string; text: string;
}) {
  const ring = {
    brand: 'bg-brand-100 text-brand-700 ring-brand-200',
    mint:  'bg-mint-100 text-mint-700 ring-mint-200',
    coral: 'bg-coral-100 text-coral-700 ring-coral-200',
    peach: 'bg-peach-100 text-peach-700 ring-peach-200',
    lavender: 'bg-lavender-100 text-lavender-700 ring-lavender-200',
  }[tint];
  const badge = {
    brand: 'bg-brand-500', mint: 'bg-mint-500', coral: 'bg-coral-500', peach: 'bg-peach-500', lavender: 'bg-lavender-500',
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

function Quote({ name, tint, text }: { name: string; tint: 'coral'|'mint'|'lavender'|'peach'; text: string }) {
  const bg = { coral:'bg-coral-200', mint:'bg-mint-200', lavender:'bg-lavender-200', peach:'bg-peach-200' }[tint];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`h-10 w-10 rounded-full grid place-items-center text-white font-bold ${bg}`}>{name.charAt(0)}</span>
        <div>
          <p className="text-sm text-ink">&ldquo;{text}&rdquo;</p>
          <div className="mt-2 flex items-center gap-1 text-peach-500">
            {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
            <span className="ml-2 text-xs text-ink-muted">— {name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{title}</div>
      <div className="mt-3 space-y-2 flex flex-col [&>*]:text-ink [&>*]:hover:text-ink-strong">
        {children}
      </div>
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
            <OcrRow time="08:00" Icon={Milk}     tint="coral"    title="Breastfeeding" sub="15 min each side" />
            <OcrRow time="10:00" Icon={Milk}     tint="peach"    title="Bottle feeding" sub="120 ml" />
            <OcrRow time="13:00" Icon={Moon}     tint="lavender" title="Nap"           sub="1 h 30m" />
            <OcrRow time="15:00" Icon={Baby}     tint="mint"     title="Diaper"        sub="Dirty" />
            <OcrRow time="18:00" Icon={Milk}     tint="peach"    title="Bottle feeding" sub="100 ml" />
            <OcrRow time="21:00" Icon={Milk}     tint="coral"    title="Breastfeeding" sub="10 min each side" />
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
  time: string;
  Icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'peach'|'mint'|'lavender';
  title: string; sub: string;
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


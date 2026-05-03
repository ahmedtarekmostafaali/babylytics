import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { BabyAvatar } from '@/components/BabyAvatar';
import { DayPicker } from '@/components/DayPicker';
import { SummaryDonut } from '@/components/SummaryDonut';
import { Sparkline } from '@/components/Sparkline';
import { Comments } from '@/components/Comments';
import { PregnancyDashboard } from '@/components/PregnancyDashboard';
import { ConsultationComingSoon } from '@/components/ConsultationComingSoon';
import { NotificationsBell } from '@/components/NotificationsBell';
import { ChatBell } from '@/components/ChatBell';
import { VoiceCommander } from '@/components/VoiceCommander';
import { GrowthInsights } from '@/components/GrowthInsights';
import { SuggestionsCard } from '@/components/SuggestionsCard';
import { MilestoneReferenceCard } from '@/components/MilestoneReference';
import { FeedPaceCard } from '@/components/FeedPaceCard';
import { compareTodayVsRollingAvg } from '@/lib/feed-kpis';
import {
  ageInDays, dayWindow, fmtDate, fmtDateTime, fmtRelative, fmtTime,
  lastNDaysWindow, todayLocalDate, TIMEZONE,
} from '@/lib/dates';
import { effectiveStage } from '@/lib/lifecycle';
import { loadHiddenWidgets, showWidget } from '@/lib/dashboard-prefs';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';
import { fmtKg, fmtMl } from '@/lib/units';
import { signAvatarUrl } from '@/lib/baby-avatar';
import {
  Milk, Moon, Droplet, Pill, Scale, Thermometer, Syringe, Bell,
  TrendingUp, ArrowUpRight, FileText, Sparkles, Plus, ClipboardList, ArrowRight, Activity,
  Stethoscope, CalendarClock, SlidersHorizontal,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('babies').select('name').eq('id', params.babyId).single();
  return { title: data?.name ? `${data.name} · Overview` : 'Baby overview' };
}

type Tint = 'brand' | 'mint' | 'coral' | 'peach' | 'lavender';

export default async function BabyOverview({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { d?: string };
}) {
  const supabase = createClient();
  const babyId = params.babyId;
  const focusDate = searchParams.d ?? todayLocalDate();
  const day = dayWindow(focusDate);
  const last7 = lastNDaysWindow(7);
  const last14 = lastNDaysWindow(14);

  // Per-user language → server-side translator. Falls back to English when the
  // user hasn't set a preference yet.
  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: baby } = await supabase
    .from('babies')
    .select('id,name,dob,gender,birth_weight_kg,feeding_factor_ml_per_kg_per_day,avatar_path,lifecycle_stage,edd,lmp')
    .eq('id', babyId).is('deleted_at', null).single();
  if (!baby) notFound();

  // 046 batch: pharmacy users only see medication stock — bounce them off
  // the overview which would 404 anyway since the dashboard reads from
  // tables the pharmacy RLS denies.
  const { data: { user: meUser } } = await supabase.auth.getUser();
  if (meUser) {
    const { data: meRow } = await supabase.from('baby_users')
      .select('role').eq('baby_id', babyId).eq('user_id', meUser.id).maybeSingle();
    if (meRow?.role === 'pharmacy') {
      redirect(`/babies/${babyId}/medications/stock`);
    }
  }

  const avatarUrl = await signAvatarUrl(supabase, baby.avatar_path);

  // Stage-aware fork — pregnancy gets a completely different dashboard.
  const stage = effectiveStage(baby.lifecycle_stage as 'planning'|'pregnancy'|'newborn'|'infant'|'toddler'|'child'|'archived'|null, baby.dob);

  // Planning ('My cycle') stage uses the planner page as its overview —
  // there's no DOB / feedings / sleep to summarise yet, just the cycle
  // calendar and the consultation tile, which already live there.
  if (stage === 'planning') {
    redirect(`/babies/${babyId}/planner`);
  }
  if (stage === 'pregnancy') {
    const [{ data: m }, { data: summaryRow }, { data: lastUs }, { data: nextAppt }, { data: pregProf }, hiddenPregnancy, { data: recentSymptoms }] = await Promise.all([
      supabase.from('baby_users').select('role').eq('baby_id', babyId).eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle(),
      supabase.rpc('prenatal_summary', { p_baby: babyId }).single(),
      // Pull EFW + key biometry too so the dashboard can overlay "scan-said
      // ~370 g" against the interpolated daily-size card.
      supabase.from('ultrasounds').select('id,scanned_at,gestational_week,summary,efw_g')
        .eq('baby_id', babyId).is('deleted_at', null)
        .order('scanned_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.rpc('next_appointment', { p_baby: babyId }).maybeSingle(),
      supabase.from('pregnancy_profile').select('pre_pregnancy_weight_kg,pre_pregnancy_height_cm')
        .eq('baby_id', babyId).maybeSingle(),
      loadHiddenWidgets(supabase, babyId, 'pregnancy_dashboard'),
      // Recent maternal symptoms (last 7 days, max 20) — surfaced on the
      // pregnancy dashboard as a recent-symptom strip.
      supabase.from('maternal_symptoms')
        .select('id,logged_at,kind,severity').eq('baby_id', babyId).is('deleted_at', null)
        .gte('logged_at', new Date(Date.now() - 7 * 86400000).toISOString())
        .order('logged_at', { ascending: false }).limit(20),
    ]);
    const isParent = ['owner','parent'].includes((m?.role as string) ?? '');
    const appt = nextAppt as { scheduled_at: string; doctor_name: string | null; purpose: string | null } | null;
    const us = lastUs as { id: string; scanned_at: string; gestational_week: number | null; summary: string | null; efw_g: number | null } | null;
    const pp = pregProf as { pre_pregnancy_weight_kg: number | null; pre_pregnancy_height_cm: number | null } | null;
    const symptoms = (recentSymptoms ?? []) as { id: string; logged_at: string; kind: string; severity: number }[];
    return (
      <>
        <PregnancyDashboard
          babyId={babyId}
          babyName={baby.name}
          avatarUrl={avatarUrl}
          edd={baby.edd}
          lmp={baby.lmp}
          summary={(summaryRow ?? {}) as Parameters<typeof PregnancyDashboard>[0]['summary']}
          latestUltrasound={us ? { id: us.id, scanned_at: us.scanned_at, gestational_week: us.gestational_week, summary: us.summary, efw_g: us.efw_g } : null}
          nextAppointment={appt ? { scheduled_at: appt.scheduled_at, doctor_name: appt.doctor_name, purpose: appt.purpose } : null}
          canEdit={isParent}
          prePregnancyWeightKg={pp?.pre_pregnancy_weight_kg ?? null}
          prePregnancyHeightCm={pp?.pre_pregnancy_height_cm ?? null}
          hiddenWidgets={Array.from(hiddenPregnancy)}
          lang={userPrefs.language}
          recentSymptoms={symptoms}
        />
        <div className="max-w-6xl mx-auto px-4 lg:px-8 mt-6">
          <ConsultationComingSoon stage="pregnancy" />
        </div>
      </>
    );
  }

  const age = ageInDays(baby.dob);

  const [
    lastFeed, lastTemp, lastStool, lastDose, lastMeasurement,
    lastWeightRow, lastHeightRow, lastHeadRow,
    lastSleep,
    currentWeight,
    todayFeeds, todayStool, todayMeds, todayTemps, todayMeasurements, todaySleeps,
    activeMeds, recentTaken,
    weekFeeds, weekStool, weekTemps, weekSleeps, _prevWeekFeeds,
    weightSeries,
    upcomingVaccines,
    lowConf,
    nextAppointment,
    myRole,
  ] = await Promise.all([
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml,duration_min').eq('baby_id', babyId).is('deleted_at', null)
      .order('feeding_time', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c,method').eq('baby_id', babyId).is('deleted_at', null)
      .order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('stool_logs')
      .select('id,stool_time,quantity_category,color').eq('baby_id', babyId).is('deleted_at', null)
      .order('stool_time', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('medication_logs')
      .select('id,medication_id,medication_time,status,actual_dosage').eq('baby_id', babyId).is('deleted_at', null)
      .order('medication_time', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurements')
      .select('id,measured_at,weight_kg,height_cm').eq('baby_id', babyId).is('deleted_at', null)
      .order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    // Per-field latest non-null lookups. The single-row query above can return a
    // measurement that has only weight (and null height_cm) — which is why the
    // Growth Insights strip used to "stick" to an old length value when a parent
    // logged a weight-only update. Fetch each field independently so the strip
    // always shows the most recent non-null value for that field.
    supabase.from('measurements')
      .select('measured_at,weight_kg').eq('baby_id', babyId).is('deleted_at', null)
      .not('weight_kg', 'is', null).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurements')
      .select('measured_at,height_cm').eq('baby_id', babyId).is('deleted_at', null)
      .not('height_cm', 'is', null).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('measurements')
      .select('measured_at,head_circ_cm').eq('baby_id', babyId).is('deleted_at', null)
      .not('head_circ_cm', 'is', null).order('measured_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('sleep_logs')
      .select('id,start_at,end_at,duration_min,location,quality').eq('baby_id', babyId).is('deleted_at', null)
      .order('start_at', { ascending: false }).limit(1).maybeSingle(),

    supabase.rpc('current_weight_kg', { p_baby: babyId }),

    // Today's activity (for Timeline + Insights)
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml,duration_min,notes').eq('baby_id', babyId).is('deleted_at', null)
      .gte('feeding_time', day.start).lt('feeding_time', day.end)
      .order('feeding_time', { ascending: true }),
    supabase.from('stool_logs')
      .select('id,stool_time,quantity_category,color,notes').eq('baby_id', babyId).is('deleted_at', null)
      .gte('stool_time', day.start).lt('stool_time', day.end)
      .order('stool_time', { ascending: true }),
    supabase.from('medication_logs')
      .select('id,medication_id,medication_time,status,actual_dosage,notes').eq('baby_id', babyId).is('deleted_at', null)
      .gte('medication_time', day.start).lt('medication_time', day.end)
      .order('medication_time', { ascending: true }),
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c,method,notes').eq('baby_id', babyId).is('deleted_at', null)
      .gte('measured_at', day.start).lt('measured_at', day.end)
      .order('measured_at', { ascending: true }),
    supabase.from('measurements')
      .select('id,measured_at,weight_kg,height_cm,head_circ_cm').eq('baby_id', babyId).is('deleted_at', null)
      .gte('measured_at', day.start).lt('measured_at', day.end)
      .order('measured_at', { ascending: true }),
    supabase.from('sleep_logs')
      .select('id,start_at,end_at,duration_min,location,quality,notes').eq('baby_id', babyId).is('deleted_at', null)
      .gte('start_at', day.start).lt('start_at', day.end)
      .order('start_at', { ascending: true }),

    // Active meds + recent taken doses to compute "next dose"
    supabase.from('medications')
      .select('id,name,dosage,route,frequency_hours,starts_at,ends_at').eq('baby_id', babyId).is('deleted_at', null)
      .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`)
      .order('starts_at', { ascending: false }),
    supabase.from('medication_logs')
      .select('medication_id,medication_time,status').eq('baby_id', babyId).is('deleted_at', null)
      .eq('status', 'taken').gte('medication_time', last7.start)
      .order('medication_time', { ascending: false }),

    // Rolling 7-day windows for mini insights
    supabase.from('feedings')
      .select('id,feeding_time,milk_type,quantity_ml').eq('baby_id', babyId).is('deleted_at', null)
      .gte('feeding_time', last7.start).lt('feeding_time', last7.end),
    supabase.from('stool_logs')
      .select('id,stool_time,quantity_category').eq('baby_id', babyId).is('deleted_at', null)
      .gte('stool_time', last7.start).lt('stool_time', last7.end),
    supabase.from('temperature_logs')
      .select('id,measured_at,temperature_c').eq('baby_id', babyId).is('deleted_at', null)
      .gte('measured_at', last14.start).lt('measured_at', last14.end),
    supabase.from('sleep_logs')
      .select('id,start_at,end_at,duration_min').eq('baby_id', babyId).is('deleted_at', null)
      .gte('start_at', last7.start).lt('start_at', last7.end),
    // Previous week — for the "up X%" insight banner
    supabase.from('feedings').select('id').eq('baby_id', babyId).is('deleted_at', null)
      .gte('feeding_time', new Date(new Date(last7.start).getTime() - 7 * 86400000).toISOString())
      .lt('feeding_time', last7.start),

    supabase.rpc('weight_trend', { p_baby: babyId, p_days: 365 }),

    supabase.from('vaccinations')
      .select('id,vaccine_name,scheduled_at,dose_number,total_doses,status').eq('baby_id', babyId).is('deleted_at', null)
      .eq('status', 'scheduled').order('scheduled_at', { ascending: true }).limit(2),

    supabase.from('extracted_text')
      .select('id,file_id,confidence_score,created_at,status')
      .eq('baby_id', babyId).eq('status', 'extracted').eq('flag_low_confidence', true)
      .order('created_at', { ascending: false }).limit(5),

    // Next upcoming appointment — parent-only, read via the helper RPC that
    // already enforces its own access check.
    supabase.rpc('next_appointment', { p_baby: babyId }),
    supabase.rpc('my_baby_role', { b: babyId }),
  ]);

  // Pregnancy archive flag — show a small entry tile if this baby was tracked
  // through pregnancy. Cheap existence check, single row max.
  const { count: hasPregnancyArchive } = await supabase.from('pregnancy_profile')
    .select('baby_id', { count: 'exact', head: true })
    .eq('baby_id', babyId);
  const showPregnancyArchive = (hasPregnancyArchive ?? 0) > 0;

  // Developmental milestones — used by the Milestones reference card. We pull
  // both the explicit log table and derive fallbacks from teething/speaking
  // logs so a parent who only logs in those trackers still sees the dot move.
  const [logged, firstTooth, firstWord, firstSentence] = await Promise.all([
    supabase.from('developmental_milestones')
      .select('milestone_id,observed_at')
      .eq('baby_id', babyId).is('deleted_at', null)
      .order('observed_at', { ascending: true }),
    supabase.from('teething_logs')
      .select('observed_at').eq('baby_id', babyId).is('deleted_at', null)
      .eq('event_type', 'eruption')
      .order('observed_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('speaking_logs')
      .select('observed_at').eq('baby_id', babyId).is('deleted_at', null)
      .eq('is_first_use', true).in('category', ['word'])
      .order('observed_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('speaking_logs')
      .select('observed_at').eq('baby_id', babyId).is('deleted_at', null)
      .eq('is_first_use', true).in('category', ['sentence','phrase'])
      .order('observed_at', { ascending: true }).limit(1).maybeSingle(),
  ]);
  const loggedMilestones = ((logged.data ?? []) as { milestone_id: string; observed_at: string }[]) ?? [];

  // User-specific dashboard widget preferences. Empty set = show everything,
  // so existing behavior is preserved when the user has never customized.
  const hiddenWidgets = await loadHiddenWidgets(supabase, babyId, 'overview');
  const show = (id: string) => showWidget(hiddenWidgets, id);

  // Feed-pace comparison: today's accumulated ml vs the past-7-day average
  // accumulated ml at the same time-of-day. Filter today's rows out of the
  // 7-day window before passing in so they don't pollute the baseline.
  const allWeekFeeds = (weekFeeds.data ?? []) as { feeding_time: string; quantity_ml: number | string | null }[];
  const historyFeeds = allWeekFeeds.filter(r => {
    const k = r.feeding_time.slice(0, 10);   // crude UTC-day key, fine for filtering since today's row already lives in todayFeeds
    return k !== focusDate;
  });
  const todayFeedsForKpi = ((todayFeeds.data ?? []) as { feeding_time: string; quantity_ml: number | string | null }[]);
  const feedPace = compareTodayVsRollingAvg(todayFeedsForKpi, historyFeeds);

  const w = (currentWeight.data as number | null) ?? null;

  // ───────── Timeline: combine today's events
  type TimelineItem = {
    at: string;
    tint: Tint;
    icon: typeof Milk;
    title: string;
    subtitle?: string;
    href: string;
  };
  // Today's totals — surfaced as their own cards beside "Last feeding" / "Last stool".
  const todayFeedRows = (todayFeeds.data ?? []) as { quantity_ml: number | string | null; duration_min: number | string | null; milk_type: string }[];
  const todayFeedCount  = todayFeedRows.length;
  const todayFeedVolume = todayFeedRows.reduce((a, r) => a + Number(r.quantity_ml || 0), 0);
  const todayBreasts    = todayFeedRows.filter(r => r.milk_type === 'breast').length;
  const todayStoolRows  = (todayStool.data ?? []) as { quantity_category: string | null }[];
  const todayStoolCount = todayStoolRows.length;
  const todayStoolSmall  = todayStoolRows.filter(r => r.quantity_category === 'small').length;
  const todayStoolMedium = todayStoolRows.filter(r => r.quantity_category === 'medium').length;
  const todayStoolLarge  = todayStoolRows.filter(r => r.quantity_category === 'large').length;

  const tl: TimelineItem[] = [];
  for (const r of (todayFeeds.data ?? [])) {
    const bits: string[] = [];
    if (r.quantity_ml) bits.push(fmtMl(r.quantity_ml));
    if (r.duration_min) bits.push(`${r.duration_min} min`);
    bits.push(r.milk_type);
    tl.push({
      at: r.feeding_time, tint: 'coral', icon: Milk,
      title: 'Feeding',
      subtitle: bits.join(' · '),
      href: `/babies/${babyId}/feedings/${r.id}`,
    });
  }
  for (const r of (todayStool.data ?? [])) {
    tl.push({
      at: r.stool_time, tint: 'mint', icon: Droplet,
      title: 'Stool',
      subtitle: [r.quantity_category, r.color].filter(Boolean).join(' · ') || 'logged',
      href: `/babies/${babyId}/stool/${r.id}`,
    });
  }
  const medMap = new Map(((activeMeds.data ?? []) as { id: string; name: string }[]).map(m => [m.id, m.name]));
  for (const r of (todayMeds.data ?? [])) {
    tl.push({
      at: r.medication_time, tint: 'lavender', icon: Pill,
      title: `Medication · ${r.status}`,
      subtitle: [medMap.get(r.medication_id) ?? 'dose', r.actual_dosage].filter(Boolean).join(' · '),
      href: `/babies/${babyId}/medications/log/${r.id}`,
    });
  }
  for (const r of (todayTemps.data ?? [])) {
    tl.push({
      at: r.measured_at, tint: 'peach', icon: Thermometer,
      title: 'Temperature',
      subtitle: `${Number(r.temperature_c).toFixed(1)} °C · ${r.method}`,
      href: `/babies/${babyId}/temperature/${r.id}`,
    });
  }
  for (const r of (todayMeasurements.data ?? [])) {
    tl.push({
      at: r.measured_at, tint: 'brand', icon: Scale,
      title: 'Measurement',
      subtitle: [r.weight_kg ? fmtKg(r.weight_kg) : null, r.height_cm ? `${r.height_cm} cm` : null].filter(Boolean).join(' · '),
      href: `/babies/${babyId}/measurements/${r.id}`,
    });
  }
  for (const r of (todaySleeps.data ?? [])) {
    const dur = r.duration_min ?? null;
    const label = dur != null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : 'in progress';
    tl.push({
      at: r.start_at, tint: 'lavender', icon: Moon,
      title: `Sleep · ${label}`,
      subtitle: [r.location, r.quality].filter(Boolean).join(' · '),
      href: `/babies/${babyId}/sleep/${r.id}`,
    });
  }
  tl.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ───────── Insights: last 7 days breakdowns
  // Feeding count per day (for bar chart)
  const feedByDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    feedByDay.set(key, 0);
  }
  for (const r of (weekFeeds.data ?? []) as { feeding_time: string }[]) {
    const k = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.feeding_time));
    if (feedByDay.has(k)) feedByDay.set(k, (feedByDay.get(k) ?? 0) + 1);
  }
  const feedBars = Array.from(feedByDay.entries()).map(([day, n]) => ({ day, n }));

  // Temperature — we keep the last reading on hand in case a future card wants
  // it; the insights grid uses Total Sleep instead of Temperature per the
  // mockup. Reference kept to avoid an unused-query warning.
  void weekTemps; void lastTemp;

  // Sleep minutes per day (last 7d) — used for Total Sleep mini-chart
  const sleepByDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    sleepByDay.set(key, 0);
  }
  let weekSleepMinTotal = 0;
  for (const r of (weekSleeps.data ?? []) as { start_at: string; duration_min: number | null }[]) {
    const k = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(r.start_at));
    if (!sleepByDay.has(k)) continue;
    const mins = r.duration_min ?? 0;
    sleepByDay.set(k, (sleepByDay.get(k) ?? 0) + mins);
    weekSleepMinTotal += mins;
  }
  const sleepLine = Array.from(sleepByDay.values()).map(v => v / 60); // hours per day
  const avgSleepHours = (weekSleepMinTotal / 60) / 7;
  const lastSleepDurMin = lastSleep.data?.duration_min ?? null;

  // Stool summary donut (last 7d, by category)
  type StoolRow = { quantity_category: string | null };
  const stoolCounts = { small: 0, medium: 0, large: 0 };
  for (const r of (weekStool.data ?? []) as StoolRow[]) {
    const c = (r.quantity_category ?? '').toLowerCase();
    if (c === 'small') stoolCounts.small++;
    else if (c === 'medium') stoolCounts.medium++;
    else if (c === 'large') stoolCounts.large++;
  }
  const stoolSegments = [
    { label: 'Small',  value: stoolCounts.small,  color: '#7FC8A9' },
    { label: 'Medium', value: stoolCounts.medium, color: '#7BAEDC' },
    { label: 'Large',  value: stoolCounts.large,  color: '#B9A7D8' },
  ];

  // Feeding breakdown donut (last 7d, by milk_type)
  type FeedRow = { milk_type: string; quantity_ml: number | string | null };
  const feedCounts: Record<string, number> = {};
  for (const r of (weekFeeds.data ?? []) as FeedRow[]) {
    const k = (r.milk_type ?? 'other').toLowerCase();
    feedCounts[k] = (feedCounts[k] ?? 0) + 1;
  }
  const feedColorMap: Record<string, string> = {
    breast: '#F4A6A6', formula: '#F6C177', mixed: '#B9A7D8', solid: '#7FC8A9', other: '#CBD5E1',
  };
  const feedSegments = Object.entries(feedCounts).map(([label, value]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value,
    color: feedColorMap[label] ?? '#CBD5E1',
  }));

  // ───────── Next dose computation
  type Med = { id: string; name: string; dosage: string | null; route: string; frequency_hours: number | null; starts_at: string | null; ends_at: string | null };
  const activeMedsList = (activeMeds.data ?? []) as Med[];
  const recentTakenList = (recentTaken.data ?? []) as { medication_id: string; medication_time: string }[];
  const lastTakenByMed = new Map<string, string>();
  for (const r of recentTakenList) if (!lastTakenByMed.has(r.medication_id)) lastTakenByMed.set(r.medication_id, r.medication_time);

  type Reminder = { medId: string; name: string; dosage: string | null; nextAt: string | null; isOverdue: boolean };
  const nowMs = Date.now();
  const reminders: Reminder[] = activeMedsList.map(m => {
    const last = lastTakenByMed.get(m.id);
    let nextAt: string | null = null;
    if (m.frequency_hours && last) {
      nextAt = new Date(new Date(last).getTime() + Number(m.frequency_hours) * 3600000).toISOString();
    } else if (m.starts_at) {
      nextAt = m.starts_at;
    }
    const isOverdue = nextAt != null && new Date(nextAt).getTime() <= nowMs;
    return { medId: m.id, name: m.name, dosage: m.dosage, nextAt, isOverdue };
  }).sort((a, b) => {
    // Overdue first, then soonest upcoming
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const ta = a.nextAt ? new Date(a.nextAt).getTime() : Infinity;
    const tb = b.nextAt ? new Date(b.nextAt).getTime() : Infinity;
    return ta - tb;
  });
  const overdueCount = reminders.filter(r => r.isOverdue).length;
  const nextDose = reminders.find(r => r.nextAt);

  // Week feed count still used by the "Today's insights" InsightCells even
  // though the prior week-over-week banner was replaced with GrowthInsights.
  const thisWeek = (weekFeeds.data ?? []).length;

  // ───────── Growth progress: latest vs birth
  // Use the per-field latest-non-null row (lastWeightRow) for the headline
  // number so a parent who just logged a weight sees that weight here, even
  // if the weight_trend RPC's array hasn't refreshed yet. Sparkline still
  // uses the series so the trendline reflects history.
  const weightRows = (weightSeries.data ?? []) as { measured_at: string; weight_kg: number | null }[];
  const weightPoints = weightRows.filter(r => r.weight_kg != null).map(r => Number(r.weight_kg));
  const growthLatest = lastWeightRow.data?.weight_kg != null
    ? Number(lastWeightRow.data.weight_kg)
    : (weightPoints.length ? weightPoints[weightPoints.length - 1] : null);
  const growthDelta = growthLatest != null && baby.birth_weight_kg
    ? growthLatest - Number(baby.birth_weight_kg) : null;

  // ───────── Greeting
  const hourInCairo = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(new Date()));
  const greeting = hourInCairo < 5
    ? t('overview.greet_night')
    : hourInCairo < 12
      ? t('overview.greet_morning')
      : hourInCairo < 17
        ? t('overview.greet_afternoon')
        : t('overview.greet_evening');

  // ───────── Last-X tiles
  const lastFeedBits: string[] = [];
  if (lastFeed.data?.quantity_ml) lastFeedBits.push(fmtMl(lastFeed.data.quantity_ml));
  if (lastFeed.data?.duration_min) lastFeedBits.push(`${lastFeed.data.duration_min} min`);
  if (lastFeed.data?.milk_type) lastFeedBits.push(String(lastFeed.data.milk_type));

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-6 pb-28 space-y-6">
      {/* ═══ TOP ROW ═══ Greeting + date + bell */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <BabyAvatar url={avatarUrl ?? null} size="xl" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink-muted">
              {greeting}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-strong truncate">
              {greeting}, <bdi>{baby.name}</bdi>!
            </h1>
            <div className="text-xs text-ink-muted mt-0.5">
              {t(`overview.${baby.gender === 'male' ? 'male' : 'female'}`)} · {t('overview.days_old', { n: age })}{w ? ` · ${fmtKg(w)}` : ''}
            </div>
            {showPregnancyArchive && (
              <Link href={`/babies/${babyId}/medical-profile#pregnancy-history`}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-lavender-100 hover:bg-lavender-200 text-lavender-700 text-[11px] font-semibold px-3 py-1">
                <Sparkles className="h-3 w-3" /> {t('overview.pregnancy_archive_avail')} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/babies/${babyId}/dashboard-settings`}
            className="h-10 w-10 grid place-items-center rounded-full bg-white border border-slate-200 hover:bg-slate-50 shadow-sm"
            title={t('overview.customize_dashboard')}
            aria-label={t('overview.customize_dashboard')}>
            <SlidersHorizontal className="h-4 w-4 text-ink" />
          </Link>
          <DayPicker babyId={babyId} value={focusDate} />
          <VoiceCommander babyId={babyId} lang={userPrefs.language} />
          <ChatBell babyId={babyId} />
          <NotificationsBell babyId={babyId} />
        </div>
      </header>

      {/* ═══ OVERDUE MEDICATION BANNER ═══ */}
      {overdueCount > 0 && (
        <div className="rounded-2xl border-2 border-coral-400 bg-gradient-to-r from-coral-50 via-coral-50/60 to-white p-4 text-sm shadow-card flex items-start gap-3 animate-pulse">
          <Pill className="h-5 w-5 text-coral-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-bold text-coral-900">
              {overdueCount === 1
                ? `1 ${t('overview.dose_due_now')}`
                : t('overview.doses_due_now', { n: overdueCount })}
            </div>
            <p className="text-coral-800/90 mt-0.5">{t('overview.dose_due_sub')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {reminders.filter(r => r.isOverdue).slice(0, 4).map(r => (
                <Link key={r.medId} href={`/babies/${babyId}/medications/log?m=${r.medId}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-coral-600 px-3 py-1 text-xs font-semibold text-white hover:bg-coral-700">
                  <Pill className="h-3 w-3" /> {t('overview.log_med', { name: r.name })}
                </Link>
              ))}
              {reminders.filter(r => r.isOverdue).length > 4 && (
                <Link href={`/babies/${babyId}/medications`}
                  className="rounded-full border border-coral-300 bg-white px-3 py-1 text-xs font-semibold text-coral-700 hover:bg-coral-50">
                  + {reminders.filter(r => r.isOverdue).length - 4} more
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ LOW-CONFIDENCE OCR BANNER ═══ */}
      {(lowConf.data?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-coral-300 bg-coral-50/80 p-4 text-sm shadow-card flex items-start gap-3">
          <FileText className="h-5 w-5 text-coral-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold text-coral-700">
              {lowConf.data!.length} OCR extraction{lowConf.data!.length > 1 ? 's' : ''} need review
            </div>
            <p className="text-coral-700/90 mt-0.5">Low confidence — confirm or edit before they land in your logs.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {lowConf.data!.map(x => (
                <Link key={x.id} href={`/babies/${babyId}/ocr/${x.id}`}
                  className="rounded-full bg-coral-600 px-3 py-1 text-xs text-white hover:bg-coral-700">
                  Review · {Math.round((Number(x.confidence_score) || 0) * 100)}%
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ ROW: Last X cards ═══ */}
      <section className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {show('last_feeding') && <LastCard
          tint="coral" icon={Milk}
          label={t('overview.kpi_last_feeding')}
          value={lastFeed.data ? (lastFeedBits[0] ?? '—') : 'No data'}
          sub={lastFeed.data ? lastFeedBits.slice(1).join(' · ') : t('overview.tap_to_log')}
          time={lastFeed.data?.feeding_time ?? null}
          href={`/babies/${babyId}/feedings`}
        />}
        {show('todays_feedings') && <LastCard
          tint="peach" icon={Milk}
          label={t('overview.kpi_todays_feedings')}
          value={todayFeedCount === 0 ? t('overview.no_data') : fmtMl(todayFeedVolume)}
          sub={todayFeedCount === 0
            ? t('overview.tap_to_log')
            : t('overview.feeds_n', { n: todayFeedCount })}
          time={null}
          href={`/babies/${babyId}/feedings`}
          badge={todayFeedCount > 0 ? t('overview.today') : undefined}
        />}
        {show('feed_pace') && <FeedPaceCard cmp={feedPace} lang={userPrefs.language} />}
        {show('feeding_progress') && (() => {
          const wForCalc = (currentWeight.data as number | null) ?? Number(baby.birth_weight_kg ?? 0);
          const factor = Number(baby.feeding_factor_ml_per_kg_per_day ?? 150);
          const recommended = wForCalc > 0 ? Math.round(wForCalc * factor) : 0;
          const pct = recommended > 0 ? Math.round((todayFeedVolume / recommended) * 100) : 0;
          const remaining = Math.max(0, recommended - todayFeedVolume);
          const tone: 'coral' | 'peach' | 'mint' =
            recommended === 0 ? 'peach' :
            pct >= 100        ? 'mint'  :
            pct >= 70         ? 'peach' : 'coral';
          return (
            <LastCard
              tint={tone} icon={Milk}
              label={t('overview.kpi_feeding_pct')}
              value={recommended > 0 ? `${pct}%` : '—'}
              sub={recommended === 0
                ? t('overview.tap_to_log')
                : pct >= 100
                  ? `${t('overview.goal_hit')} · ${fmtMl(recommended)}`
                  : t('overview.ml_left_to_goal', { ml: remaining })}
              time={null}
              href={`/babies/${babyId}/feedings`}
              badge={recommended > 0 && pct >= 100 ? t('overview.goal_hit') : undefined}
            />
          );
        })()}
        {show('last_sleep') && <LastCard
          tint="lavender" icon={Moon}
          label={t('overview.kpi_last_sleep')}
          value={
            lastSleep.data
              ? (lastSleep.data.end_at == null
                  ? t('overview.in_progress')
                  : `${Math.floor((lastSleepDurMin ?? 0) / 60)}h ${(lastSleepDurMin ?? 0) % 60}m`)
              : t('overview.no_data')
          }
          sub={lastSleep.data ? `${lastSleep.data.location}${lastSleep.data.quality ? ` · ${String(lastSleep.data.quality).replace('_',' ')}` : ''}` : t('overview.tap_to_log')}
          time={lastSleep.data?.start_at ?? null}
          href={`/babies/${babyId}/sleep`}
          badge={lastSleep.data?.end_at == null ? t('overview.live') : undefined}
        />}
        {show('last_stool') && <LastCard
          tint="mint" icon={Droplet}
          label={t('overview.kpi_last_stool')}
          value={lastStool.data ? (lastStool.data.quantity_category ?? '—') : t('overview.no_data')}
          sub={lastStool.data?.color ?? t('overview.tap_to_log')}
          time={lastStool.data?.stool_time ?? null}
          href={`/babies/${babyId}/stool`}
        />}
        {show('todays_summary') && <LastCard
          tint="mint" icon={Droplet}
          label={t('overview.kpi_todays_stool')}
          value={todayStoolCount === 0 ? t('overview.no_data') : t('overview.changes_n', { n: todayStoolCount })}
          sub={todayStoolCount === 0
            ? 'log a diaper'
            : `S ${todayStoolSmall} · M ${todayStoolMedium} · L ${todayStoolLarge}`}
          time={null}
          href={`/babies/${babyId}/stool`}
          badge={todayStoolCount > 0 ? 'today' : undefined}
        />}
        {show('last_dose') && <LastCard
          tint={nextDose?.isOverdue ? 'coral' : 'peach'} icon={Pill}
          label={t('overview.kpi_last_dose')}
          value={nextDose?.name ?? (lastDose.data ? `Last: ${lastDose.data.status}` : 'No doses')}
          sub={
            nextDose?.isOverdue ? `overdue by ${fmtRelative(nextDose.nextAt!).replace(/ ago$/, '')}`
            : nextDose?.nextAt  ? `next ${fmtTime(nextDose.nextAt)}`
            : (lastDose.data    ? fmtRelative(lastDose.data.medication_time) : 'add a prescription')
          }
          time={nextDose?.nextAt ?? lastDose.data?.medication_time ?? null}
          href={`/babies/${babyId}/medications`}
          badge={nextDose?.isOverdue ? 'overdue' : nextDose?.nextAt ? 'next dose' : undefined}
        />}
        {show('last_measurement') && <LastCard
          tint="brand" icon={Scale}
          label={t('overview.kpi_last_measurement')}
          value={lastMeasurement.data?.weight_kg ? fmtKg(lastMeasurement.data.weight_kg) : 'No data'}
          sub={lastMeasurement.data?.height_cm ? `${lastMeasurement.data.height_cm} cm` : t('overview.tap_to_log')}
          time={lastMeasurement.data?.measured_at ?? null}
          href={`/babies/${babyId}/measurements`}
        />}
      </section>

      {/* ═══ GROWTH INSIGHTS STRIP ═══ replaces the old single-line "weekly
            insight" banner. Compares baby to WHO median weight/length, shows
            current/next growth spurt, surfaces the milestone for current age.
            All four cards self-hide when their data is missing. */}
      <GrowthInsights
        babyId={babyId}
        babyName={baby.name}
        ageDays={age}
        sex={baby.gender ?? 'unspecified'}
        // Prefer the per-field "latest non-null weight" row over the
        // current_weight_kg RPC, which can briefly return a stale value
        // on the dashboard right after a weight-only measurement is
        // logged (the RPC reads through a separate query path).
        // lastWeightRow filters .not('weight_kg','is',null) directly.
        weightKg={
          (lastWeightRow.data?.weight_kg as number | null)
            ?? (currentWeight.data as number | null)
            ?? (lastMeasurement.data?.weight_kg as number | null)
            ?? null
        }
        heightCm={(lastHeightRow.data?.height_cm as number | null) ?? null}
        headCm={(lastHeadRow.data?.head_circ_cm as number | null) ?? null}
        lang={userPrefs.language}
      />

      {/* Wave 5 — "Ideas for today" — three age-appropriate developmental
          activities. Same trio for the whole day per profile, rotates at
          midnight. Marked-done state is local to today. */}
      <SuggestionsCard
        babyId={babyId}
        stage="baby"
        marker={age}
        lang={userPrefs.language}
      />

      {/* Milestones reference — typical age windows for the big developmental
            firsts (teething, crawling, walking, words, sentences). Self-hides
            when the parent has unchecked it from dashboard preferences. */}
      {show('milestones_reference') && (
        <MilestoneReferenceCard
          babyId={babyId}
          ageDays={age}
          dobIso={baby.dob ?? null}
          logged={loggedMilestones}
          firstToothFallback={(firstTooth.data?.observed_at as string | undefined) ?? null}
          firstWordFallback={(firstWord.data?.observed_at as string | undefined) ?? null}
          firstSentenceFallback={(firstSentence.data?.observed_at as string | undefined) ?? null}
          lang={userPrefs.language}
        />
      )}

      {/* ═══ MAIN 3-COLUMN GRID ═══ */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* ───── LEFT: Today's Timeline ───── */}
        <Panel
          title={t('overview.todays_timeline')}
          subtitle={fmtDate(day.start)}
          icon={Activity}
          tint="coral"
        >
          {tl.length === 0 ? (
            <EmptyBlock
              icon={ClipboardList}
              title="Nothing logged today"
              body="Use Quick Add at the bottom to log the first activity."
            />
          ) : (
            <ol className="space-y-3">
              {tl.map((it, i) => {
                const isLast = i === tl.length - 1;
                return (
                  <li key={i} className="relative flex gap-3">
                    {/* rail + dot */}
                    <div className="relative flex flex-col items-center">
                      <TimelineDot tint={it.tint} Icon={it.icon} />
                      {!isLast && (
                        <span className="flex-1 w-px my-1 bg-gradient-to-b from-slate-200 to-slate-100" />
                      )}
                    </div>
                    <Link href={it.href} className="flex-1 min-w-0 rounded-xl px-3 py-2 -mx-2 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink-strong text-sm">{it.title}</span>
                        <span className="text-[11px] text-ink-muted whitespace-nowrap">{fmtTime(it.at)}</span>
                      </div>
                      {it.subtitle && <div className="text-xs text-ink-muted truncate mt-0.5">{it.subtitle}</div>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        {/* ───── MIDDLE: Today's Insights ───── */}
        <Panel
          title={t('overview.todays_insights')}
          subtitle="last 7 days"
          icon={TrendingUp}
          tint="mint"
        >
          <div className="grid gap-4 grid-cols-2">
            {/* Total feedings — bar chart */}
            <InsightCell title="Total feedings" tint="coral" big={String(thisWeek)} unit="/ week">
              <BarRow data={feedBars.map(b => b.n)} color="#F4A6A6" />
            </InsightCell>

            {/* Total Sleep — line */}
            <InsightCell
              title="Total sleep"
              tint="lavender"
              big={`${avgSleepHours.toFixed(1)}h`}
              unit="avg / day"
            >
              <Sparkline data={sleepLine.length ? sleepLine : [0]} color="#B9A7D8" height={36} width={140} />
            </InsightCell>

            {/* Stool summary donut */}
            <InsightCell title="Stool summary" tint="mint" full>
              <SummaryDonut
                centerLabel="week"
                centerValue={stoolCounts.small + stoolCounts.medium + stoolCounts.large}
                segments={stoolSegments}
                size={100}
                strokeWidth={11}
              />
            </InsightCell>

            {/* Feeding breakdown donut */}
            <InsightCell title="Feeding breakdown" tint="peach" full>
              {feedSegments.length === 0 ? (
                <div className="text-xs text-ink-muted">no data</div>
              ) : (
                <SummaryDonut
                  centerLabel="week"
                  centerValue={feedSegments.reduce((s, x) => s + x.value, 0)}
                  segments={feedSegments}
                  size={100}
                  strokeWidth={11}
                />
              )}
            </InsightCell>
          </div>
        </Panel>

        {/* ───── RIGHT: Reminders + Growth + OCR CTA ───── */}
        <div className="space-y-4">
          {/* Next appointment — parent/owner only */}
          {(() => {
            const role = (myRole?.data as string | null) ?? null;
            const isParent = role === 'owner' || role === 'parent' || role === 'editor';
            const appt = (nextAppointment?.data as { id: string; doctor_id: string | null; doctor_name: string | null; scheduled_at: string; purpose: string | null; location: string | null; status: string }[] | null)?.[0];
            if (!isParent) return null;
            if (!appt) {
              return (
                <Link href={`/babies/${babyId}/doctors/appointments/new`}
                  className="block rounded-2xl border border-dashed border-lavender-300 bg-lavender-50/40 p-4 hover:bg-lavender-50 transition">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                      <CalendarClock className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink-strong">No upcoming appointment</div>
                      <div className="text-xs text-ink-muted">Tap to book one with your pediatrician.</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-ink-muted" />
                  </div>
                </Link>
              );
            }
            return (
              <Link href={`/babies/${babyId}/doctors/appointments/${appt.id}`}
                className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-500 to-brand-500 text-white p-5 shadow-card hover:shadow-panel transition">
                <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/20 blur-xl" aria-hidden />
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 opacity-90" />
                    <div className="text-xs uppercase tracking-wider opacity-90">{t('overview.next_appointment')}</div>
                  </div>
                  <div className="mt-2 text-xl font-bold leading-tight">{fmtDateTime(appt.scheduled_at)}</div>
                  <div className="text-sm opacity-95 mt-0.5 truncate">
                    {appt.purpose ?? t('overview.appt_visit')}
                    {appt.doctor_name ? ` · ${appt.doctor_name}` : ''}
                  </div>
                  {appt.location && <div className="text-xs opacity-80 truncate mt-0.5">{t('overview.appt_at_loc', { loc: appt.location })}</div>}
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold bg-white/20 rounded-full px-3 py-1">
                    <Stethoscope className="h-3 w-3" /> {t('overview.appt_open')}
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            );
          })()}

          {/* Upcoming reminders */}
          {(() => {
            // The list renders up to 3 meds + all upcoming vaccinations, so the
            // subtitle counts the same thing the user sees.
            const shownMeds = reminders.slice(0, 3).length;
            const vaxCount  = (upcomingVaccines.data ?? []).length;
            const totalShown = shownMeds + vaxCount;
            const subtitle =
              totalShown === 0
                ? t('overview.reminders_no_active')
                : overdueCount > 0
                  ? t('overview.reminders_due_upcoming', { due: overdueCount, up: totalShown - overdueCount })
                  : t('overview.reminders_upcoming', { n: totalShown });
            return (
          <Panel
            title={t('overview.panel_reminders')}
            subtitle={subtitle}
            icon={Bell}
            tint={overdueCount > 0 ? 'coral' : 'peach'}
            compact
          >
            {reminders.length === 0 ? (
              <EmptyBlock
                icon={Pill}
                title={t('overview.reminders_no_meds_title')}
                body={t('overview.reminders_no_meds_body')}
                actionHref={`/babies/${babyId}/medications/new`}
                actionLabel={t('overview.reminders_add_med')}
              />
            ) : (
              <ul className="space-y-2">
                {reminders.slice(0, 3).map(r => (
                  <li key={r.medId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                      r.isOverdue
                        ? 'border-coral-300 bg-coral-50'
                        : 'border-slate-100 bg-white'
                    }`}>
                    <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${
                      r.isOverdue ? 'bg-coral-500 text-white' : 'bg-peach-100 text-peach-700'
                    }`}>
                      <Bell className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-ink-strong truncate">{r.name}</span>
                        {r.isOverdue && (
                          <span className="text-[9px] font-bold uppercase tracking-wider rounded-full bg-coral-500 text-white px-1.5 py-0.5">
                            {t('overview.reminders_due_now')}
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] truncate ${r.isOverdue ? 'text-coral-700 font-medium' : 'text-ink-muted'}`}>
                        {r.nextAt
                          ? (r.isOverdue
                              ? t('overview.reminders_was_due', { when: fmtRelative(r.nextAt) })
                              : t('overview.reminders_next', { when: fmtDateTime(r.nextAt) }))
                          : t('overview.reminders_no_schedule')}
                      </div>
                    </div>
                    <Link href={`/babies/${babyId}/medications/log?m=${r.medId}`}
                      className={`rounded-full text-white text-[11px] px-2.5 py-1 whitespace-nowrap ${
                        r.isOverdue
                          ? 'bg-coral-600 hover:bg-coral-700 font-semibold'
                          : 'bg-lavender-500 hover:bg-lavender-600'
                      }`}>
                      {t('overview.reminders_log_btn')}
                    </Link>
                  </li>
                ))}
                {(upcomingVaccines.data ?? []).map(v => (
                  <li key={v.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2">
                    <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-700 grid place-items-center shrink-0">
                      <Syringe className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-strong truncate">
                        {v.vaccine_name}
                        {v.dose_number && v.total_doses ? <span className="text-ink-muted font-normal"> · {v.dose_number}/{v.total_doses}</span> : null}
                      </div>
                      <div className="text-[11px] text-ink-muted truncate">
                        {v.scheduled_at ? t('overview.reminders_scheduled', { when: fmtDate(v.scheduled_at) }) : t('overview.reminders_tbd')}
                      </div>
                    </div>
                    <Link href={`/babies/${babyId}/vaccinations/${v.id}`} className="text-[11px] text-lavender-700 hover:underline whitespace-nowrap">
                      {t('overview.reminders_open')}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
            );
          })()}

          {/* Growth progress */}
          <Panel
            title={t('overview.panel_growth')}
            subtitle={growthLatest != null ? fmtKg(growthLatest) : t('overview.growth_no_weight_yet')}
            icon={Scale}
            tint="brand"
            compact
          >
            {growthLatest == null ? (
              <EmptyBlock
                icon={Scale}
                title={t('overview.growth_no_history_title')}
                body={t('overview.growth_no_history_body')}
                actionHref={`/babies/${babyId}/measurements/new`}
                actionLabel={t('overview.growth_add_measurement')}
              />
            ) : (
              <div>
                <div className="flex items-end gap-3">
                  <div>
                    <div className="text-2xl font-bold text-ink-strong leading-none">{fmtKg(growthLatest)}</div>
                    <div className="text-[11px] text-ink-muted mt-1">{t('overview.growth_current')}</div>
                  </div>
                  {growthDelta != null && (
                    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${growthDelta >= 0 ? 'bg-mint-100 text-mint-700' : 'bg-peach-100 text-peach-700'}`}>
                      <ArrowUpRight className="h-3 w-3" /> {t('overview.growth_since_birth', { sign: growthDelta >= 0 ? '+' : '', kg: growthDelta.toFixed(2) })}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <Sparkline data={weightPoints} color="#7BAEDC" width={280} height={48} strokeWidth={2.5} />
                </div>
                <Link href={`/babies/${babyId}/measurements`} className="mt-2 inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  View all measurements <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </Panel>

          {/* OCR CTA */}
          <Link href={`/babies/${babyId}/upload`}
            className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-lavender-500 to-brand-500 text-white p-5 shadow-card hover:shadow-panel transition">
            <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/20 blur-xl" aria-hidden />
            <div className="relative flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 grid place-items-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider opacity-80">AI OCR</div>
                <div className="font-bold leading-tight">Scan handwritten notes</div>
                <p className="text-xs opacity-90 mt-1">Photograph your daily notes — Claude extracts feeds, stools and vitals for you.</p>
              </div>
              <ArrowRight className="h-4 w-4 opacity-70" />
            </div>
          </Link>
        </div>
      </section>

      {/* Doctor consultation upsell — same component as cycle + pregnancy
          modes. Positioned just before the sticky quick-add bar so it stays
          discoverable but doesn't dominate the dashboard. */}
      <ConsultationComingSoon stage="baby" />

      {/* ═══ QUICK ADD BAR ═══ */}
      <div className="hidden md:block sticky bottom-4 z-30">
        <div className="rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-panel px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider pl-2 pr-1 whitespace-nowrap">{t('overview.quick_add')}</span>
            <QuickPill href={`/babies/${babyId}/feedings/new`}     icon={Milk}        tint="coral"    label={t('overview.quick_feeding')} />
            <QuickPill href={`/babies/${babyId}/sleep/new`}        icon={Moon}        tint="lavender" label={t('overview.quick_sleep')} />
            <QuickPill href={`/babies/${babyId}/stool/new`}        icon={Droplet}     tint="mint"     label={t('overview.quick_stool')} />
            <QuickPill href={`/babies/${babyId}/medications/log`}  icon={Pill}        tint="lavender" label={t('overview.quick_medication')} />
            <QuickPill href={`/babies/${babyId}/temperature/new`}  icon={Thermometer} tint="peach"    label={t('overview.quick_temperature')} />
            <QuickPill href={`/babies/${babyId}/measurements/new`} icon={Scale}       tint="brand"    label={t('overview.quick_measurement')} />
          </div>
        </div>
      </div>

      {/* ═══ MOBILE FAB ═══ */}
      <Link href={`/babies/${babyId}/feedings/new`}
        className="md:hidden fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-coral-400 to-coral-600 text-white grid place-items-center shadow-panel hover:scale-105 transition"
        aria-label="Log a feeding">
        <Plus className="h-6 w-6" />
      </Link>

      {/* ═══ CAREGIVER NOTES ═══ */}
      <Comments babyId={babyId} target="babies" targetId={babyId}
        scopeDate={focusDate}
        title={`Caregiver notes · ${fmtDate(day.start)}`}
        canPost={((myRole?.data as string | null) === 'owner') || ((myRole?.data as string | null) === 'parent') || ((myRole?.data as string | null) === 'editor') || ((myRole?.data as string | null) === 'doctor')} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Inline presentational helpers
   ───────────────────────────────────────────────────────────── */

function tintClasses(tint: Tint) {
  return {
    coral:    { ring: 'ring-coral-200',    iconBg: 'bg-coral-100 text-coral-600',       grad: 'from-coral-50    to-white' },
    mint:     { ring: 'ring-mint-200',     iconBg: 'bg-mint-100 text-mint-600',         grad: 'from-mint-50     to-white' },
    lavender: { ring: 'ring-lavender-200', iconBg: 'bg-lavender-100 text-lavender-600', grad: 'from-lavender-50 to-white' },
    peach:    { ring: 'ring-peach-200',    iconBg: 'bg-peach-100 text-peach-600',       grad: 'from-peach-50    to-white' },
    brand:    { ring: 'ring-brand-200',    iconBg: 'bg-brand-100 text-brand-600',       grad: 'from-brand-50    to-white' },
  }[tint];
}

/** "Last X" card at the top of the overview — compact, icon, value, sub, time chip. */
function LastCard({
  tint, icon: Icon, label, value, sub, time, href, badge,
}: {
  tint: Tint;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  time: string | null;
  href: string;
  badge?: string;
}) {
  const t = tintClasses(tint);
  return (
    <Link href={href}
      className={`relative group block rounded-2xl bg-gradient-to-br ${t.grad} border border-slate-200/70 hover:shadow-panel transition p-4`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${t.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        {badge ? (
          <span className="rounded-full bg-white/90 text-[10px] font-semibold uppercase tracking-wider text-ink-strong px-2 py-0.5 border border-slate-200">
            {badge}
          </span>
        ) : time ? (
          <span className="text-[10px] text-ink-muted">{fmtRelative(time)}</span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</div>
        <div className="text-base font-bold text-ink-strong leading-tight truncate mt-0.5">{value}</div>
        {sub && <div className="text-[11px] text-ink-muted truncate mt-0.5">{sub}</div>}
      </div>
    </Link>
  );
}

function Panel({
  title, subtitle, icon: Icon, tint, children, compact,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: Tint;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const t = tintClasses(tint);
  return (
    <div className="rounded-2xl bg-white border border-slate-200/70 shadow-card overflow-hidden">
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r ${t.grad}`}>
        <span className={`h-8 w-8 rounded-lg grid place-items-center ${t.iconBg}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-strong text-sm truncate">{title}</div>
          {subtitle && <div className="text-[11px] text-ink-muted truncate">{subtitle}</div>}
        </div>
      </div>
      <div className={compact ? 'p-4' : 'p-5'}>
        {children}
      </div>
    </div>
  );
}

function TimelineDot({ tint, Icon }: { tint: Tint; Icon: React.ComponentType<{ className?: string }> }) {
  const map: Record<Tint, string> = {
    coral: 'bg-coral-500', mint: 'bg-mint-500', lavender: 'bg-lavender-500', peach: 'bg-peach-500', brand: 'bg-brand-500',
  };
  return (
    <span className={`relative mt-1 h-8 w-8 rounded-full grid place-items-center text-white shadow-sm shrink-0 ${map[tint]}`}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

function InsightCell({
  title, tint, big, unit, children, full,
}: {
  title: string;
  tint: Tint;
  big?: string;
  unit?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  const dotColor: Record<Tint, string> = {
    coral: 'bg-coral-500', mint: 'bg-mint-500', lavender: 'bg-lavender-500', peach: 'bg-peach-500', brand: 'bg-brand-500',
  };
  return (
    <div className={`rounded-xl border border-slate-100 bg-white p-3 ${full ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor[tint]}`} />
        <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">{title}</div>
      </div>
      {big && (
        <div className="mt-1 flex items-baseline gap-1">
          <div className="text-lg font-bold text-ink-strong leading-none">{big}</div>
          {unit && <div className="text-[10px] text-ink-muted">{unit}</div>}
        </div>
      )}
      <div className="mt-2">{children}</div>
    </div>
  );
}

function BarRow({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-9">
      {data.map((v, i) => {
        const pct = Math.max(6, (v / max) * 100);
        return (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${pct}%`, background: color, opacity: 0.25 + (v / max) * 0.75 }} />
        );
      })}
    </div>
  );
}

function QuickPill({
  href, icon: Icon, tint, label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tint: Tint;
  label: string;
}) {
  const map: Record<Tint, string> = {
    coral:    'bg-coral-100    text-coral-700    hover:bg-coral-200',
    mint:     'bg-mint-100     text-mint-700     hover:bg-mint-200',
    lavender: 'bg-lavender-100 text-lavender-700 hover:bg-lavender-200',
    peach:    'bg-peach-100    text-peach-700    hover:bg-peach-200',
    brand:    'bg-brand-100    text-brand-700    hover:bg-brand-200',
  };
  return (
    <Link href={href}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${map[tint]}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
}

function EmptyBlock({
  icon: Icon, title, body, actionHref, actionLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="text-center py-6">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-slate-100 text-ink-muted grid place-items-center">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-sm font-semibold text-ink-strong">{title}</div>
      <p className="mt-1 text-xs text-ink-muted max-w-[28ch] mx-auto">{body}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-3 py-1.5">
          {actionLabel} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

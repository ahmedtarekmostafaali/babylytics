// Widget catalog + helpers for the per-user, per-baby dashboard preferences.
// Storage is "hidden_widgets" so a missing row / empty array = show everything.
// See migration 018 for the table.

import type { SupabaseClient } from '@supabase/supabase-js';

export type WidgetScope = 'overview' | 'daily_report' | 'full_report';

export type WidgetDef = {
  id: string;
  label: string;
  description: string;
  group: string;       // UI grouping label
};

// Each scope has its own set. Keep IDs short and stable — they live in DB.
export const OVERVIEW_WIDGETS: WidgetDef[] = [
  // Hero / top
  { id: 'pregnancy_archive_chip', label: 'Pregnancy archive chip',  description: 'Small lavender chip in the hero linking to pregnancy history.', group: 'Header' },
  { id: 'notifications_bell',     label: 'Notifications bell',       description: 'Top-right bell with overdue / low-confidence count.',          group: 'Header' },

  // "Last X" cards row
  { id: 'last_feeding',     label: 'Last feeding',     description: 'Most recent feed, time + amount.',         group: 'Latest activity' },
  { id: 'todays_feedings',  label: "Today's feedings", description: "Total ml + count of today's feeds.",      group: 'Latest activity' },
  { id: 'last_sleep',       label: 'Last sleep',       description: 'Most recent sleep session or live status.', group: 'Latest activity' },
  { id: 'last_stool',       label: 'Last stool',       description: 'Most recent stool size + color.',          group: 'Latest activity' },
  { id: 'last_temp',        label: 'Last temperature', description: 'Most recent reading + method.',            group: 'Latest activity' },
  { id: 'last_dose',        label: 'Last medication',  description: 'Most recent dose status.',                 group: 'Latest activity' },
  { id: 'last_measurement', label: 'Last measurement', description: 'Most recent weight / height / head.',      group: 'Latest activity' },

  // Today summary cards
  { id: 'todays_summary',   label: "Today's summary",  description: 'Donut + key counts for today.',            group: 'Today' },

  // Charts
  { id: 'weekly_feed_chart',  label: 'Weekly feeding chart',  description: '7-day feeding totals bar chart.',           group: 'Trends' },
  { id: 'weekly_sleep_chart', label: 'Weekly sleep chart',    description: '7-day sleep hours bar chart.',              group: 'Trends' },
  { id: 'weight_chart',       label: 'Weight growth chart',   description: 'Sparkline of weight over time.',            group: 'Trends' },
  { id: 'temperature_chart',  label: 'Temperature trend',     description: 'Recent temperature readings.',              group: 'Trends' },

  // Timeline + secondary
  { id: 'timeline',           label: 'Timeline',              description: "Today's events feed.",                      group: 'Activity' },
  { id: 'active_meds',        label: 'Active medications',    description: 'Currently scheduled meds.',                 group: 'Care' },
  { id: 'vaccinations_due',   label: 'Vaccinations due',      description: 'Upcoming or overdue vaccines.',             group: 'Care' },
  { id: 'next_appointment',   label: 'Next appointment',      description: 'Upcoming doctor visit.',                    group: 'Care' },
  { id: 'low_confidence_ocr', label: 'Smart Scan attention',  description: 'Items needing review.',                     group: 'Care' },
  { id: 'comments',           label: 'Comments',              description: 'Notes from caregivers and doctors.',        group: 'Care' },
];

export const DAILY_REPORT_WIDGETS: WidgetDef[] = [
  { id: 'kpi_feeds',          label: 'Feeds total + count',   description: 'Total ml fed + count + average.',            group: 'KPIs' },
  { id: 'kpi_target',         label: 'Daily target',          description: 'Recommended ml/day based on weight.',        group: 'KPIs' },
  { id: 'kpi_feeding_pct',    label: 'Feeding % + remaining', description: '% of daily target hit + ml left.',           group: 'KPIs' },
  { id: 'kpi_stools',         label: 'Stools',                description: 'Stool count + total volume.',                group: 'KPIs' },
  { id: 'kpi_doses',          label: 'Medication doses',      description: 'Doses taken / expected + adherence.',        group: 'KPIs' },
  { id: 'kpi_temperature',    label: 'Temperature',           description: 'Today\'s peak + average.',                   group: 'KPIs' },
  { id: 'kpi_vaccinations',   label: 'Vaccinations today',    description: 'Vaccines administered today.',               group: 'KPIs' },
  { id: 'kpi_measurements',   label: 'Measurements today',    description: 'Weight / height / head logged today.',       group: 'KPIs' },

  { id: 'feed_log',           label: 'Feeds detail',          description: 'List of every feed today.',                   group: 'Logs' },
  { id: 'stool_log',          label: 'Stool detail',          description: 'List of every stool today.',                  group: 'Logs' },
  { id: 'sleep_log',          label: 'Sleep detail',          description: 'Every sleep session today.',                  group: 'Logs' },
  { id: 'med_log',            label: 'Medications detail',    description: 'Every dose today.',                           group: 'Logs' },
  { id: 'temp_log',           label: 'Temperature detail',    description: 'Every reading today.',                        group: 'Logs' },
  { id: 'vax_log',            label: 'Vaccinations detail',   description: 'Every vaccine today.',                        group: 'Logs' },

  { id: 'comments',           label: 'Comments',              description: 'Notes scoped to this day.',                   group: 'Notes' },
];

export const FULL_REPORT_WIDGETS: WidgetDef[] = [
  { id: 'kpi_feeds',          label: 'Feeds aggregate',       description: 'Total ml + count + average for the range.',  group: 'KPIs' },
  { id: 'kpi_target',         label: 'Recommended (daily)',   description: 'Daily ml target.',                            group: 'KPIs' },
  { id: 'kpi_feeding_pct',    label: 'Feeding %',             description: 'Average daily target hit.',                  group: 'KPIs' },
  { id: 'kpi_stools',         label: 'Stools aggregate',      description: 'Stool count + size breakdown.',              group: 'KPIs' },
  { id: 'kpi_doses',          label: 'Doses aggregate',       description: 'Total doses + missed.',                       group: 'KPIs' },
  { id: 'kpi_adherence',      label: 'Medication adherence',  description: 'Adherence percentage.',                       group: 'KPIs' },
  { id: 'kpi_weighings',      label: 'Weighings count',       description: 'Number of measurements logged.',              group: 'KPIs' },
  { id: 'kpi_files',          label: 'Files uploaded',        description: 'Smart Scan + archive uploads.',               group: 'KPIs' },

  { id: 'weight_chart',       label: 'Weight growth chart',   description: 'Weight over the range.',                      group: 'Charts' },
  { id: 'feeding_chart',      label: 'Feeding chart',         description: 'Feeds over the range.',                       group: 'Charts' },
  { id: 'stool_chart',        label: 'Stool chart',           description: 'Stool count by day.',                         group: 'Charts' },

  { id: 'feed_log',           label: 'Feeds log',             description: 'Full list of feeds in range.',                group: 'Logs' },
  { id: 'stool_log',          label: 'Stool log',             description: 'Full list of stools in range.',               group: 'Logs' },
  { id: 'med_log',            label: 'Medications log',       description: 'Full list of doses in range.',                group: 'Logs' },
  { id: 'measurement_log',    label: 'Measurements log',      description: 'Every weighing / height check.',              group: 'Logs' },
  { id: 'temp_log',           label: 'Temperature log',       description: 'Every reading.',                              group: 'Logs' },
  { id: 'vax_log',            label: 'Vaccinations log',      description: 'Every vaccine.',                              group: 'Logs' },

  { id: 'files_section',      label: 'Recent files',          description: 'Smart Scan uploads in range.',                group: 'Files' },
  { id: 'comments',           label: 'Comments',              description: 'All caregiver / doctor notes.',               group: 'Notes' },
];

export function widgetCatalog(scope: WidgetScope): WidgetDef[] {
  if (scope === 'overview')      return OVERVIEW_WIDGETS;
  if (scope === 'daily_report')  return DAILY_REPORT_WIDGETS;
  return FULL_REPORT_WIDGETS;
}

/** Load hidden widget IDs for the current user, for the given baby + scope. */
export async function loadHiddenWidgets(
  supabase: SupabaseClient,
  babyId: string,
  scope: WidgetScope,
): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();
  const { data } = await supabase.from('dashboard_preferences')
    .select('hidden_widgets')
    .eq('user_id', user.id)
    .eq('baby_id', babyId)
    .eq('scope', scope)
    .maybeSingle();
  const arr = (data?.hidden_widgets as string[] | undefined) ?? [];
  return new Set(arr);
}

/** Convenience: returns true when widget should render. */
export function showWidget(hidden: Set<string>, id: string): boolean {
  return !hidden.has(id);
}

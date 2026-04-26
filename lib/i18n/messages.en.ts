// English copy for the app shell + recurring strings. Per-page body copy
// gets translated incrementally in follow-up batches; for now the most
// visible pieces (sidebar, page headers, common buttons, form labels)
// flow through this dictionary.
export const en = {
  // ── App shell / nav ─────────────────────────────────────────────
  app: {
    name: 'Babylytics',
    tagline: 'Care, captured.',
  },
  nav: {
    my_babies: 'My babies',
    overview: 'Overview',
    add_baby: 'Add baby',
    sign_out: 'Sign out',

    // Categories
    cat_overview: 'Overview',
    cat_vital_signs: 'Vital signs',
    cat_care: 'Care',
    cat_development: 'Development',
    cat_records: 'Records',
    cat_family: 'Family',

    feedings: 'Feedings',
    stool: 'Stool',
    sleep: 'Sleep',
    temperature: 'Temperature',
    measurements: 'Measurements',

    medications: 'Medications',
    vaccinations: 'Vaccinations',
    appointments: 'Appointments',
    labs_scans: 'Labs & Scans',

    activities: 'Activities',
    teething: 'Teething',
    speaking: 'Speaking',
    screen_time: 'Screen time',

    files: 'Smart Scan',
    medical_profile: 'Medical profile',
    reports: 'Reports',
    shopping: 'Shopping list',

    caregivers: 'Caregivers',
    doctors: 'Doctors',
    preferences: 'Preferences',
  },

  // ── Common buttons / words ──────────────────────────────────────
  common: {
    save: 'Save',
    save_changes: 'Save changes',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    next: 'Next',
    yes: 'Yes',
    no: 'No',
    today: 'Today',
    yesterday: 'Yesterday',
    loading: 'Loading…',
    saving: 'Saving…',
    no_data: 'No data',
    optional: 'optional',
    required: 'required',
    notes: 'Notes',
    when: 'When?',
    now: 'Now',
  },

  // ── Preferences page ────────────────────────────────────────────
  prefs: {
    title: 'Preferences',
    subtitle: 'Language, region, units, and how you want to be notified.',
    language: 'Language',
    language_en: 'English',
    language_ar: 'العربية',
    country: 'Country',
    timezone: 'Timezone',
    time_format: 'Time format',
    time_12h: '12-hour (3:45 PM)',
    time_24h: '24-hour (15:45)',
    units: 'Units',
    units_metric: 'Metric (kg, cm, °C, ml)',
    units_imperial: 'Imperial (lb, in, °F, fl oz)',
    notifications: 'Notifications',
    whatsapp_number: 'WhatsApp number (E.164)',
    whatsapp_help: 'Include country code, e.g. +201234567890.',
    whatsapp_optin: 'Send medication reminders to WhatsApp',
    saved: 'Preferences saved.',
  },

  // ── Baby overview (most-visible page) ────────────────────────────
  overview: {
    greet_morning:   'Good morning',
    greet_afternoon: 'Good afternoon',
    greet_evening:   'Good evening',
    greet_night:     'Good night',

    days_old: '{n} days old',
    male:     'male',
    female:   'female',

    dose_due_now: 'medication dose due now',
    doses_due_now: '{n} medication doses due now',
    dose_due_sub: "Log them as taken, missed, or skipped — they're past the scheduled time.",
    log_med:      'Log {name}',

    // KPI tile labels (top of overview)
    kpi_last_feeding:    'Last feeding',
    kpi_todays_feedings: "Today's feedings",
    kpi_feeding_pct:     'Feeding %',
    kpi_feed_pace:       'Feed pace',
    kpi_last_sleep:      'Last sleep',
    kpi_last_stool:      'Last stool',
    kpi_todays_stool:    "Today's stool",
    kpi_last_temp:       'Last temperature',
    kpi_last_dose:       'Medications',
    kpi_last_measurement:'Measurements',

    // Sub-labels
    tap_to_log:        'tap to log',
    today_so_far:      'Today so far',
    seven_day_avg:     '7-day avg',
    today_so_far_avg:  'Today so far · 7-day avg',
    feeds_n:           '{n} feeds',
    changes_n:         '{n} changes',
    ml_left_to_goal:   '{ml} ml left to goal',
    goal_hit:          'goal hit',
    no_data:           'No data',
    in_progress:       'In progress',
    live:              'live',
    today:             'today',

    // Sections + chips
    growth_insights:        'Growth insights',
    vs_who_standards:       'vs WHO standards',
    log_measurement:        'Log measurement',
    todays_timeline:        "Today's timeline",
    todays_insights:        "Today's insights",

    // Card mini-labels
    median_short: 'Median',
    min_short:    'min',
    on_track:     'on track',
    above_median: 'above median',
    below_median: 'below median',
    below_who_min:'below WHO min — talk to pediatrician',

    // Quick add bar
    quick_add:        'QUICK ADD',
    quick_feeding:    'Feeding',
    quick_sleep:      'Sleep',
    quick_stool:      'Stool',
    quick_medication: 'Medication',
    quick_temperature:'Temperature',
    quick_measurement:'Measurement',
  },

  // ── Auth ────────────────────────────────────────────────────────
  auth: {
    sign_in: 'Sign in',
    sign_up: 'Sign up',
    email: 'Email',
    password: 'Password',
    forgot: 'Forgot password?',
  },
};

export type Messages = typeof en;

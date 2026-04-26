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

  // ── Growth Insights strip ────────────────────────────────────────
  growth: {
    title:                'Growth insights',
    vs_who:               'vs WHO standards',
    log_measurement:      'Log measurement',
    weight:               'Weight',
    length_height:        'Length / height',
    growth_spurt_now:     'Growth spurt now',
    growth_spurt_soon:    'Growth spurt soon',
    next_growth_spurt:    'Next growth spurt',
    median:               'Median',
    min:                  'min',
    median_for_age:       'Median for age',
    no_reference_yet:     'No reference yet for this age',
    log_weight_to_see:    'Log a weight to see {first} vs WHO standards.',
    log_height_to_see:    'Log a height to see {first} vs WHO standards.',
    head:                 'Head',
    on_track:             'on track',
    above_median:         'above median',
    below_median:         'below median',
    below_who_min:        'below WHO min — talk to pediatrician',
    days_away:            '~{n} day{s} away',
    days_since_last:      '{n} days since the last one',
    milestones:           'Milestones',
    watch_for:            'Watch for',
    age_label:            'Age',
  },

  // ── Feed pace card ───────────────────────────────────────────────
  feedpace: {
    title:           'Feed pace',
    today_so_far:    'Today so far',
    seven_day_avg:   '7-day avg',
    by_time:         'by {time}',
    baseline_forming:'Baseline forming…',
    on_pace:         'on pace',
    ahead:           '+{ml} ({pct}%) ahead',
    behind:          '{ml} ({pct}%) behind',
  },

  // ── Milestone reference card ─────────────────────────────────────
  milestones_ref: {
    title:           'Milestone reference',
    log:             'Log',
    intro:           'Typical age window (min · avg · max). Wide variation is normal — these are reference points, not a scoreboard.',
    state_early:     'early',
    state_on_time:   'on time',
    state_late:      'late',
    state_overdue:   'watch',
    state_pending:   'pending',
    logged_at:       'logged @ {months}m',
    label_first_tooth:    'First tooth',
    label_crawling:       'Crawling',
    label_first_words:    'First words',
    label_walking:        'Walking',
    label_last_tooth:     'Full primary set',
    label_first_sentence: 'First sentences',
  },

  // ── Page chrome / shared list-page bits ──────────────────────────
  page: {
    overview:      'Overview',
    back:          'Back',
    add:           'Add',
    edit:          'Edit',
    read_only:     'Read-only',
    no_in_window:  'Nothing in this window.',
    showing_recent_500: 'Showing most recent 500 entries. Narrow the range to see more.',
    page_comments: 'Page comments',
    track_eyebrow: 'Track',
    care_eyebrow:  'Care',
    log_eyebrow:   'Log',
  },

  // ── Tracker list pages (feedings, stool, sleep, etc.) ────────────
  trackers: {
    // Range filter
    range_24h:    'Last 24h',
    range_7d:     '7 days',
    range_30d:    '30 days',
    range_90d:    '90 days',
    range_custom: 'Custom',
    range_from:   'From',
    range_to:     'To',
    range_apply:  'Apply',
    // Page-shell strings shared across every tracker
    log_eyebrow:  'Log',
    add_eyebrow:  'Add',
    edit_eyebrow: 'Edit',
    track_eyebrow:'Track',
    no_in_window: 'Nothing in this window.',
    no_X_in_window: 'No {what} in this window.',
    today_kw:     'Today',
    yesterday_kw: 'Yesterday',
    pick_to_see:  'Pick an item from the list to see details.',
    logged_on:    'Logged on',
    notes_label:  'Notes',
    // CTAs
    cta_log:      'Log {what}',
    cta_add:      'Add {what}',
    bulk_delete:  'Bulk delete',

    // Per-tracker titles + subtitles
    feedings_title: 'Feedings',
    feedings_sub:   'All recorded feeds.',
    feedings_cta:   'Log feeding',
    feeding_label:  'Feeding',
    feed_count_n:   '{n} feeds',
    feed_total:     'Total',

    stool_title:    'Stool',
    stool_sub:      'All recorded diaper changes.',
    stool_cta:      'Log stool',
    stool_label:    'Stool',

    sleep_title:    'Sleep',
    sleep_sub:      'Naps, nights, and ongoing sessions.',
    sleep_cta:      'Log sleep',
    sleep_label:    'Sleep',

    temp_title:     'Temperature',
    temp_sub:       'Every reading.',
    temp_cta:       'Log temperature',
    temp_label:     'Temperature',

    meas_title:     'Measurements',
    meas_sub:       'Weight, height, head circumference.',
    meas_cta:       'Log measurement',
    meas_label:     'Measurement',

    meds_title:     'Medications',
    meds_sub:       'Active prescriptions and dose log.',
    meds_cta:       'Add medication',
    meds_log_cta:   'Log a dose',

    vax_title:      'Vaccinations',
    vax_sub:        'Schedule and history.',
    vax_cta:        'Add vaccination',

    activities_title: 'Activities',
    activities_sub:   'All recorded activity sessions.',
    activities_cta:   'Log activity',

    teething_title: 'Teething',
    teething_sub:   'Eruptions, pain, soothing — what worked and when.',
    teething_cta:   'Log teething',

    speaking_title: 'Speaking',
    speaking_sub:   'Coos, babbles, words, sentences.',
    speaking_cta:   'Log speech',

    screen_title:   'Screen time',
    screen_sub:     'Daily screen exposure.',
    screen_cta:     'Log screen time',

    labs_title:     'Labs & Scans',
    labs_sub:       'Blood, urine, stool, cultures, X-ray, ultrasound, MRI, CT — all in one place.',
    labs_cta:       'Add lab or scan',
  },

  // ── Forms / FormKit primitives ───────────────────────────────────
  forms: {
    // Shared
    optional:        'optional',
    required:        'required',
    notes:           'Notes',
    when:            'When?',
    now:             'Now',
    pick_time:       'Pick a time',
    exact_time:      'Exact time',
    minus_15_min:    '−15 min',
    minus_30_min:    '−30 min',
    minus_1_hr:      '−1 hr',
    save:            'Save',
    save_changes:    'Save changes',
    saving:          'Saving…',
    delete:          'Delete',
    add_more:        'Add more',
    fast_log:        'Takes less than 2 seconds',

    // Feeding
    feed_what:       'What was fed?',
    feed_quantity:   'Quantity (ml)',
    feed_duration:   'Duration (min)',
    feed_kcal:       'Calories (kcal)',
    feed_breast:     'Breast',
    feed_formula:    'Formula',
    feed_mixed:      'Mixed',
    feed_solid:      'Solid',
    feed_other:      'Other',
    feed_log_cta:    'Log feeding',
    feed_save_cta:   'Save feeding',

    // Stool
    stool_size:      'Size',
    stool_small:     'Small',
    stool_medium:    'Medium',
    stool_large:     'Large',
    stool_color:     'Color',
    stool_consistency:'Consistency',
    stool_diaper_rash:'Diaper rash',
    stool_log_cta:   'Log stool',

    // Sleep
    sleep_started_at:'Started at',
    sleep_ended_at:  'Ended at',
    sleep_ongoing:   'Still sleeping',
    sleep_location:  'Location',
    sleep_quality:   'Quality',
    sleep_log_cta:   'Log sleep',

    // Temperature
    temp_value:      'Temperature (°C)',
    temp_method:     'Method',
    temp_log_cta:    'Log reading',

    // Measurement
    meas_weight:     'Weight (kg)',
    meas_height:     'Height (cm)',
    meas_head:       'Head circumference (cm)',
    meas_log_cta:    'Save measurement',

    // Medication (definition)
    med_name:        'Medication name',
    med_dosage:      'Dosage per dose',
    med_route:       'How is it given?',
    med_frequency:   'How often?',
    med_starts_at:   'Starts',
    med_ends_at:     'Ends (optional)',
    med_total_doses: 'Total doses (optional)',
    med_prescribed_by:'Who prescribed it?',
    med_save_cta:    'Save medication',

    // Medication log (dose)
    medlog_pick_med: 'Pick a medication',
    medlog_status:   'Status',
    medlog_taken:    'Taken',
    medlog_missed:   'Missed',
    medlog_skipped:  'Skipped',
    medlog_actual_dose:'Actual dose given',
    medlog_log_cta:  'Log dose',
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

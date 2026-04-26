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

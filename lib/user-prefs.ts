// Reads (and writes) the per-user preferences row that backs the Preferences
// page, the i18n shell, and the unit/time formatters. Falls back to sensible
// Egyptian defaults so the app behaves identically for users who have never
// opened the Preferences page.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Lang } from '@/lib/i18n';

export type TimeFormat = '12h' | '24h';
export type UnitSystem = 'metric' | 'imperial';

export type UserPrefs = {
  language: Lang;
  country: string;        // ISO alpha-2
  timezone: string;       // IANA tz, e.g. "Africa/Cairo"
  time_format: TimeFormat;
  unit_system: UnitSystem;
  whatsapp_e164: string | null;
  whatsapp_optin: boolean;
};

export const DEFAULT_PREFS: UserPrefs = {
  language: 'en',
  country: 'EG',
  timezone: 'Africa/Cairo',
  time_format: '12h',
  unit_system: 'metric',
  whatsapp_e164: null,
  whatsapp_optin: false,
};

/** Load the current user's preferences. Returns DEFAULT_PREFS when no row exists. */
export async function loadUserPrefs(supabase: SupabaseClient): Promise<UserPrefs> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;

  const { data } = await supabase.from('user_preferences')
    .select('language,country,timezone,time_format,unit_system,whatsapp_e164,whatsapp_optin')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data) return DEFAULT_PREFS;
  return {
    language:       (data.language       as Lang)       ?? DEFAULT_PREFS.language,
    country:        (data.country        as string)     ?? DEFAULT_PREFS.country,
    timezone:       (data.timezone       as string)     ?? DEFAULT_PREFS.timezone,
    time_format:    (data.time_format    as TimeFormat) ?? DEFAULT_PREFS.time_format,
    unit_system:    (data.unit_system    as UnitSystem) ?? DEFAULT_PREFS.unit_system,
    whatsapp_e164:  (data.whatsapp_e164  as string | null) ?? null,
    whatsapp_optin: Boolean(data.whatsapp_optin),
  };
}

export async function saveUserPrefs(
  supabase: SupabaseClient,
  patch: Partial<UserPrefs>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const row = {
    user_id: user.id,
    ...patch,
  };

  const { error } = await supabase.from('user_preferences')
    .upsert(row, { onConflict: 'user_id' });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Common picklists for the Preferences page. Kept intentionally short — these
// are the regions our pilot users actually care about. Add more as we grow.
// ────────────────────────────────────────────────────────────────────────────

export const COUNTRY_OPTIONS: { code: string; label_en: string; label_ar: string; default_tz: string }[] = [
  { code: 'EG', label_en: 'Egypt',                   label_ar: 'مصر',                       default_tz: 'Africa/Cairo'         },
  { code: 'SA', label_en: 'Saudi Arabia',            label_ar: 'المملكة العربية السعودية', default_tz: 'Asia/Riyadh'          },
  { code: 'AE', label_en: 'United Arab Emirates',    label_ar: 'الإمارات العربية المتحدة', default_tz: 'Asia/Dubai'           },
  { code: 'KW', label_en: 'Kuwait',                  label_ar: 'الكويت',                    default_tz: 'Asia/Kuwait'          },
  { code: 'QA', label_en: 'Qatar',                   label_ar: 'قطر',                       default_tz: 'Asia/Qatar'           },
  { code: 'JO', label_en: 'Jordan',                  label_ar: 'الأردن',                    default_tz: 'Asia/Amman'           },
  { code: 'LB', label_en: 'Lebanon',                 label_ar: 'لبنان',                     default_tz: 'Asia/Beirut'          },
  { code: 'MA', label_en: 'Morocco',                 label_ar: 'المغرب',                    default_tz: 'Africa/Casablanca'    },
  { code: 'GB', label_en: 'United Kingdom',          label_ar: 'المملكة المتحدة',           default_tz: 'Europe/London'        },
  { code: 'US', label_en: 'United States',           label_ar: 'الولايات المتحدة',          default_tz: 'America/New_York'     },
  { code: 'CA', label_en: 'Canada',                  label_ar: 'كندا',                      default_tz: 'America/Toronto'      },
  { code: 'DE', label_en: 'Germany',                 label_ar: 'ألمانيا',                   default_tz: 'Europe/Berlin'        },
  { code: 'FR', label_en: 'France',                  label_ar: 'فرنسا',                     default_tz: 'Europe/Paris'         },
];

export const TIMEZONE_OPTIONS: string[] = [
  'Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar',
  'Asia/Amman', 'Asia/Beirut', 'Africa/Casablanca',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'UTC',
];

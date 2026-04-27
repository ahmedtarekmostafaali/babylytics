-- 034: Voice commander — bilingual (English + Egyptian Arabic) voice
-- logging via the browser's native Web Speech API. UI-only feature, no
-- new tables — voice writes go to the same feedings / stool_logs /
-- sleep_logs / temperature_logs / fetal_movements / comments tables as
-- the manual forms (and the same RLS + audit triggers apply).

select public.publish_app_update(
  'Voice logging — speak to log feedings, sleep, diapers and more',
  'Tap the new mic icon next to the bell on any baby dashboard, then speak. Examples: "log a feeding 120 ml bottle", "diaper change large", "nap 45 minutes", "temperature 37.5", "kick". Egyptian Arabic also works — try «سجّل رضعة ١٢٠ مل زجاجة» or «نام ٤٥ دقيقة». Babylytics parses what it heard and shows a confirm card before anything is saved — no surprises. Works in Chrome, Edge and Safari (Web Speech API).',
  'new_feature'
);

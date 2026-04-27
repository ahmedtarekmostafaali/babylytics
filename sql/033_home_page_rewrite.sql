-- 033: Home page rewrite — comprehensive feature showcase. Pure UI / copy
-- change, no schema modifications. Just publishes the changelog entry.

select public.publish_app_update(
  'New home page with the full feature catalog',
  'The babylytics.org landing page is rewritten. New: a four-stage timeline (pregnancy → newborn → infant → toddler), a categorised feature grid (vital signs / care / pregnancy / development), a pregnancy spotlight with a daily fetal-size mockup and IOM weight-gain band, a family-and-roles section showing the per-record audit trail and caregiver feed, and a "What''s new" strip linked to /updates. Smart Scan, bilingual EN/AR, and WhatsApp dose reminders now have their own callouts.',
  'enhancement'
);

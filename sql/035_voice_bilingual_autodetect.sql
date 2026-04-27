-- 035: Voice commander now auto-detects English and Arabic in the same
-- session, regardless of UI language preference. Pure UI/copy change —
-- no schema modifications.

select public.publish_app_update(
  'Voice logging is now bilingual — auto-detects EN and AR',
  'You no longer need to switch your app language to log by voice in the other language. Babylytics runs both English and Arabic intent parsers against every transcript and uses whichever matches. The voice modal now has its own EN / ع toggle for the speech-recognition engine (independent of the app language) and shows a small "EN detected" / "AR detected" tag on the heard text so you know which grammar was used. Examples for both languages are shown side-by-side.',
  'enhancement'
);

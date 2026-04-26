# whatsapp-dose-reminder

Sends a WhatsApp message via Twilio for every baby medication dose that comes
due in the next 15 minutes for a caregiver who has opted in on the
Preferences page.

## One-time Twilio setup

1. **Create a Twilio account** at https://twilio.com (free trial includes
   WhatsApp sandbox credit).
2. **Activate the WhatsApp sandbox**: Console → Messaging → Try it out →
   Send a WhatsApp message. Each test recipient must `join <sandbox-code>`
   from their phone before they can receive messages.
3. **Note the credentials**:
   - Account SID (`ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - Auth Token
   - Sandbox From number (`whatsapp:+14155238886` for the global sandbox).

For production:
4. Apply for a **Twilio Approved WhatsApp Sender** (a real phone number tied
   to your business). Replace `TWILIO_WHATSAPP_FROM` once approved.
5. Create a **WhatsApp message template** for medication reminders if you
   want to message users outside the 24-hour Twilio session window.

## Set the secrets

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=********************************
supabase secrets set TWILIO_WHATSAPP_FROM='whatsapp:+14155238886'
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

## Deploy

```bash
supabase functions deploy whatsapp-dose-reminder
```

## Schedule

Pick one of:

### A. Supabase Scheduled Functions (recommended)

In the Supabase dashboard: Edge Functions → whatsapp-dose-reminder → Schedule.
Set to every 5 minutes.

### B. pg_cron (alternative)

```sql
select cron.schedule(
  'whatsapp_dose_reminder',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-PROJECT-REF.functions.supabase.co/whatsapp-dose-reminder',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'))
  );
  $$
);
```

(Requires the `pg_cron` and `pg_net` extensions, both available in Supabase.)

## Per-user opt-in

Each user enters their WhatsApp number on `/preferences` (E.164 format, e.g.
`+201234567890`) and ticks "Send medication reminders to WhatsApp". The
function only messages users who have BOTH a number AND `whatsapp_optin=true`
AND a parent/caregiver/owner role on the baby.

## Audit

Every send (success or failure) is recorded in `public.whatsapp_outbox`. RLS
restricts each user to seeing only their own rows. Surface this as a UI panel
later if desired.

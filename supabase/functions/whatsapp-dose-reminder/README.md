# whatsapp-dose-reminder

Sends a WhatsApp message via Twilio for every baby medication dose that comes
due in the next 15 minutes for a caregiver who has opted in on the
Preferences page.

The function operates in two modes, controlled by the `TWILIO_CONTENT_SID`
secret:

- **Production mode** (`TWILIO_CONTENT_SID` is set) — sends an approved
  Meta WhatsApp Content Template. Required to message any opted-in user
  without them sending a sandbox join code first.
- **Sandbox / dev mode** (`TWILIO_CONTENT_SID` is empty) — sends free-form
  message bodies. Only delivers to recipients who have joined the Twilio
  WhatsApp sandbox by sending its join code from their phone.

## Production setup (recommended for real users)

### 1. Prerequisites

- **Facebook Business Manager** at https://business.facebook.com — must be
  verified (Business Verification under Security Center). This is the
  longest single step; allow several business days.
- **A phone number that has NEVER been used on personal WhatsApp.** Either
  a fresh telco line or a Twilio number with WhatsApp capability
  (Twilio Console → Phone Numbers → Buy a Number → filter "WhatsApp").

### 2. Apply for a WhatsApp sender in Twilio

Twilio Console → Messaging → Senders → WhatsApp senders → Create new sender.

Pick **Self sign-up**, enter the phone number, choose a display name
(e.g. "Babylytics"), connect your Facebook Business Manager, submit.
Approval normally takes 24–72 hours.

### 3. Submit the medication-reminder template

Twilio Console → Messaging → Content Template Builder → Create new.

- **Name:** `medication_reminder_v1`
- **Language:** English (submit Arabic separately if you want both)
- **Category:** Utility
- **Body:**
  ```
  🩺 {{1}} — medication reminder
  {{2}} · {{3}}
  Due at {{4}} (Cairo time).
  Reply DONE in the app once given. — Babylytics
  ```
- **Sample values:** `Yousef`, `Augmentin`, `5 ml`, `7:30 PM`

After Meta approves (usually <24h for Utility), copy the **ContentSid** —
it starts with `HX...` and is ~34 chars.

### 4. Set the secrets

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
supabase secrets set TWILIO_AUTH_TOKEN=********************************
supabase secrets set TWILIO_WHATSAPP_FROM='whatsapp:+1XXXXXXXXXX'      # your approved sender
supabase secrets set TWILIO_CONTENT_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

### 5. Deploy

```bash
supabase functions deploy whatsapp-dose-reminder
```

### 6. Schedule

Pick one:

**A. Supabase Scheduled Functions (recommended)**

Supabase dashboard → Edge Functions → whatsapp-dose-reminder →
Cron Jobs → Add cron job. Schedule `*/5 * * * *`, method POST.

**B. pg_cron**

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

### 7. Per-user opt-in

Each user enters their WhatsApp number on `/preferences` (E.164 format,
e.g. `+201234567890`) and ticks "Send medication reminders to WhatsApp".
The function only messages users who have BOTH a number AND
`whatsapp_optin = true` AND a parent/caregiver/owner role on the baby.

That checkbox is the opt-in record Meta requires you keep on file. Don't
remove it.

### 8. Compliance notes

- **Templates only**, outside a 24h user-initiated session window.
  Anything ad-hoc (re-running the same dose, support replies) only works
  if the user messaged you in the last 24h.
- **Pricing** (Meta utility template, Egypt destinations as of mid-2025):
  ~$0.04 per delivered message. Other markets vary; check
  https://www.twilio.com/whatsapp/pricing for current rates.
- **Don't send marketing** through this template — Meta categorises it as
  Utility and a misuse can suspend the sender. Marketing needs a separate
  Marketing-category template.
- **Number recycling:** if a recipient's WhatsApp number is later reassigned
  to someone else, you'll keep messaging the new owner unless they tell
  you to stop. Provide an in-app way to clear the number — `/preferences`
  already lets users blank it.

## Sandbox / dev mode

For local testing without going through Meta approval:

1. Twilio Console → Messaging → Try it out → Send a WhatsApp message.
2. Note the sandbox From number and the join code (e.g. `join sunny-tiger`).
3. Each test recipient sends the join code from their WhatsApp to the
   sandbox number.
4. Set the secrets, **leaving `TWILIO_CONTENT_SID` unset**:
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=AC...
   supabase secrets set TWILIO_AUTH_TOKEN=...
   supabase secrets set TWILIO_WHATSAPP_FROM='whatsapp:+14155238886'
   supabase secrets unset TWILIO_CONTENT_SID
   ```
5. Deploy + schedule as in steps 5–6 above.

The function detects the missing `TWILIO_CONTENT_SID` and falls back to
free-form `Body=` sends, which work inside the sandbox.

## Audit

Every send (success or failure) is recorded in `public.whatsapp_outbox`.
RLS restricts each user to their own rows. To inspect:

```sql
select status, error, sent_at, body
  from whatsapp_outbox
 order by created_at desc
 limit 50;
```

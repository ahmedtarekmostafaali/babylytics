// Supabase Edge Function: whatsapp-dose-reminder
// Schedules: invoke every 5 minutes via pg_cron (see migration 025) or
// Supabase scheduled functions. Each invocation:
//   1. Calls the SQL function `pending_med_reminders` to find dose tuples
//      that need a WhatsApp message inside the lookahead window.
//   2. Inserts a row in `whatsapp_outbox` with status='queued' (ON CONFLICT
//      DO NOTHING handles duplicate runs).
//   3. POSTs to Twilio's WhatsApp endpoint with the rendered message body.
//   4. Updates the outbox row to 'sent' (with twilio_sid) or 'failed' with
//      the error message.
//
// Required env vars (set with `supabase secrets set …`):
//   SUPABASE_URL                  – auto-populated in the function runtime
//   SUPABASE_SERVICE_ROLE_KEY     – auto-populated in the function runtime
//   TWILIO_ACCOUNT_SID            – Twilio account SID (starts with AC…)
//   TWILIO_AUTH_TOKEN             – Twilio auth token
//   TWILIO_WHATSAPP_FROM          – Sender, e.g. "whatsapp:+14155238886" (sandbox)
//                                   or your own approved business number.
//
// Local dev:  `supabase functions serve whatsapp-dose-reminder --no-verify-jwt`
// Deploy:     `supabase functions deploy whatsapp-dose-reminder`

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_ACCOUNT_SID        = Deno.env.get('TWILIO_ACCOUNT_SID')!;
const TWILIO_AUTH_TOKEN         = Deno.env.get('TWILIO_AUTH_TOKEN')!;
const TWILIO_WHATSAPP_FROM      = Deno.env.get('TWILIO_WHATSAPP_FROM')!;

type PendingRow = {
  medication_id: string;
  baby_id: string;
  user_id: string;
  e164: string;
  baby_name: string;
  med_name: string;
  med_dosage: string | null;
  scheduled_for: string;          // ISO
};

function fmtTimeCairo(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

function renderBody(r: PendingRow): string {
  const dose = r.med_dosage ? ` · ${r.med_dosage}` : '';
  return [
    `🩺 ${r.baby_name} — medication reminder`,
    `${r.med_name}${dose}`,
    `Due at ${fmtTimeCairo(r.scheduled_for)} (Cairo time).`,
    '',
    'Reply DONE in the app once given. — Babylytics',
  ].join('\n');
}

async function sendTwilio(to: string, body: string): Promise<{ ok: true; sid: string } | { ok: false; error: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To:   to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    Body: body,
  });
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization':  `Basic ${auth}`,
      'Content-Type':   'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 400)}` };
  try {
    const json = JSON.parse(text);
    return { ok: true, sid: json.sid };
  } catch {
    return { ok: false, error: `Bad Twilio response: ${text.slice(0, 400)}` };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Allow GET /run for cron triggers; POST for manual bodies.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response('Missing Supabase env', { status: 500 });
  }
  const missingTwilio = !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Look ahead 15 minutes by default; window 15 minutes back to catch the
  // first run after a missed cron tick.
  const { data: pending, error } = await sb.rpc('pending_med_reminders', {
    p_lookahead_minutes: 15,
    p_window_minutes:    15,
  });
  if (error) {
    console.error('pending_med_reminders error', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  const rows = (pending ?? []) as PendingRow[];
  const summary: Array<Record<string, unknown>> = [];

  for (const r of rows) {
    const body = renderBody(r);

    // Insert/queue first so a concurrent run won't re-send. ON CONFLICT
    // (medication_id, user_id, scheduled_for) DO NOTHING returns 0 rows.
    const { data: queued, error: qErr } = await sb
      .from('whatsapp_outbox')
      .upsert({
        user_id:       r.user_id,
        baby_id:       r.baby_id,
        medication_id: r.medication_id,
        scheduled_for: r.scheduled_for,
        e164:          r.e164,
        body,
        status:        'queued',
      }, { onConflict: 'medication_id,user_id,scheduled_for', ignoreDuplicates: true })
      .select('id')
      .maybeSingle();

    if (qErr) {
      summary.push({ medication_id: r.medication_id, user_id: r.user_id, ok: false, stage: 'enqueue', error: qErr.message });
      continue;
    }
    if (!queued) {
      // Already in the outbox (concurrent run handled it). Skip silently.
      continue;
    }

    if (missingTwilio) {
      // We've enqueued the row; mark it failed so it shows up in the audit log.
      await sb.from('whatsapp_outbox').update({
        status: 'failed', error: 'Twilio env vars missing', attempts: 1,
      }).eq('id', queued.id);
      summary.push({ id: queued.id, ok: false, stage: 'send', error: 'twilio not configured' });
      continue;
    }

    const sendRes = await sendTwilio(r.e164, body);
    if (sendRes.ok) {
      await sb.from('whatsapp_outbox').update({
        status: 'sent', twilio_sid: sendRes.sid, sent_at: new Date().toISOString(), attempts: 1,
      }).eq('id', queued.id);
      summary.push({ id: queued.id, ok: true, sid: sendRes.sid });
    } else {
      await sb.from('whatsapp_outbox').update({
        status: 'failed', error: sendRes.error, attempts: 1,
      }).eq('id', queued.id);
      summary.push({ id: queued.id, ok: false, stage: 'send', error: sendRes.error });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: rows.length, summary }, null, 2),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});

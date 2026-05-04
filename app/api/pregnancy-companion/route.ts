// /api/pregnancy-companion — Wave 33B server endpoint that calls
// Anthropic with a strict system prompt to either explain a recent
// reading or draft a question for the user's next prenatal visit.
//
// Hard rules baked into the system prompt:
//   - Never give medical advice or recommend treatment
//   - Never diagnose
//   - Always recommend talking to the doctor
//   - Stay in the user's language (English or Arabic)
//   - Use the data context provided, do not invent numbers
//
// Rate-limited via the record_companion_call RPC (5/day/user).
//
// Requires ANTHROPIC_API_KEY in Vercel env. Uses fetch directly to
// keep dependencies small (no @anthropic-ai/sdk install needed).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5-20251001';   // small + fast + cheap; safe for read-only summaries
const MAX_TOKENS = 600;

interface Body {
  baby_id: string;
  mode:    'explain' | 'draft_question';
  /** User's free-text question or topic — e.g. "my BP today" or
   *  "I'm worried about the glucose readings". */
  user_input: string;
  lang?: 'en' | 'ar';
}

function systemPrompt(lang: 'en' | 'ar', mode: 'explain' | 'draft_question'): string {
  const langName = lang === 'ar' ? 'Arabic (Egyptian-friendly Modern Standard)' : 'English';
  const base = `You are a helpful pregnancy support assistant inside Babylytics, a pregnancy + cycle tracking app. You are NOT a doctor. You NEVER give medical advice, diagnoses, treatment recommendations, dosing guidance, or risk assessments. You always recommend the user talk to their doctor for any decision.

Strict rules:
- Respond in ${langName}. Match the user's tone.
- Use ONLY the data in the <user_context> block. Never invent numbers.
- Never say "you have X condition" or "this means you should do Y". Use phrases like "this could be worth raising with your doctor" or "the typical screening cutoff is X — only your doctor can interpret your specific case".
- Keep responses short: 2-4 short paragraphs maximum. No bullet point lists unless drafting a question.
- If the user asks for a treatment recommendation, politely decline and suggest they ask their doctor.
- Never mention competitor apps, drug brand names, or specific clinics.
- End every response with one sentence pointing to their doctor for the actual call.`;

  if (mode === 'explain') {
    return base + `\n\nMode: EXPLAIN. The user has asked you to help them understand something they logged. Walk through what the reading is, what the typical reference range is (cite the source like ACOG or ADA when applicable), and how to think about it WITHOUT diagnosing. Then end with the standard "discuss this at your next visit" line.`;
  }
  return base + `\n\nMode: DRAFT QUESTION. The user wants you to draft a precise, doctor-ready question they can ask at their next prenatal visit. Output the question itself in 1-3 short sentences, with the relevant numbers from their data inline. The question should be specific enough that the doctor can act on it. After the question, add one short sentence about why this is worth asking.`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'companion_unavailable' }, { status: 503 });
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  if (!body.baby_id || !body.mode || !body.user_input?.trim()) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (body.user_input.length > 1000) {
    return NextResponse.json({ error: 'input_too_long' }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // Pull the structured context first — also doubles as an access check
  // (the RPC raises 'access denied' if the user can't see this baby).
  const { data: contextJson, error: ctxErr } = await supabase
    .rpc('pregnancy_companion_context', { p_baby: body.baby_id });
  if (ctxErr) {
    return NextResponse.json({ error: ctxErr.message }, { status: 403 });
  }

  // Atomic rate-limit check + log row insert. Raises if 5/day exceeded.
  const { data: rateData, error: rateErr } = await supabase.rpc('record_companion_call', {
    p_baby:           body.baby_id,
    p_mode:           body.mode,
    p_prompt_excerpt: body.user_input,
    p_response_excerpt: null,    // filled in after Claude responds (best-effort)
  });
  if (rateErr) {
    if (rateErr.message?.includes('companion_rate_limited')) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json({ error: rateErr.message }, { status: 400 });
  }
  const rateRow = (rateData as Array<{ calls_today: number; daily_limit: number; log_id: string }>)?.[0];

  // Build the Anthropic request.
  const lang = body.lang === 'ar' ? 'ar' : 'en';
  const userContent =
    `<user_context>\n${JSON.stringify(contextJson, null, 2)}\n</user_context>\n\n` +
    `<user_question>\n${body.user_input.trim()}\n</user_question>`;

  let claudeResp: Response;
  try {
    claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify({
        model:       MODEL,
        max_tokens:  MAX_TOKENS,
        system:      systemPrompt(lang, body.mode),
        messages:    [{ role: 'user', content: userContent }],
      }),
    });
  } catch {
    return NextResponse.json({ error: 'companion_unreachable' }, { status: 502 });
  }

  if (!claudeResp.ok) {
    const errText = await claudeResp.text().catch(() => '');
    return NextResponse.json({
      error: 'companion_error',
      detail: errText.slice(0, 200),
    }, { status: 502 });
  }

  const claudeJson = await claudeResp.json() as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (claudeJson.content ?? [])
    .filter(b => b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n')
    .trim();

  // Best-effort: write the response excerpt back into the log row for support.
  if (rateRow?.log_id) {
    await supabase.from('pregnancy_companion_log')
      .update({ response_excerpt: text.slice(0, 400) })
      .eq('id', rateRow.log_id);
  }

  return NextResponse.json({
    text,
    calls_today: rateRow?.calls_today ?? null,
    daily_limit: rateRow?.daily_limit ?? 5,
  });
}

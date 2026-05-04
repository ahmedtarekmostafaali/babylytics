// /api/pregnancy-companion — Wave 33B + Wave 34. Server endpoint for
// the AI companion across all three stages (planning / pregnancy /
// baby). Calls Anthropic with a stage-aware system prompt that bakes
// in the no-medical-advice rules.
//
// Hard rules baked into every system prompt:
//   - Never give medical advice, diagnoses, treatment recommendations,
//     dosing, or risk assessment
//   - Always recommend talking to the doctor
//   - Stay in the user's language
//   - Use ONLY the data context provided — never invent numbers
//
// Rate-limited via record_companion_call (5/day/user across all stages).
//
// Requires ANTHROPIC_API_KEY in Vercel env. Uses fetch directly to
// keep dependencies small.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;

type Stage = 'planning' | 'pregnancy' | 'baby';
type Mode  = 'explain'  | 'draft_question';

interface Body {
  baby_id:    string;
  mode:       Mode;
  user_input: string;
  lang?:      'en' | 'ar';
}

function systemPrompt(lang: 'en' | 'ar', mode: Mode, stage: Stage): string {
  const langName = lang === 'ar' ? 'Arabic (Egyptian-friendly Modern Standard)' : 'English';

  const roleByStage: Record<Stage, string> = {
    planning:  'pregnancy + cycle support assistant for a user tracking her menstrual cycle, fertility, or planning a pregnancy',
    pregnancy: 'pregnancy support assistant for an expecting mother',
    baby:      'pediatric support assistant for a parent tracking their child',
  };
  const doctorByStage: Record<Stage, string> = {
    planning:  'OB-GYN or fertility specialist',
    pregnancy: 'OB-GYN',
    baby:      'pediatrician',
  };

  const base = `You are a helpful ${roleByStage[stage]} inside Babylytics. You are NOT a doctor. You NEVER give medical advice, diagnoses, treatment recommendations, dosing guidance, or risk assessments. You always recommend the user talk to their ${doctorByStage[stage]} for any decision.

Strict rules:
- Respond in ${langName}. Match the user's tone.
- Use ONLY the data in the <user_context> block. Never invent numbers.
- Never say "you have X condition" or "this means you should do Y". Use phrases like "this could be worth raising with your ${doctorByStage[stage]}" or "the typical reference range is X — only your doctor can interpret your specific case".
- Keep responses short: 2-4 short paragraphs maximum. No bullet lists unless drafting a question.
- If the user asks for a treatment recommendation, politely decline and suggest they ask their ${doctorByStage[stage]}.
- Never mention competitor apps, drug brand names, or specific clinics.
- End every response with one sentence pointing to their ${doctorByStage[stage]} for the actual call.`;

  if (mode === 'explain') {
    return base + `\n\nMode: EXPLAIN. The user has asked you to help them understand something they logged. Walk through what the reading is, what the typical reference range is (cite the source like ACOG / ADA / WHO when applicable), and how to think about it WITHOUT diagnosing. Then end with the standard "discuss this at your next visit" line.`;
  }
  return base + `\n\nMode: DRAFT QUESTION. The user wants you to draft a precise, doctor-ready question they can ask at their next visit. Output the question itself in 1-3 short sentences, with the relevant numbers from their data inline. The question should be specific enough that the doctor can act on it. After the question, add one short sentence about why this is worth asking.`;
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

  // Wave 34: generic context RPC — branches by stage internally and
  // returns a `stage` field alongside the data snapshot.
  const { data: contextJson, error: ctxErr } = await supabase
    .rpc('ai_companion_context', { p_baby: body.baby_id });
  if (ctxErr) {
    return NextResponse.json({ error: ctxErr.message }, { status: 403 });
  }
  const stage = ((contextJson as { stage?: Stage } | null)?.stage ?? 'baby') as Stage;

  // Atomic rate-limit check + log row insert.
  const { data: rateData, error: rateErr } = await supabase.rpc('record_companion_call', {
    p_baby:           body.baby_id,
    p_mode:           body.mode,
    p_prompt_excerpt: body.user_input,
    p_response_excerpt: null,
    p_stage:          stage,
  });
  if (rateErr) {
    if (rateErr.message?.includes('companion_rate_limited')) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
    return NextResponse.json({ error: rateErr.message }, { status: 400 });
  }
  const rateRow = (rateData as Array<{ calls_today: number; daily_limit: number; log_id: string }>)?.[0];

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
        system:      systemPrompt(lang, body.mode, stage),
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
    stage,
    calls_today: rateRow?.calls_today ?? null,
    daily_limit: rateRow?.daily_limit ?? 5,
  });
}

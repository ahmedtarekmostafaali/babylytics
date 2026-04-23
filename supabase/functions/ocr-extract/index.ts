// ===========================================================================
// Babylytics — OCR Edge Function
// ===========================================================================
// POST /functions/v1/ocr-extract
//   body: { file_id: uuid }
//
// Pipeline:
//   1. Authenticate caller via Supabase JWT forwarded in Authorization header.
//   2. Read medical_files row for file_id (RLS enforces access).
//   3. Download the Storage object using the service role key (we need to
//      read bytes regardless of user's per-row permission).
//   4. Call the configured OCR provider. Default: Anthropic Claude vision.
//      Prompt is tuned for English + Arabic + mixed-language handwritten baby
//      notes, and asks Claude to return a strict JSON structure plus a
//      self-reported confidence score.
//   5. Insert an extracted_text row with status='extracted'. NEVER insert
//      into feedings/stools/medications/measurements. The user must review
//      and confirm via confirm_extracted_text(...).
//   6. If confidence < 0.7 emit a low_ocr_confidence notification.
//
// Supported providers (switch via OCR_PROVIDER secret):
//   - "anthropic"   — default, handwriting-strong, Arabic-aware
//   - "google"      — Google Cloud Vision DOCUMENT_TEXT_DETECTION
//   - "tesseract"   — disabled in Edge Functions (no native binaries); stub
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// Deno env
// deno-lint-ignore no-explicit-any
const env = (globalThis as any).Deno.env as { get(k: string): string | undefined };

const SUPABASE_URL         = env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY     = env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY             = env.get('SUPABASE_ANON_KEY')!;
const ANTHROPIC_API_KEY    = env.get('ANTHROPIC_API_KEY') ?? '';
const GOOGLE_VISION_KEY    = env.get('GOOGLE_VISION_API_KEY') ?? '';
const OCR_PROVIDER         = (env.get('OCR_PROVIDER') ?? 'anthropic').toLowerCase();
const ANTHROPIC_MODEL      = env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';

// ---- Types -----------------------------------------------------------------
type OcrResult = {
  provider: 'anthropic' | 'google' | 'tesseract';
  model?: string;
  raw_text: string;
  structured_data: StructuredData;
  confidence_score: number;        // 0..1
  is_handwritten: boolean;
  detected_language?: string;
  error?: string;
};

type StructuredData = {
  feedings?:     { feeding_time?: string; quantity_ml?: number; milk_type?: string; notes?: string }[];
  stools?:       { stool_time?: string; quantity_category?: 'small'|'medium'|'large'; quantity_ml?: number; color?: string; consistency?: string; notes?: string }[];
  measurements?: { measured_at?: string; weight_kg?: number; height_cm?: number; head_circ_cm?: number; notes?: string }[];
  medication_logs?: { medication_id?: string; medication_time?: string; status?: 'taken'|'missed'|'skipped'; notes?: string }[];
  notes?: string;
};

// ---- JSON helpers ----------------------------------------------------------
// CORS allow-list MUST include every header supabase-js sends from the browser
// or the preflight validator will silently drop the POST even after OPTIONS 200.
// supabase-js adds: apikey, authorization, content-type, x-client-info,
// x-supabase-api-version. We also allow a trailing '*' for forward-compat.
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, accept',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}

// ---- Prompt ----------------------------------------------------------------
const SYSTEM_PROMPT = `You are a clinical-grade OCR engine for Babylytics, a baby health tracker.
You read photos and scans of handwritten or printed daily care notes, prescriptions, and medical reports.
Notes may be in English, Arabic, French, or a mix of these in a single page, and numerals may be Arabic (٠١٢٣٤٥٦٧٨٩) or Western (0-9).

Your job:
1. Transcribe EVERYTHING you can read into "raw_text" (keep original script, one line per handwritten line).
2. Extract structured events into the JSON schema below. Only include a field if you can read it.
3. Report your own CONFIDENCE as a number in [0,1] reflecting how sure you are overall.
4. Say whether the document is handwritten.

Timestamps must be ISO-8601 with time zone. If the note only shows a time (e.g. "14:30"), assume today in UTC+0 — the app will let the user correct.
Quantities: convert to milliliters when possible. If the note says "oz", convert to ml (1 oz = 29.5735 ml).
Weight in kg, height in cm, head circumference in cm.

Return ONLY a JSON object with this shape — no prose, no markdown fences:
{
  "raw_text": "string",
  "is_handwritten": true | false,
  "detected_language": "en" | "ar" | "fr" | "mixed" | "other",
  "confidence_score": 0.0,
  "structured_data": {
    "feedings":        [{ "feeding_time":"ISO", "quantity_ml": 0, "milk_type":"formula|breast|mixed|solid|other", "notes":"..." }],
    "stools":          [{ "stool_time":"ISO", "quantity_category":"small|medium|large", "quantity_ml":0, "color":"...", "consistency":"...", "notes":"..." }],
    "measurements":    [{ "measured_at":"ISO", "weight_kg":0, "height_cm":0, "head_circ_cm":0, "notes":"..." }],
    "medication_logs": [{ "medication_time":"ISO", "status":"taken|missed|skipped", "notes":"..." }],
    "notes": "any free-text observations worth keeping"
  }
}
If the document contains nothing extractable, return empty arrays and confidence_score reflecting transcription quality.`;

// ---- Provider: Anthropic ---------------------------------------------------
async function ocrWithAnthropic(bytesB64: string, mime: string): Promise<OcrResult> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  // Route PDFs through the `document` content block; images through `image`.
  const contentBlock = mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf',        data: bytesB64 } }
    : { type: 'image',    source: { type: 'base64', media_type: mime || 'image/jpeg',     data: bytesB64 } };
  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        contentBlock,
        { type: 'text',  text: 'Extract the structured events from this document. Return JSON only.' },
      ],
    }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.content ?? [])
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('\n');
  const parsed = safeParseJson(text);
  return {
    provider: 'anthropic',
    model: ANTHROPIC_MODEL,
    raw_text: parsed.raw_text ?? text,
    structured_data: parsed.structured_data ?? {},
    confidence_score: clamp01(parsed.confidence_score ?? 0.5),
    is_handwritten: !!parsed.is_handwritten,
    detected_language: parsed.detected_language,
  };
}

// ---- Provider: Google Vision ----------------------------------------------
async function ocrWithGoogle(bytesB64: string): Promise<OcrResult> {
  if (!GOOGLE_VISION_KEY) throw new Error('GOOGLE_VISION_API_KEY not set');
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        image: { content: bytesB64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['en', 'ar', 'fr'] },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const r = data.responses?.[0];
  const raw = r?.fullTextAnnotation?.text ?? '';
  // Google returns transcription only — structured extraction is out of scope here.
  // We still pass raw_text to the UI; user types structured data manually, OR re-runs via Anthropic.
  return {
    provider: 'google',
    raw_text: raw,
    structured_data: {},
    confidence_score: raw ? 0.9 : 0,
    is_handwritten: raw.includes('\n') && raw.length < 4000, // rough heuristic
    detected_language: r?.fullTextAnnotation?.pages?.[0]?.property?.detectedLanguages?.[0]?.languageCode,
  };
}

// ---- Utilities -------------------------------------------------------------
function clamp01(n: number) { return Math.max(0, Math.min(1, Number(n) || 0)); }

function safeParseJson(text: string): Partial<OcrResult> & { raw_text?: string } {
  if (!text) return {};
  // Strip markdown fences if the model wrapped JSON anyway
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  try { return JSON.parse(cleaned); }
  catch {
    // last-ditch: find the outermost { ... }
    const a = cleaned.indexOf('{');
    const b = cleaned.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) {
      try { return JSON.parse(cleaned.slice(a, b + 1)); } catch { /* fall through */ }
    }
    return { raw_text: text };
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // chunked btoa to avoid stack blow-ups on big files
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  return btoa(bin);
}

// Sniff the real image MIME from the first few bytes (magic numbers). Browsers
// and upload flows can lie about content-type — iPhone screenshots end up as
// .png wrappers around JPEG bytes, which Claude rejects with HTTP 400. Trusting
// the bytes is strictly safer than trusting the header.
function sniffImageMime(buf: Uint8Array, fallback: string): string {
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  return fallback;
}

// ---- Handler ---------------------------------------------------------------
// deno-lint-ignore no-explicit-any
(globalThis as any).Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return json({ error: 'missing Authorization' }, 401);

  let body: { file_id?: string; provider?: string };
  try { body = await req.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!body.file_id) return json({ error: 'file_id required' }, 400);

  // User-scoped client — MUST use the anon key so RLS actually applies.
  // The caller's JWT (in Authorization) identifies them; the anon key keeps us
  // from silently bypassing row-level security the way service_role would.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  // Service-role client — for storage download + privileged writes
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Read file row (RLS: caller must have baby access)
  const { data: file, error: fErr } = await userClient
    .from('medical_files')
    .select('id, baby_id, storage_bucket, storage_path, mime_type, kind, is_handwritten')
    .eq('id', body.file_id)
    .single();
  if (fErr || !file) return json({ error: 'file not found or access denied', detail: fErr?.message }, 404);

  // 2. Flip to 'processing'
  await svc.from('medical_files').update({ ocr_status: 'processing' }).eq('id', file.id);

  // 3. Download bytes
  const { data: blob, error: dErr } = await svc.storage.from(file.storage_bucket).download(file.storage_path);
  if (dErr || !blob) {
    await svc.from('medical_files').update({ ocr_status: 'failed' }).eq('id', file.id);
    return json({ error: 'storage download failed', detail: dErr?.message }, 500);
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  const sniffedMime = sniffImageMime(buf.slice(0, 16), file.mime_type ?? 'image/jpeg');
  // chunked btoa to avoid stack blow-ups on big files
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  const b64 = btoa(bin);

  // 4. Provider
  const provider = (body.provider ?? OCR_PROVIDER).toLowerCase();
  let result: OcrResult;
  try {
    if      (provider === 'google')    result = await ocrWithGoogle(b64);
    else if (provider === 'tesseract') throw new Error('tesseract not available in Edge Functions');
    else                               result = await ocrWithAnthropic(b64, sniffedMime);
  } catch (e) {
    await svc.from('medical_files').update({ ocr_status: 'failed' }).eq('id', file.id);
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: 'ocr provider failed', detail: msg }, 502);
  }

  // 5. Persist extraction (NEVER into domain tables)
  const { data: inserted, error: iErr } = await svc.from('extracted_text').insert({
    file_id: file.id,
    baby_id: file.baby_id,
    provider: result.provider,
    model: result.model,
    raw_text: result.raw_text,
    structured_data: result.structured_data,
    confidence_score: result.confidence_score,
    is_handwritten: result.is_handwritten ?? file.is_handwritten,
    detected_language: result.detected_language,
    status: 'extracted',
  }).select('id').single();
  if (iErr || !inserted) {
    await svc.from('medical_files').update({ ocr_status: 'failed' }).eq('id', file.id);
    return json({ error: 'could not save extraction', detail: iErr?.message }, 500);
  }

  await svc.from('medical_files').update({ ocr_status: 'extracted' }).eq('id', file.id);

  // 6. Low-confidence notification
  if (result.confidence_score < 0.7) {
    await svc.from('notifications').insert({
      baby_id: file.baby_id,
      user_id: null,  // broadcast to all caregivers
      kind: 'low_ocr_confidence',
      payload: { file_id: file.id, extracted_id: inserted.id, confidence: result.confidence_score },
    });
  }

  return json({
    ok: true,
    extracted_id: inserted.id,
    confidence_score: result.confidence_score,
    flag_low_confidence: result.confidence_score < 0.7,
    provider: result.provider,
  });
});

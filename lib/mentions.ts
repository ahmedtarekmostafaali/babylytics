// @mention helpers for chat. Plain-text storage: a mention is just the
// literal "@name" in the message body — no embedded user IDs in v1. The
// renderer detects @<word> patterns and styles them as chips. The
// composer detects an @<query> at the cursor and surfaces a member picker.

export interface MentionMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

/** Compute the @-mention context at the textarea caret, if any. Returns
 *  null when the caret isn't inside (or right after) an @-mention token. */
export function getMentionContext(text: string, caret: number): {
  query: string;
  /** Character index of the @ symbol. */
  start: number;
  /** Character index right after the query (= caret). */
  end: number;
} | null {
  const before = text.slice(0, caret);
  // Match @ followed by zero or more word chars at end of `before`,
  // requiring start-of-string OR whitespace before the @.
  const m = before.match(/(?:^|\s)(@\w*)$/);
  if (!m) return null;
  const tokenStart = caret - m[1]!.length;
  return { query: m[1]!.slice(1), start: tokenStart, end: caret };
}

/** Build the display name for a mention candidate (display_name || email-prefix || id). */
export function mentionLabel(m: MentionMember): string {
  if (m.display_name?.trim()) return m.display_name.trim();
  if (m.email) return m.email.split('@')[0]!;
  return m.user_id.slice(0, 6);
}

/** Filter the member list by an @-query. Empty query returns the full list.
 *  Excludes the current user (you can't mention yourself meaningfully).
 *  Generic so callers (BabyChat passes ChatMember which has role) keep
 *  their richer type instead of being narrowed to MentionMember. */
export function filterMembers<M extends MentionMember>(members: M[], query: string, currentUserId: string): M[] {
  const q = query.trim().toLowerCase();
  return members.filter(m => {
    if (m.user_id === currentUserId) return false;
    if (!q) return true;
    return mentionLabel(m).toLowerCase().includes(q)
        || (m.email?.toLowerCase().includes(q) ?? false);
  });
}

/** Insert a mention into the textarea body, replacing the @query with @name + space. */
export function applyMention<M extends MentionMember>(
  body: string, ctx: { start: number; end: number }, member: M,
): { body: string; caret: number } {
  // Use the first word of the display name to keep mention tokens short
  // (so the @-detection regex matches them later for highlighting).
  const label = mentionLabel(member).split(/\s+/)[0]!;
  const before = body.slice(0, ctx.start);
  const after = body.slice(ctx.end);
  const insert = `@${label} `;
  const next = before + insert + after;
  return { body: next, caret: ctx.start + insert.length };
}

/** Render a chat body as a list of text + mention nodes for the message
 *  bubble. Detects every @<word> token. Invariant: the joined text of all
 *  segments equals the original body. */
export function tokenizeBody(body: string): Array<{ kind: 'text' | 'mention'; text: string }> {
  const out: Array<{ kind: 'text' | 'mention'; text: string }> = [];
  // Greedy split on @<word> while preserving everything else verbatim.
  const re = /@\w+/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: body.slice(last, m.index) });
    out.push({ kind: 'mention', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push({ kind: 'text', text: body.slice(last) });
  return out;
}

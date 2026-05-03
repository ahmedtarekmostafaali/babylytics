'use client';

// ForumReactions — Wave 24. A row of reaction chips under a thread or
// reply. Four kinds: heart, hug, me_too, thanks. Each chip shows the
// emoji + total count + an active state when the caller has tapped it.
// Tapping toggles via the toggle_forum_reaction RPC (returns the new
// count). Optimistic UI: count + active state update immediately, the
// RPC reconciles afterwards. No notification fires — reactions are
// intentionally low-friction.

import { useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ReactionKind = 'heart' | 'hug' | 'me_too' | 'thanks';

const KINDS: { kind: ReactionKind; emoji: string; en: string; ar: string }[] = [
  { kind: 'heart',  emoji: '❤️', en: 'Heart',   ar: 'قلب'      },
  { kind: 'hug',    emoji: '🤗', en: 'Hug',     ar: 'حضن'      },
  { kind: 'me_too', emoji: '✋', en: 'Me too',  ar: 'أنا كمان' },
  { kind: 'thanks', emoji: '🙏', en: 'Thanks',  ar: 'شكراً'    },
];

type Counts = Partial<Record<ReactionKind, number>>;

export function ForumReactions({
  targetType, targetId, initialCounts, initialMine, lang = 'en',
}: {
  targetType: 'thread' | 'reply';
  targetId: string;
  /** {"heart": 5, "hug": 2} from the meta view's reaction_counts column. */
  initialCounts: Counts;
  /** The kinds the caller has reacted with. */
  initialMine: ReactionKind[];
  lang?: 'en' | 'ar';
}) {
  const isAr = lang === 'ar';
  const [counts, setCounts] = useState<Counts>(initialCounts ?? {});
  const [mine, setMine]     = useState<Set<ReactionKind>>(new Set(initialMine ?? []));
  const [busy, setBusy]     = useState<Set<ReactionKind>>(new Set());
  const [, start]           = useTransition();

  async function toggle(kind: ReactionKind) {
    if (busy.has(kind)) return;
    setBusy(prev => new Set(prev).add(kind));

    // Optimistic flip — undo on error.
    const wasMine = mine.has(kind);
    const before  = counts[kind] ?? 0;
    setMine(prev => {
      const n = new Set(prev);
      if (wasMine) n.delete(kind); else n.add(kind);
      return n;
    });
    setCounts(prev => ({ ...prev, [kind]: Math.max(0, before + (wasMine ? -1 : 1)) }));

    const supabase = createClient();
    const { data, error } = await supabase.rpc('toggle_forum_reaction', {
      p_target_type: targetType,
      p_target_id:   targetId,
      p_kind:        kind,
    });
    if (error) {
      // Rollback.
      setMine(prev => {
        const n = new Set(prev);
        if (wasMine) n.add(kind); else n.delete(kind);
        return n;
      });
      setCounts(prev => ({ ...prev, [kind]: before }));
    } else if (typeof data === 'number') {
      // Reconcile with server-truth count (handles concurrent reactions).
      setCounts(prev => ({ ...prev, [kind]: data }));
    }
    setBusy(prev => { const n = new Set(prev); n.delete(kind); return n; });
    start(() => {});
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {KINDS.map(({ kind, emoji, en, ar }) => {
        const count   = counts[kind] ?? 0;
        const reacted = mine.has(kind);
        const label   = isAr ? ar : en;
        return (
          <button key={kind} type="button"
            aria-label={`${label} (${count})`}
            aria-pressed={reacted}
            disabled={busy.has(kind)}
            onClick={() => toggle(kind)}
            className={`inline-flex items-center gap-1 rounded-full text-xs font-semibold px-2.5 py-1 transition ${
              reacted
                ? 'bg-coral-100 text-coral-700 ring-1 ring-coral-300'
                : 'bg-slate-50 text-ink-muted hover:bg-slate-100 hover:text-ink-strong'
            } disabled:opacity-50`}>
            <span aria-hidden className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

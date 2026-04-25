'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SpeakingSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, QuickPill, WhenPicker } from '@/components/forms/FormKit';

export type SpeakingValue = {
  id?: string;
  observed_at: string;
  word_or_phrase?: string | null;
  category: 'coo'|'babble'|'word'|'phrase'|'sentence'|'other';
  language?: string | null;
  is_first_use?: boolean;
  context?: string | null;
  notes?: string | null;
};

const CATEGORIES: { value: SpeakingValue['category']; label: string; emoji: string }[] = [
  { value: 'coo',      label: 'Coo / vowel',  emoji: '🍼' },
  { value: 'babble',   label: 'Babble',       emoji: '👶' },
  { value: 'word',     label: 'Word',         emoji: '🗣️' },
  { value: 'phrase',   label: 'Phrase',       emoji: '💬' },
  { value: 'sentence', label: 'Sentence',     emoji: '📣' },
  { value: 'other',    label: 'Other',        emoji: '✨' },
];

const SUGGESTED_LANGUAGES = ['ar', 'en', 'mixed', 'other'];

export function SpeakingForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: SpeakingValue;
}) {
  const router = useRouter();
  const [observedAt, setObservedAt] = useState(initial?.observed_at ? isoToLocalInput(initial.observed_at) : nowLocalInput());
  const [word,       setWord]       = useState(initial?.word_or_phrase ?? '');
  const [category,   setCategory]   = useState<SpeakingValue['category']>(initial?.category ?? 'word');
  const [language,   setLanguage]   = useState(initial?.language ?? '');
  const [firstUse,   setFirstUse]   = useState<boolean>(initial?.is_first_use ?? false);
  const [context,    setContext]    = useState(initial?.context ?? '');
  const [notes,      setNotes]      = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(observedAt);
    if (!iso) { setErr('Pick a valid time.'); return; }
    const parsed = SpeakingSchema.safeParse({
      observed_at:    iso,
      word_or_phrase: word || null,
      category,
      language:       language || null,
      is_first_use:   firstUse,
      context:        context || null,
      notes:          notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('speaking_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('speaking_logs').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/speaking`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this speaking log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('speaking_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/speaking`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Category */}
      <Section n={1} title="What kind of speech?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORIES.map(c => (
            <button type="button" key={c.value} onClick={() => setCategory(c.value)}
              className={cn(
                'rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition flex items-center gap-2',
                category === c.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink',
              )}>
              <span className="text-xl leading-none">{c.emoji}</span>
              <span className="leading-tight">{c.label}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 2. Word / phrase */}
      <Section n={2} title="What did they say?" optional>
        <Field label="Word or phrase">
          <input
            value={word}
            onChange={e => setWord(e.target.value)}
            placeholder='e.g. "mama", "more milk", "go car"'
            className={cn(
              'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold',
              'focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30',
            )}
          />
        </Field>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink-strong">
          <input type="checkbox" checked={firstUse} onChange={e => setFirstUse(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500" />
          First time using this word/phrase 🎉
        </label>
      </Section>

      {/* 3. Language */}
      <Section n={3} title="Language" optional>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_LANGUAGES.map(l => (
            <QuickPill key={l} active={language === l} onClick={() => setLanguage(l)} tint="brand">
              {l}
            </QuickPill>
          ))}
        </div>
      </Section>

      {/* 4. Context */}
      <Section n={4} title="Context" optional>
        <Field label="What was happening?">
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="e.g. pointing at bottle, while waving bye"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </Field>
      </Section>

      {/* 5. When */}
      <Section n={5} title="When?">
        <WhenPicker time={observedAt} onChange={setObservedAt} tint="brand" />
      </Section>

      {/* 6. Notes */}
      <Section n={6} title="Notes" optional>
        <Field label="Notes">
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything else worth remembering…"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </Field>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-brand-500 to-mint-500 hover:from-brand-600 hover:to-mint-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log new speech'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">Capture the moment <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

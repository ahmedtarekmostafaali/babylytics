'use client';

// Inline editor for the babies.diabetes_type column. Renders as a
// status pill that opens into a button-group when tapped, saving
// the new value via Supabase (RLS authorises the parent / owner).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

export type DiabetesType = 'none' | 'type_1' | 'type_2' | 'gestational' | 'suspected';

const TYPES: { key: DiabetesType; tint: 'mint'|'coral'|'peach'|'lavender'|'brand' }[] = [
  { key: 'none',         tint: 'mint' },
  { key: 'type_1',       tint: 'coral' },
  { key: 'type_2',       tint: 'peach' },
  { key: 'gestational',  tint: 'lavender' },
  { key: 'suspected',    tint: 'brand' },
];

export function DiabetesTypePicker({
  babyId, initialType, canEdit,
}: {
  babyId: string;
  initialType: DiabetesType;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [type, setType]     = useState<DiabetesType>(initialType);
  const [editing, setEditing] = useState(initialType === 'none');  // open by default if not set
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  async function pick(next: DiabetesType) {
    if (next === type) { setEditing(false); return; }
    if (!canEdit) return;
    setSaving(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from('babies')
      .update({ diabetes_type: next }).eq('id', babyId);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setType(next);
    setEditing(false);
    router.refresh();
  }

  // Visual: closed = single pill with current value + edit pencil.
  // Open: button group of all options + cancel.
  if (!editing) {
    const tone = TYPES.find(x => x.key === type)?.tint ?? 'mint';
    const tintCss = {
      mint:     'bg-mint-50    text-mint-700    border-mint-200',
      coral:    'bg-coral-50   text-coral-700   border-coral-200',
      peach:    'bg-peach-50   text-peach-700   border-peach-200',
      lavender: 'bg-lavender-50 text-lavender-700 border-lavender-200',
      brand:    'bg-brand-50   text-brand-700   border-brand-200',
    }[tone];
    return (
      <div className={cn('flex items-center gap-2 rounded-2xl border px-4 py-3', tintCss)}>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider opacity-80 font-semibold">{t('bs.dx_label')}</div>
          <div className="text-sm font-bold">{t(`bs.diabetes_${type}`)}</div>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-white/70 hover:bg-white px-3 py-1 border border-current/20">
            <Pencil className="h-3 w-3" /> {t('bs.dx_change')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{t('bs.dx_label')}</div>
          <div className="text-sm text-ink">{t('bs.dx_pick')}</div>
        </div>
        {initialType !== 'none' && (
          <button type="button" onClick={() => setEditing(false)} disabled={saving}
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100"
            aria-label={t('bs.dx_close')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TYPES.map(({ key, tint }) => {
          const active = type === key;
          const activeCss = {
            mint:     'bg-mint-500    text-white border-mint-500',
            coral:    'bg-coral-500   text-white border-coral-500',
            peach:    'bg-peach-500   text-white border-peach-500',
            lavender: 'bg-lavender-500 text-white border-lavender-500',
            brand:    'bg-brand-500   text-white border-brand-500',
          }[tint];
          return (
            <button type="button" key={key} onClick={() => pick(key)} disabled={saving}
              className={cn(
                'h-12 rounded-xl border text-sm font-semibold transition flex items-center justify-center gap-1.5',
                active ? `${activeCss} shadow-sm` : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
              )}>
              {saving && active && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {active && !saving && <Check className="h-3.5 w-3.5" />}
              {t(`bs.diabetes_${key}`)}
            </button>
          );
        })}
      </div>
      {err && <p className="mt-2 text-xs text-coral-600">{err}</p>}
    </div>
  );
}

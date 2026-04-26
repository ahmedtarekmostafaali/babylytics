'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShoppingItemSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, QuickPill } from '@/components/forms/FormKit';
import { useT } from '@/lib/i18n/client';

export type ShoppingItemValue = {
  id?: string;
  scope: 'baby' | 'pregnancy';
  name: string;
  category?: string | null;
  quantity?: string | null;
  priority: 'low' | 'normal' | 'high';
  notes?: string | null;
  is_done?: boolean;
};

const BABY_CATEGORIES      = ['Diapers', 'Feeding', 'Clothing', 'Bath', 'Health', 'Toys', 'Gear', 'Other'];
const PREGNANCY_CATEGORIES = ['Hospital bag', 'Vitamins', 'Maternity', 'Nursery', 'Postpartum', 'Mom self-care', 'Other'];

const PRIORITIES: { value: ShoppingItemValue['priority']; label: string; tint: 'mint'|'peach'|'coral' }[] = [
  { value: 'low',    label: 'Low',    tint: 'mint'  },
  { value: 'normal', label: 'Normal', tint: 'peach' },
  { value: 'high',   label: 'High',   tint: 'coral' },
];

export function ShoppingItemForm({
  babyId, scope, initial,
}: {
  babyId: string;
  scope: 'baby' | 'pregnancy';
  initial?: ShoppingItemValue;
}) {
  const router = useRouter();
  const t = useT();
  const [name, setName]         = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [quantity, setQuantity] = useState(initial?.quantity ?? '');
  const [priority, setPriority] = useState<ShoppingItemValue['priority']>(initial?.priority ?? 'normal');
  const [notes,    setNotes]    = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryOptions = scope === 'pregnancy' ? PREGNANCY_CATEGORIES : BABY_CATEGORIES;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = ShoppingItemSchema.safeParse({
      scope, name,
      category: category || null,
      quantity: quantity || null,
      priority,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('shopping_list_items').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('shopping_list_items').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/shopping${scope === 'pregnancy' ? '?scope=pregnancy' : ''}`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this item?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('shopping_list_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/shopping${scope === 'pregnancy' ? '?scope=pregnancy' : ''}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title={t('forms.shop_what')}>
        <Field label={t('forms.shop_item_name')}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30"
          />
        </Field>
        <Field label={t('forms.shop_quantity')}>
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className={cn(
              'h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base',
              'focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30',
            )}
          />
        </Field>
      </Section>

      <Section n={2} title={t('forms.shop_category')} optional>
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map(c => (
            <QuickPill key={c} active={category === c} onClick={() => setCategory(c)} tint="mint">
              {c}
            </QuickPill>
          ))}
        </div>
      </Section>

      <Section n={3} title={t('forms.shop_priority')}>
        <div className="grid grid-cols-3 gap-2">
          {PRIORITIES.map(p => (
            <button type="button" key={p.value} onClick={() => setPriority(p.value)}
              className={cn(
                'rounded-2xl border px-3 py-3 text-sm font-semibold transition',
                priority === p.value
                  ? `border-${p.tint}-500 bg-${p.tint}-50 text-${p.tint}-700`
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-ink',
              )}>
              {t(`forms.shop_priority_${p.value}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section n={4} title={t('forms.notes')} optional>
        <Field label={t('forms.notes')}>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-mint-500 focus:ring-2 focus:ring-mint-500/30"
          />
        </Field>
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-mint-500 to-brand-500 hover:from-mint-600 hover:to-brand-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.shop_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

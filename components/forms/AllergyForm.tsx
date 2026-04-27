'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AllergySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Trash2, AlertTriangle, Sparkles, Info, ShieldAlert, MilkOff, Heart } from 'lucide-react';
import { useT } from '@/lib/i18n/client';
import { TEMPLATES, COW_MILK, templateForAllergen } from '@/lib/allergy_templates';
import { cn } from '@/lib/utils';

export type AllergyFormValue = {
  id?: string;
  allergen: string;
  category?: 'food'|'drug'|'environmental'|'contact'|'latex'|'other'|null;
  reaction?: string | null;
  severity: 'mild'|'moderate'|'severe'|'life_threatening';
  diagnosed_at?: string | null;
  status: 'active'|'resolved'|'suspected';
  notes?: string | null;
};

export function AllergyForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: AllergyFormValue;
}) {
  const router = useRouter();
  const t = useT();
  const [allergen, setAllergen]   = useState(initial?.allergen ?? '');
  const [category, setCategory]   = useState<AllergyFormValue['category']>(initial?.category ?? 'food');
  const [reaction, setReaction]   = useState(initial?.reaction ?? '');
  const [severity, setSeverity]   = useState<AllergyFormValue['severity']>(initial?.severity ?? 'mild');
  const [diagnosedAt, setDiagnosedAt] = useState(initial?.diagnosed_at ?? '');
  const [status, setStatus]       = useState<AllergyFormValue['status']>(initial?.status ?? 'active');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-detect a template based on the typed allergen — surfaces the
  // guidance panel for cow's milk (CMPA), peanut, egg, etc.
  const detected = useMemo(() => templateForAllergen(allergen), [allergen]);

  function applyTemplate(key: typeof TEMPLATES[number]['key']) {
    const tpl = TEMPLATES.find(x => x.key === key);
    if (!tpl) return;
    setAllergen(tpl.allergen_default);
    setCategory(tpl.category);
    if (tpl.reaction_key) setReaction(t(tpl.reaction_key));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = AllergySchema.safeParse({
      allergen, category: category || null, reaction: reaction || null,
      severity, diagnosed_at: diagnosedAt || null, status, notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('allergies').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('allergies').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm(t('forms.allergy_del_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('allergies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/medical-profile`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Quick-pick chip row — fills allergen + category from the template
          so the parent doesn't have to type "Cow's milk protein" every time. */}
      {!initial?.id && (
        <div className="rounded-2xl border border-coral-200 bg-coral-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-coral-600" />
            <div className="text-[11px] font-bold uppercase tracking-wider text-coral-700">
              {t('forms.allergy_quick_pick')}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map(tpl => (
              <button type="button" key={tpl.key}
                onClick={() => applyTemplate(tpl.key)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 hover:border-coral-300 hover:bg-coral-50 px-3 py-1 text-xs font-semibold text-ink transition">
                <span className="text-base leading-none">{tpl.emoji}</span>
                {t(tpl.label_key)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">{t('forms.allergy_quick_pick_help')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>{t('forms.allergy_substance')}</Label>
          <Input value={allergen} onChange={e => setAllergen(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.allergy_category')}</Label>
          <Select value={category ?? ''} onChange={e => setCategory((e.target.value || null) as AllergyFormValue['category'])}>
            <option value="">{t('forms.preg_unknown')}</option>
            <option value="food">{t('forms.allergy_cat_food')}</option>
            <option value="drug">{t('forms.allergy_cat_drug')}</option>
            <option value="environmental">{t('forms.allergy_cat_env')}</option>
            <option value="contact">{t('forms.allergy_cat_contact')}</option>
            <option value="latex">{t('forms.allergy_cat_latex')}</option>
            <option value="other">{t('forms.allergy_cat_other')}</option>
          </Select>
        </div>
        <div>
          <Label>{t('forms.allergy_severity')}</Label>
          <Select value={severity} onChange={e => setSeverity(e.target.value as AllergyFormValue['severity'])}>
            <option value="mild">{t('forms.allergy_severity_mild')}</option>
            <option value="moderate">{t('forms.allergy_severity_moderate')}</option>
            <option value="severe">{t('forms.allergy_severity_severe')}</option>
            <option value="life_threatening">{t('forms.allergy_severity_anaphylactic')}</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.allergy_reaction')}</Label>
          <Textarea rows={2} value={reaction} onChange={e => setReaction(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_diagnosed_at')}</Label>
          <Input type="date" value={diagnosedAt} onChange={e => setDiagnosedAt(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.cond_status')}</Label>
          <Select value={status} onChange={e => setStatus(e.target.value as AllergyFormValue['status'])}>
            <option value="active">{t('forms.cond_status_active')}</option>
            <option value="suspected">{t('forms.cond_status_suspected')}</option>
            <option value="resolved">{t('forms.cond_status_resolved')}</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>{t('forms.notes')}</Label>
        <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      {/* Guidance panel — cow's milk specific for now (the most common one). */}
      {detected?.key === 'cow_milk' && <CowMilkGuidancePanel t={t} />}

      {/* Generic in-context tip for templates without a deeper card. */}
      {detected && detected.key !== 'cow_milk' && (
        <div className="rounded-xl bg-peach-50 border border-peach-200 p-3 text-xs text-peach-900 flex gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-peach-700" />
          <p>{t('forms.allergy_tpl.generic_caveat')}</p>
        </div>
      )}

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-peach-500">
          <AlertTriangle className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.allergy_save_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-12 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

/** Educational guidance panel shown when the allergen looks like CMPA. */
function CowMilkGuidancePanel({ t }: { t: (k: string, vars?: Record<string, string|number>) => string }) {
  return (
    <div className="rounded-2xl border border-mint-200 bg-gradient-to-br from-mint-50 via-white to-coral-50/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="h-8 w-8 rounded-xl grid place-items-center bg-mint-100 text-mint-700">
          <MilkOff className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-mint-700">
            {t('forms.allergy_tpl.cow_milk.eyebrow')}
          </div>
          <h4 className="text-sm font-bold text-ink-strong">{t('forms.allergy_tpl.cow_milk.title')}</h4>
        </div>
      </div>

      <p className="text-sm text-ink leading-relaxed">{t(COW_MILK.intro_key)}</p>

      {/* Symptom groups */}
      <div className="grid gap-3 sm:grid-cols-3">
        {COW_MILK.symptom_groups.map((g) => {
          const items = t(g.items_key).split('|').map(s => s.trim()).filter(Boolean);
          return (
            <div key={g.title_key} className="rounded-xl bg-white/80 border border-slate-200 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-coral-700">{t(g.title_key)}</div>
              <ul className="mt-1.5 space-y-0.5">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-ink"><span className="text-coral-500 select-none">•</span>{it}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <PanelSection icon={MilkOff}      tint="coral"  title={t('forms.allergy_tpl.cow_milk.guidance.avoid_title')}        body={t(COW_MILK.avoid_key)} />
      <PanelSection icon={Heart}        tint="mint"   title={t('forms.allergy_tpl.cow_milk.guidance.alternatives_title')} body={t(COW_MILK.alternatives_key)} />
      <PanelSection icon={ShieldAlert}  tint="peach"  title={t('forms.allergy_tpl.cow_milk.guidance.red_flags_title')}    body={t(COW_MILK.red_flags_key)} />
      <PanelSection icon={Sparkles}     tint="brand"  title={t('forms.allergy_tpl.cow_milk.guidance.outlook_title')}      body={t(COW_MILK.outlook_key)} />

      <div className="flex gap-2 text-[11px] text-ink-muted bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>{t('forms.allergy_tpl.cow_milk.guidance.disclaimer')}</p>
      </div>
    </div>
  );
}

function PanelSection({ icon: Icon, tint, title, body }: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral'|'mint'|'peach'|'brand';
  title: string;
  body: string;
}) {
  const tintCss = {
    coral: 'bg-coral-100 text-coral-700',
    mint:  'bg-mint-100 text-mint-700',
    peach: 'bg-peach-100 text-peach-700',
    brand: 'bg-brand-100 text-brand-700',
  }[tint];
  // Body strings use `|` to separate bullets so the i18n keys stay one line.
  const items = body.split('|').map(s => s.trim()).filter(Boolean);
  return (
    <div className="rounded-xl bg-white/80 border border-slate-200 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn('h-6 w-6 rounded-lg grid place-items-center', tintCss)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink">{title}</div>
      </div>
      {items.length > 1 ? (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-ink leading-relaxed"><span className="text-ink-muted select-none">•</span>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink leading-relaxed">{items[0]}</p>
      )}
    </div>
  );
}

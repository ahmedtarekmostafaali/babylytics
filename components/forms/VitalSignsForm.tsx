'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Activity, Heart, Wind, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

type Position = 'sitting' | 'lying' | 'standing' | 'unknown';

export type VitalSignsFormValue = {
  id?: string;
  baby_id: string;
  measured_at?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  heart_rate_bpm?: number | null;
  oxygen_pct?: number | null;
  position?: Position;
  notes?: string | null;
};

export function VitalSignsForm({ babyId, initial }: { babyId: string; initial?: VitalSignsFormValue }) {
  const router = useRouter();
  const t = useT();

  const [time, setTime] = useState(initial?.measured_at ? isoToLocalInput(initial.measured_at) : nowLocalInput());
  const [sys, setSys]   = useState<string>(initial?.bp_systolic?.toString() ?? '');
  const [dia, setDia]   = useState<string>(initial?.bp_diastolic?.toString() ?? '');
  const [hr, setHr]     = useState<string>(initial?.heart_rate_bpm?.toString() ?? '');
  const [spo2, setSpo2] = useState<string>(initial?.oxygen_pct?.toString() ?? '');
  const [position, setPosition] = useState<Position>(initial?.position ?? 'sitting');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr]     = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Friendly out-of-range tone for each field.
  const sysN  = sys ? Number(sys)  : null;
  const diaN  = dia ? Number(dia)  : null;
  const hrN   = hr  ? Number(hr)   : null;
  const spo2N = spo2 ? Number(spo2): null;

  const bpTone =
    sysN == null || diaN == null ? 'mint' :
    (sysN >= 140 || diaN >= 90) ? 'coral' :
    (sysN >= 130 || diaN >= 80) ? 'peach' :
    (sysN < 90  || diaN < 60)   ? 'peach' :
    'mint';
  const spo2Tone = spo2N == null ? 'mint' : spo2N < 92 ? 'coral' : spo2N < 95 ? 'peach' : 'mint';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr(t('forms.vital_err_time')); return; }
    if (sysN == null && diaN == null && hrN == null && spo2N == null) {
      setErr(t('forms.vital_err_at_least_one'));
      return;
    }
    if (sysN != null && diaN != null && sysN <= diaN) {
      setErr(t('forms.vital_err_bp_invalid'));
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      measured_at:    iso,
      bp_systolic:    sysN,
      bp_diastolic:   diaN,
      heart_rate_bpm: hrN,
      oxygen_pct:     spo2N,
      position,
      notes:          notes || null,
    };
    const op = initial?.id
      ? supabase.from('vital_signs_logs').update(payload).eq('id', initial.id)
      : supabase.from('vital_signs_logs').insert({
          baby_id: babyId, ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vitals`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm(t('forms.vital_del_confirm'))) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('vital_signs_logs')
      .update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/vitals`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <p className="text-xs text-ink-muted">{t('forms.vital_help')}</p>

      <Section n={1} title={t('forms.vital_bp_title')} optional>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="number" min={40} max={250} value={sys} onChange={e => setSys(e.target.value)}
              placeholder={t('forms.vital_systolic_ph')}
              className="h-14 w-28 rounded-xl border border-slate-200 bg-white px-3 text-2xl font-bold focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
            <span className="text-2xl font-bold text-ink-muted">/</span>
            <input type="number" min={20} max={180} value={dia} onChange={e => setDia(e.target.value)}
              placeholder={t('forms.vital_diastolic_ph')}
              className="h-14 w-28 rounded-xl border border-slate-200 bg-white px-3 text-2xl font-bold focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
            <span className="text-base font-medium text-ink-muted">mmHg</span>
            {sysN != null && diaN != null && (
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold ml-auto',
                bpTone === 'coral' ? 'bg-coral-100 text-coral-700' :
                bpTone === 'peach' ? 'bg-peach-100 text-peach-700' :
                'bg-mint-100 text-mint-700'
              )}>
                {bpTone === 'coral' ? t('forms.vital_bp_high') :
                 bpTone === 'peach' ? t('forms.vital_bp_borderline') :
                 t('forms.vital_bp_normal')}
              </span>
            )}
          </div>
        </div>
      </Section>

      <Section n={2} title={t('forms.vital_hr_title')} optional>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 flex-wrap">
          <Heart className="h-5 w-5 text-coral-500" />
          <input type="number" min={20} max={300} value={hr} onChange={e => setHr(e.target.value)}
            placeholder="120"
            className="h-14 w-28 rounded-xl border border-slate-200 bg-white px-3 text-2xl font-bold focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
          <span className="text-base font-medium text-ink-muted">bpm</span>
        </div>
      </Section>

      <Section n={3} title={t('forms.vital_spo2_title')} optional>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 flex-wrap">
          <Wind className="h-5 w-5 text-brand-500" />
          <input type="number" min={50} max={100} step="0.1" value={spo2} onChange={e => setSpo2(e.target.value)}
            placeholder="98"
            className="h-14 w-28 rounded-xl border border-slate-200 bg-white px-3 text-2xl font-bold focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          <span className="text-base font-medium text-ink-muted">%</span>
          {spo2N != null && (
            <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold ml-auto',
              spo2Tone === 'coral' ? 'bg-coral-100 text-coral-700' :
              spo2Tone === 'peach' ? 'bg-peach-100 text-peach-700' :
              'bg-mint-100 text-mint-700'
            )}>
              {spo2Tone === 'coral' ? t('forms.vital_spo2_low') :
               spo2Tone === 'peach' ? t('forms.vital_spo2_borderline') :
               t('forms.vital_spo2_normal')}
            </span>
          )}
        </div>
      </Section>

      <Section n={4} title={t('forms.vital_position_title')}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['sitting','lying','standing','unknown'] as Position[]).map(p => (
            <button type="button" key={p} onClick={() => setPosition(p)}
              className={cn(
                'h-12 rounded-xl border text-sm font-semibold transition',
                position === p
                  ? 'bg-coral-500 text-white border-coral-500 shadow-sm'
                  : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
              )}>
              {t(`forms.vital_position_${p}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section n={5} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="coral" />
      </Section>

      <Section n={6} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.vital_notes_ph')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.vital_save_cta')}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UltrasoundSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, ScanLine } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

export type UltrasoundValue = {
  id?: string;
  scanned_at: string;
  gestational_week?: number | null;
  gestational_day?: number | null;
  bpd_mm?: number | null;
  hc_mm?: number | null;
  ac_mm?: number | null;
  fl_mm?: number | null;
  efw_g?: number | null;
  fhr_bpm?: number | null;
  placenta_position?: string | null;
  amniotic_fluid?: string | null;
  sex_predicted?: 'male'|'female'|'undetermined'|null;
  anomalies?: string | null;
  summary?: string | null;
  file_id?: string | null;
};

export function UltrasoundForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: UltrasoundValue;
}) {
  const router = useRouter();
  const t = useT();
  const [scannedAt, setScannedAt]   = useState(initial?.scanned_at ? isoToLocalInput(initial.scanned_at) : nowLocalInput());
  const [gw, setGw]                 = useState<string>(initial?.gestational_week?.toString() ?? '');
  const [gd, setGd]                 = useState<string>(initial?.gestational_day?.toString() ?? '');
  const [bpd, setBpd]               = useState<string>(initial?.bpd_mm?.toString() ?? '');
  const [hc, setHc]                 = useState<string>(initial?.hc_mm?.toString() ?? '');
  const [ac, setAc]                 = useState<string>(initial?.ac_mm?.toString() ?? '');
  const [fl, setFl]                 = useState<string>(initial?.fl_mm?.toString() ?? '');
  const [efw, setEfw]               = useState<string>(initial?.efw_g?.toString() ?? '');
  const [fhr, setFhr]               = useState<string>(initial?.fhr_bpm?.toString() ?? '');
  const [placenta, setPlacenta]     = useState(initial?.placenta_position ?? '');
  const [amniotic, setAmniotic]     = useState(initial?.amniotic_fluid ?? '');
  const [sex, setSex]               = useState<UltrasoundValue['sex_predicted']>(initial?.sex_predicted ?? null);
  const [anomalies, setAnomalies]   = useState(initial?.anomalies ?? '');
  const [summary, setSummary]       = useState(initial?.summary ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(scannedAt);
    if (!iso) { setErr('Pick a valid scan time.'); return; }
    const parsed = UltrasoundSchema.safeParse({
      scanned_at: iso,
      gestational_week: gw ? Number(gw) : null,
      gestational_day:  gd ? Number(gd) : null,
      bpd_mm: bpd ? Number(bpd) : null,
      hc_mm:  hc  ? Number(hc)  : null,
      ac_mm:  ac  ? Number(ac)  : null,
      fl_mm:  fl  ? Number(fl)  : null,
      efw_g:  efw ? Number(efw) : null,
      fhr_bpm: fhr ? Number(fhr) : null,
      placenta_position: placenta || null,
      amniotic_fluid:    amniotic || null,
      sex_predicted:     sex ?? null,
      anomalies:         anomalies || null,
      summary:           summary || null,
      file_id:           initial?.file_id ?? null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('ultrasounds').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('ultrasounds').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/ultrasounds`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this ultrasound?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('ultrasounds')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/prenatal/ultrasounds`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('forms.us_date')}</Label>
          <Input type="datetime-local" value={scannedAt} onChange={e => setScannedAt(e.target.value)} required />
        </div>
        <div>
          <Label>{t('forms.us_sex')}</Label>
          <Select value={sex ?? ''} onChange={e => setSex((e.target.value || null) as UltrasoundValue['sex_predicted'])}>
            <option value="">—</option>
            <option value="female">{t('overview.female')}</option>
            <option value="male">{t('overview.male')}</option>
            <option value="undetermined">{t('milestones_ref.state_pending')}</option>
          </Select>
        </div>
        <div>
          <Label>{t('forms.visit_ga_weeks')}</Label>
          <Input type="number" min={0} max={45} value={gw} onChange={e => setGw(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.visit_ga_days')}</Label>
          <Input type="number" min={0} max={6} value={gd} onChange={e => setGd(e.target.value)} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
        <h4 className="text-sm font-bold text-ink-strong mb-3">{t('forms.us_summary')}</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>{t('forms.us_bpd')}</Label>
            <Input type="number" step="0.1" value={bpd} onChange={e => setBpd(e.target.value)} />
          </div>
          <div>
            <Label>{t('forms.us_hc')}</Label>
            <Input type="number" step="0.1" value={hc} onChange={e => setHc(e.target.value)} />
          </div>
          <div>
            <Label>{t('forms.us_ac')}</Label>
            <Input type="number" step="0.1" value={ac} onChange={e => setAc(e.target.value)} />
          </div>
          <div>
            <Label>{t('forms.us_fl')}</Label>
            <Input type="number" step="0.1" value={fl} onChange={e => setFl(e.target.value)} />
          </div>
          <div>
            <Label>{t('forms.us_efw')}</Label>
            <Input type="number" step="1" value={efw} onChange={e => setEfw(e.target.value)} />
          </div>
          <div>
            <Label>{t('forms.us_fhr')}</Label>
            <Input type="number" min={50} max={250} value={fhr} onChange={e => setFhr(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('forms.us_placenta')}</Label>
          <Input value={placenta} onChange={e => setPlacenta(e.target.value)} />
        </div>
        <div>
          <Label>{t('forms.us_fluid')}</Label>
          <Input value={amniotic} onChange={e => setAmniotic(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.us_anomalies')}</Label>
          <Textarea rows={2} value={anomalies} onChange={e => setAnomalies(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>{t('forms.us_summary')}</Label>
          <Textarea rows={3} value={summary} onChange={e => setSummary(e.target.value)} />
        </div>
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-brand-500 to-lavender-500">
          <ScanLine className="h-4 w-4" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.us_save_cta')}
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

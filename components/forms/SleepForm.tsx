'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, TypeTile, WhenPicker } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { SleepSchema } from '@/lib/validators';
import { useT } from '@/lib/i18n/client';
import {
  Save, Moon, Bed, Car, Armchair, Home, Baby as BabyIcon,
  Play, Square, Smile, Frown, Meh, HelpCircle,
} from 'lucide-react';

type Location = 'crib' | 'bed' | 'car' | 'stroller' | 'arms' | 'other';
type Quality  = 'sound' | 'restless' | 'woke_often' | 'unknown';

export type SleepFormValue = {
  id?: string;
  baby_id: string;
  start_at?: string | null;
  end_at?: string | null;
  location?: Location;
  quality?: Quality | null;
  notes?: string | null;
};

export function SleepForm({ babyId, initial }: { babyId: string; initial?: SleepFormValue }) {
  const router = useRouter();
  const t = useT();
  const [startAt, setStartAt] = useState(
    initial?.start_at ? isoToLocalInput(initial.start_at) : nowLocalInput(),
  );
  const [endAt, setEndAt]     = useState(initial?.end_at ? isoToLocalInput(initial.end_at) : '');
  const [location, setLocation] = useState<Location>(initial?.location ?? 'crib');
  const [quality, setQuality]   = useState<Quality>(initial?.quality ?? 'unknown');
  const [notes, setNotes]       = useState(initial?.notes ?? '');
  const [err, setErr]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live timer
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (endAt) return; // not running
    const id = setInterval(() => setTick(t => t + 1), 1000 * 30);
    return () => clearInterval(id);
  }, [endAt, tick]);

  const startIso = localInputToIso(startAt);
  const endIso   = endAt ? localInputToIso(endAt) : null;
  const running  = !endAt;
  const referenceEnd = endIso ?? new Date().toISOString();
  const durationMin = startIso ? Math.max(0, Math.round((new Date(referenceEnd).getTime() - new Date(startIso).getTime()) / 60000)) : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = SleepSchema.safeParse({
      start_at: startIso ?? '',
      end_at: endIso,
      location,
      quality,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      start_at: parsed.data.start_at,
      end_at:   parsed.data.end_at ?? null,
      location: parsed.data.location,
      quality:  parsed.data.quality ?? null,
      notes:    parsed.data.notes ?? null,
    };
    const op = initial?.id
      ? supabase.from('sleep_logs').update(payload).eq('id', initial.id)
      : supabase.from('sleep_logs').insert({
          baby_id: babyId, ...payload,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/sleep`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this sleep entry?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('sleep_logs').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/sleep`);
    router.refresh();
  }

  function startNow() { setStartAt(nowLocalInput()); setEndAt(''); }
  function stopNow()  { setEndAt(nowLocalInput()); }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Live timer row */}
      <div className="rounded-2xl bg-gradient-to-br from-lavender-50 to-brand-50 border border-slate-200/70 p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-lavender-500 text-white grid place-items-center shadow-sm">
          <Moon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {running ? 'Sleeping now' : 'Session'}
          </div>
          <div className="text-3xl font-bold text-ink-strong leading-tight">
            {Math.floor(durationMin / 60)}h {durationMin % 60}m
          </div>
        </div>
        {running ? (
          <Button type="button" onClick={stopNow}
            className="h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-coral-600">
            <Square className="h-4 w-4" /> Stop
          </Button>
        ) : (
          <Button type="button" onClick={startNow} variant="secondary" className="h-12 rounded-2xl">
            <Play className="h-4 w-4" /> Restart
          </Button>
        )}
      </div>

      <Section n={1} title={t('forms.sleep_where')}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <TypeTile icon={BabyIcon} label={t('forms.sleep_loc_crib')}     tint="lavender" active={location === 'crib'}     onClick={() => setLocation('crib')} />
          <TypeTile icon={Bed}      label={t('forms.sleep_loc_bed')}      tint="brand"    active={location === 'bed'}      onClick={() => setLocation('bed')} />
          <TypeTile icon={Car}      label={t('forms.sleep_loc_car')}      tint="coral"    active={location === 'car'}      onClick={() => setLocation('car')} />
          <TypeTile icon={Home}     label={t('forms.sleep_loc_stroller')} tint="mint"     active={location === 'stroller'} onClick={() => setLocation('stroller')} />
          <TypeTile icon={Armchair} label={t('forms.sleep_loc_arms')}     tint="peach"    active={location === 'arms'}     onClick={() => setLocation('arms')} />
          <TypeTile icon={HelpCircle} label={t('forms.sleep_loc_other')}  tint="mint"     active={location === 'other'}    onClick={() => setLocation('other')} />
        </div>
      </Section>

      <Section n={2} title={t('forms.sleep_started_at')}>
        <WhenPicker time={startAt} onChange={setStartAt} tint="lavender" />
      </Section>

      <Section n={3} title={t('forms.sleep_ended_at')} optional>
        <WhenPicker time={endAt || nowLocalInput()} onChange={setEndAt} tint="brand" />
      </Section>

      <Section n={4} title={t('forms.sleep_quality')} optional>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <TypeTile icon={Smile}     label={t('forms.sleep_q_sound')}    tint="mint"     active={quality === 'sound'}      onClick={() => setQuality('sound')} />
          <TypeTile icon={Meh}       label={t('forms.sleep_q_restless')} tint="peach"    active={quality === 'restless'}   onClick={() => setQuality('restless')} />
          <TypeTile icon={Frown}     label={t('forms.sleep_q_woke')}     tint="coral"    active={quality === 'woke_often'} onClick={() => setQuality('woke_often')} />
          <TypeTile icon={HelpCircle} label={t('forms.sleep_q_unknown')} tint="lavender" active={quality === 'unknown'}    onClick={() => setQuality('unknown')} />
        </div>
      </Section>

      <Section n={5} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.feed_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-brand-500">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.sleep_save_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">{t('forms.delete')}</Button>
        )}
      </div>
    </form>
  );
}

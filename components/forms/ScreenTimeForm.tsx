'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ScreenTimeSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Trash2, GraduationCap, Clapperboard, Video, Tv, Tablet, Smartphone, Laptop, MoreHorizontal } from 'lucide-react';
import { Section, Field, QuickPill, Stepper, WhenPicker, TypeTile } from '@/components/forms/FormKit';

export type ScreenTimeValue = {
  id?: string;
  started_at: string;
  duration_min: number;
  content_type?: 'educational'|'entertainment'|'video_call'|'passive'|'other'|null;
  device?: 'tv'|'tablet'|'phone'|'laptop'|'other'|null;
  notes?: string | null;
};

const DEVICES: { value: NonNullable<ScreenTimeValue['device']>; label: string }[] = [
  { value: 'tv',     label: 'TV'     },
  { value: 'tablet', label: 'Tablet' },
  { value: 'phone',  label: 'Phone'  },
  { value: 'laptop', label: 'Laptop' },
  { value: 'other',  label: 'Other'  },
];

function deviceIcon(d: NonNullable<ScreenTimeValue['device']>) {
  switch (d) {
    case 'tv':     return <Tv className="h-3.5 w-3.5" />;
    case 'tablet': return <Tablet className="h-3.5 w-3.5" />;
    case 'phone':  return <Smartphone className="h-3.5 w-3.5" />;
    case 'laptop': return <Laptop className="h-3.5 w-3.5" />;
    default:       return <MoreHorizontal className="h-3.5 w-3.5" />;
  }
}

export function ScreenTimeForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ScreenTimeValue;
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState(initial?.started_at ? isoToLocalInput(initial.started_at) : nowLocalInput());
  const [duration, setDuration]   = useState<number>(initial?.duration_min ?? 15);
  const [content, setContent]     = useState<ScreenTimeValue['content_type']>(initial?.content_type ?? 'educational');
  const [device, setDevice]       = useState<ScreenTimeValue['device']>(initial?.device ?? 'tablet');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(startedAt);
    if (!iso) { setErr('Pick a valid start time.'); return; }
    if (!duration || duration <= 0) { setErr('Enter a duration in minutes.'); return; }
    const parsed = ScreenTimeSchema.safeParse({
      started_at: iso,
      duration_min: Number(duration),
      content_type: content || null,
      device: device || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('screen_time_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('screen_time_logs').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/screen-time`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this screen-time log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('screen_time_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/screen-time`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* 1. Content type */}
      <Section n={1} title="What were they watching?">
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TypeTile icon={GraduationCap} label="Educational"    tint="lavender" active={content === 'educational'}    onClick={() => setContent('educational')} />
            <TypeTile icon={Clapperboard}  label="Entertainment"  tint="lavender" active={content === 'entertainment'}  onClick={() => setContent('entertainment')} />
            <TypeTile icon={Video}         label="Video call"     tint="lavender" active={content === 'video_call'}     onClick={() => setContent('video_call')} />
            <TypeTile icon={Tv}            label="Passive"        tint="lavender" active={content === 'passive'}        onClick={() => setContent('passive')} sub="TV in background" />
          </div>
          <button
            type="button"
            onClick={() => setContent('other')}
            className={
              content === 'other'
                ? 'inline-flex items-center gap-1.5 rounded-full border border-lavender-500 bg-lavender-500 px-4 py-1.5 text-sm text-white shadow-sm'
                : 'inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-ink hover:bg-slate-50'
            }
          >
            Something else
          </button>
        </div>
      </Section>

      {/* 2. Device + Duration */}
      <Section n={2} title="On what device, and for how long?">
        <div className="space-y-4">
          <Field label="Device">
            <div className="flex flex-wrap gap-2">
              {DEVICES.map(d => (
                <QuickPill
                  key={d.value}
                  active={device === d.value}
                  onClick={() => setDevice(d.value)}
                  tint="lavender"
                  icon={deviceIcon(d.value)}
                >
                  {d.label}
                </QuickPill>
              ))}
            </div>
          </Field>

          <Stepper
            label="Duration"
            value={duration}
            onChange={setDuration}
            unit="min"
            step={5}
            min={1}
            max={1440}
            badge={{ text: 'TIME', tint: 'lavender' }}
          />
        </div>
      </Section>

      {/* 3. When */}
      <Section n={3} title="When?">
        <WhenPicker time={startedAt} onChange={setStartedAt} tint="lavender" />
      </Section>

      {/* 4. Notes */}
      <Section n={4} title="Add details" optional>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What was watched / who was on the call / mood after…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-lavender-500 focus:ring-2 focus:ring-lavender-500/30"
        />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-lavender-500 to-brand-500 hover:from-lavender-600 hover:to-brand-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save screen time'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-center text-xs text-ink-muted">Takes less than 2 seconds <span className="text-coral-500">❤️</span></p>
    </form>
  );
}

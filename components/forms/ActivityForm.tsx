'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ActivitySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ActivityValue = {
  id?: string;
  started_at: string;
  duration_min?: number | null;
  activity_type: string;
  intensity?: 'low'|'moderate'|'high'|null;
  location?: string | null;
  mood?: 'happy'|'calm'|'fussy'|'tired'|'curious'|'other'|null;
  notes?: string | null;
};

const SUGGESTED_ACTIVITIES = [
  'Tummy time', 'Walk', 'Park', 'Swim', 'Music time', 'Reading',
  'Sensory play', 'Massage', 'Bath play', 'Garden', 'Dancing', 'Gym',
];

export function ActivityForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ActivityValue;
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState(initial?.started_at ? isoToLocalInput(initial.started_at) : nowLocalInput());
  const [duration, setDuration]   = useState<string>(initial?.duration_min?.toString() ?? '15');
  const [type, setType]           = useState(initial?.activity_type ?? '');
  const [intensity, setIntensity] = useState<ActivityValue['intensity']>(initial?.intensity ?? 'low');
  const [location, setLocation]   = useState(initial?.location ?? '');
  const [mood, setMood]           = useState<ActivityValue['mood']>(initial?.mood ?? 'happy');
  const [notes, setNotes]         = useState(initial?.notes ?? '');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(startedAt);
    if (!iso) { setErr('Pick a valid start time.'); return; }
    const parsed = ActivitySchema.safeParse({
      started_at: iso,
      duration_min: duration ? Number(duration) : null,
      activity_type: type,
      intensity: intensity || null,
      location: location || null,
      mood: mood || null,
      notes: notes || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const op = initial?.id
      ? supabase.from('activity_logs').update({ ...parsed.data }).eq('id', initial.id)
      : supabase.from('activity_logs').insert({
          baby_id: babyId, ...parsed.data,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/activities`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this activity log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('activity_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/activities`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Quick-pick activity chips */}
      {!initial?.id && (
        <div>
          <Label>Quick pick</Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SUGGESTED_ACTIVITIES.map(a => (
              <button key={a} type="button" onClick={() => setType(a)}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition',
                  type === a
                    ? 'bg-mint-500 text-white shadow-sm'
                    : 'bg-mint-50 text-mint-700 hover:bg-mint-100'
                )}>
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Activity</Label>
          <Input value={type} onChange={e => setType(e.target.value)} required placeholder="e.g. Tummy time, Park walk, Swimming class" />
        </div>
        <div>
          <Label>Started at</Label>
          <Input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} required />
        </div>
        <div>
          <Label>Duration (min)</Label>
          <Input type="number" min={1} max={720} value={duration} onChange={e => setDuration(e.target.value)} placeholder="15" />
        </div>
        <div>
          <Label>Intensity</Label>
          <Select value={intensity ?? ''} onChange={e => setIntensity((e.target.value || null) as ActivityValue['intensity'])}>
            <option value="">— Unspecified —</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </Select>
        </div>
        <div>
          <Label>Mood</Label>
          <Select value={mood ?? ''} onChange={e => setMood((e.target.value || null) as ActivityValue['mood'])}>
            <option value="">— Unspecified —</option>
            <option value="happy">Happy</option>
            <option value="calm">Calm</option>
            <option value="curious">Curious</option>
            <option value="fussy">Fussy</option>
            <option value="tired">Tired</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Location</Label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Home, park, grandma's house, gym…" />
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="What happened, milestones, reactions…" />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-mint-500 to-brand-500">
          <Activity className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Log activity'}
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

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ScreenTimeSchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Trash2, Tv } from 'lucide-react';

export type ScreenTimeValue = {
  id?: string;
  started_at: string;
  duration_min: number;
  content_type?: 'educational'|'entertainment'|'video_call'|'passive'|'other'|null;
  device?: 'tv'|'tablet'|'phone'|'laptop'|'other'|null;
  notes?: string | null;
};

export function ScreenTimeForm({
  babyId, initial,
}: {
  babyId: string;
  initial?: ScreenTimeValue;
}) {
  const router = useRouter();
  const [startedAt, setStartedAt] = useState(initial?.started_at ? isoToLocalInput(initial.started_at) : nowLocalInput());
  const [duration, setDuration]   = useState<string>(initial?.duration_min?.toString() ?? '15');
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
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Started at</Label>
          <Input type="datetime-local" value={startedAt} onChange={e => setStartedAt(e.target.value)} required />
        </div>
        <div>
          <Label>Duration (min)</Label>
          <Input type="number" min={1} max={1440} value={duration} onChange={e => setDuration(e.target.value)} required />
        </div>
        <div>
          <Label>Content</Label>
          <Select value={content ?? ''} onChange={e => setContent((e.target.value || null) as ScreenTimeValue['content_type'])}>
            <option value="">— Unknown —</option>
            <option value="educational">Educational</option>
            <option value="entertainment">Entertainment</option>
            <option value="video_call">Video call</option>
            <option value="passive">Passive (TV in background)</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div>
          <Label>Device</Label>
          <Select value={device ?? ''} onChange={e => setDevice((e.target.value || null) as ScreenTimeValue['device'])}>
            <option value="">— Unknown —</option>
            <option value="tv">TV</option>
            <option value="tablet">Tablet</option>
            <option value="phone">Phone</option>
            <option value="laptop">Laptop</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Notes</Label>
        <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="What was watched / who was on the call / mood after…" />
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500">
          <Tv className="h-4 w-4" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save screen time'}
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

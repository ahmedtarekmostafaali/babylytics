'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BabySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { isoToLocalInput, localInputToIso } from '@/lib/dates';
import { fmtMl, fmtKg } from '@/lib/units';
import { BabyAvatar } from '@/components/BabyAvatar';
import { Camera, Trash2 } from 'lucide-react';

export type BabyEditValue = {
  id: string;
  name: string;
  dob: string;
  gender: 'male'|'female'|'other'|'unspecified';
  birth_weight_kg: number | null;
  birth_height_cm: number | null;
  feeding_factor_ml_per_kg_per_day: number;
  notes: string | null;
  avatar_path?: string | null;
};

const AVATAR_BUCKET = 'medical-files';

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function BabyEditForm({
  baby,
  currentWeightKg,
  canDelete,
  avatarUrl,
}: {
  baby: BabyEditValue;
  currentWeightKg: number | null;
  canDelete: boolean;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName]           = useState(baby.name);
  const [dob, setDob]             = useState(isoToLocalInput(baby.dob));
  const [gender, setGender]       = useState(baby.gender);
  const [birthWeight, setBirthWeight] = useState(baby.birth_weight_kg?.toString() ?? '');
  const [birthHeight, setBirthHeight] = useState(baby.birth_height_cm?.toString() ?? '');
  const [factor, setFactor]       = useState(baby.feeding_factor_ml_per_kg_per_day.toString());
  const [notes, setNotes]         = useState(baby.notes ?? '');
  const [err, setErr]             = useState<string | null>(null);
  const [msg, setMsg]             = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);

  const [localAvatar, setLocalAvatar] = useState<string | null>(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const factorNum = Number(factor);
  const weightForCalc = currentWeightKg ?? Number(birthWeight || 0);
  const previewRecommended =
    Number.isFinite(factorNum) && Number.isFinite(weightForCalc)
      ? Math.round(weightForCalc * factorNum)
      : 0;

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image.'); return; }
    setErr(null); setMsg(null); setUploadingAvatar(true);
    const supabase = createClient();
    const path = `babies/${baby.id}/avatar/${Date.now()}_${sanitize(file.name)}`;
    const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: '60',
      upsert: false,
      contentType: file.type,
    });
    if (up.error) { setUploadingAvatar(false); setErr(up.error.message); return; }
    const { error: updErr } = await supabase
      .from('babies')
      .update({ avatar_path: path })
      .eq('id', baby.id);
    if (updErr) { setUploadingAvatar(false); setErr(updErr.message); return; }

    // Immediately preview locally via a signed URL so the user sees the new avatar.
    const { data: signed } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 600);
    setLocalAvatar(signed?.signedUrl ?? null);
    setUploadingAvatar(false);
    setMsg('Photo updated.');
    router.refresh();
  }

  async function onAvatarClear() {
    if (!window.confirm('Remove baby photo?')) return;
    setUploadingAvatar(true);
    const supabase = createClient();
    const { error } = await supabase.from('babies').update({ avatar_path: null }).eq('id', baby.id);
    setUploadingAvatar(false);
    if (error) { setErr(error.message); return; }
    setLocalAvatar(null);
    setMsg('Photo removed.');
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const parsed = BabySchema.safeParse({
      name, dob, gender,
      birth_weight_kg: birthWeight || null,
      birth_height_cm: birthHeight || null,
      feeding_factor: factor,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('babies').update({
      name: parsed.data.name,
      dob: localInputToIso(parsed.data.dob),
      gender: parsed.data.gender,
      birth_weight_kg: parsed.data.birth_weight_kg ?? null,
      birth_height_cm: parsed.data.birth_height_cm ?? null,
      feeding_factor_ml_per_kg_per_day: parsed.data.feeding_factor,
      notes: notes || null,
    }).eq('id', baby.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg('Saved.');
    router.push(`/babies/${baby.id}`);
    router.refresh();
  }

  async function onSoftDelete() {
    if (!window.confirm(`Delete ${baby.name}'s profile? All their logs remain in the database but the baby will disappear from your dashboard. This can be restored by a database admin.`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('babies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', baby.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={submit}>
      {/* Avatar upload */}
      <div className="flex items-center gap-5 flex-wrap rounded-2xl bg-gradient-to-br from-brand-50 to-mint-50 border border-slate-200/70 p-4">
        <BabyAvatar url={localAvatar} size="2xl" />
        <div className="flex-1 min-w-[200px]">
          <div className="text-sm font-semibold text-ink-strong">Baby photo</div>
          <p className="text-xs text-ink-muted mt-0.5">JPG or PNG, square looks best. Caregivers with access see this.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 hover:bg-brand-600 text-white text-sm px-4 py-1.5 shadow-sm disabled:opacity-60"
            >
              <Camera className="h-4 w-4" />
              {uploadingAvatar ? 'Uploading…' : localAvatar ? 'Change photo' : 'Upload photo'}
            </button>
            {localAvatar && !uploadingAvatar && (
              <button
                type="button"
                onClick={onAvatarClear}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white text-ink text-sm px-4 py-1.5 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="n">Name</Label>
        <Input id="n" required value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="d">Date &amp; time of birth</Label>
        <Input id="d" type="datetime-local" required value={dob} onChange={e => setDob(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="g">Gender</Label>
        <Select id="g" value={gender} onChange={e => setGender(e.target.value as typeof gender)}>
          <option value="unspecified">Unspecified</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="bw">Birth weight (kg)</Label>
          <Input id="bw" type="number" step="0.001" min={0} max={10} value={birthWeight} onChange={e => setBirthWeight(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="bh">Birth height (cm)</Label>
          <Input id="bh" type="number" step="0.1" min={0} max={80} value={birthHeight} onChange={e => setBirthHeight(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="f">Feeding factor (ml / kg / day)</Label>
        <Input id="f" type="number" step="1" min={50} max={250} value={factor} onChange={e => setFactor(e.target.value)} />
        <div className="mt-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700">
          <div>Recommended daily feed preview (live):</div>
          <div className="mt-1 font-mono text-slate-900">
            {fmtKg(weightForCalc)} × {factor || '—'} ml/kg/day = <span className="font-semibold">{fmtMl(previewRecommended)}</span>
            {currentWeightKg == null && <span className="ml-2 text-amber-700">(using birth weight; log a measurement for a more accurate number)</span>}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Typical factors: 150 for newborns (default), 120–140 after 3 months, 100 after 6 months with solids.
        </p>
      </div>
      <div>
        <Label htmlFor="no">Notes</Label>
        <Textarea id="no" rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)} />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        {canDelete && (
          <Button type="button" variant="danger" onClick={onSoftDelete} disabled={saving}>
            Delete profile
          </Button>
        )}
      </div>
    </form>
  );
}

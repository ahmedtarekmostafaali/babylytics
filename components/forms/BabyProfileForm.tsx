'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BabySchema } from '@/lib/validators';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { BabyAvatar } from '@/components/BabyAvatar';
import { isoToLocalInput, localInputToIso } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { fmtMl, fmtKg } from '@/lib/units';
import {
  Camera, Trash2, Save, Info, Gift, Stethoscope, SlidersHorizontal, StickyNote,
  Loader2,
} from 'lucide-react';

export type BabyProfileValue = {
  id: string;
  name: string;
  nickname?: string | null;
  dob: string;
  gender: 'male'|'female'|'other'|'unspecified';
  birth_weight_kg: number | null;
  birth_height_cm: number | null;
  feeding_factor_ml_per_kg_per_day: number;
  notes: string | null;
  avatar_path?: string | null;
  blood_type?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  doctor_clinic?: string | null;
  next_appointment_at?: string | null;
  next_appointment_notes?: string | null;
};

type Tab = 'basic' | 'birth' | 'health' | 'prefs' | 'notes';
const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'basic',  label: 'Basic Info',   icon: Info },
  { key: 'birth',  label: 'Birth Stats',  icon: Gift },
  { key: 'health', label: 'Health Info',  icon: Stethoscope },
  { key: 'prefs',  label: 'Preferences',  icon: SlidersHorizontal },
  { key: 'notes',  label: 'Notes',        icon: StickyNote },
];

const AVATAR_BUCKET = 'medical-files';
function sanitize(name: string): string { return name.replace(/[^a-zA-Z0-9._-]+/g, '_'); }

export function BabyProfileForm({
  baby, currentWeightKg, canDelete, canEditHealth, avatarUrl,
}: {
  baby: BabyProfileValue;
  currentWeightKg: number | null;
  canDelete: boolean;
  /** Parent/owner only — controls doctor + appointment visibility & edit. */
  canEditHealth: boolean;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('basic');

  // Basic
  const [name, setName]       = useState(baby.name);
  const [nick, setNick]       = useState(baby.nickname ?? '');
  const [dob, setDob]         = useState(isoToLocalInput(baby.dob));
  const [gender, setGender]   = useState(baby.gender);

  // Birth
  const [bw, setBw]       = useState(baby.birth_weight_kg?.toString() ?? '');
  const [bh, setBh]       = useState(baby.birth_height_cm?.toString() ?? '');
  const [factor, setFactor] = useState(baby.feeding_factor_ml_per_kg_per_day.toString());

  // Health
  const [blood, setBlood]       = useState<string>(baby.blood_type ?? 'unknown');
  const [docName, setDocName]   = useState(baby.doctor_name ?? '');
  const [docPhone, setDocPhone] = useState(baby.doctor_phone ?? '');
  const [docClinic, setDocClinic] = useState(baby.doctor_clinic ?? '');
  const [appt, setAppt]         = useState(baby.next_appointment_at ? isoToLocalInput(baby.next_appointment_at) : '');
  const [apptNotes, setApptNotes] = useState(baby.next_appointment_notes ?? '');

  // Notes
  const [notes, setNotes] = useState(baby.notes ?? '');

  // Avatar
  const [localAvatar, setLocalAvatar] = useState<string | null>(avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const factorNum = Number(factor);
  const weightForCalc = currentWeightKg ?? Number(bw || 0);
  const previewRecommended = Number.isFinite(factorNum) && Number.isFinite(weightForCalc)
    ? Math.round(weightForCalc * factorNum) : 0;

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image.'); return; }
    setErr(null); setMsg(null); setUploadingAvatar(true);
    const supabase = createClient();
    const path = `babies/${baby.id}/avatar/${Date.now()}_${sanitize(file.name)}`;
    const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
      cacheControl: '60', upsert: false, contentType: file.type,
    });
    if (up.error) { setUploadingAvatar(false); setErr(up.error.message); return; }
    const { error: updErr } = await supabase.from('babies').update({ avatar_path: path }).eq('id', baby.id);
    if (updErr) { setUploadingAvatar(false); setErr(updErr.message); return; }
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
      birth_weight_kg: bw || null,
      birth_height_cm: bh || null,
      feeding_factor: factor,
      blood_type: blood || 'unknown',
      doctor_name:  canEditHealth ? (docName || null)   : undefined,
      doctor_phone: canEditHealth ? (docPhone || null)  : undefined,
      doctor_clinic:canEditHealth ? (docClinic || null) : undefined,
      next_appointment_at: canEditHealth ? (appt ? localInputToIso(appt) : null) : undefined,
      next_appointment_notes: canEditHealth ? (apptNotes || null) : undefined,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      name: parsed.data.name,
      dob: localInputToIso(parsed.data.dob),
      gender: parsed.data.gender,
      birth_weight_kg: parsed.data.birth_weight_kg ?? null,
      birth_height_cm: parsed.data.birth_height_cm ?? null,
      feeding_factor_ml_per_kg_per_day: parsed.data.feeding_factor,
      notes: notes || null,
      blood_type: parsed.data.blood_type ?? 'unknown',
    };
    if (canEditHealth) {
      payload.doctor_name  = parsed.data.doctor_name  ?? null;
      payload.doctor_phone = parsed.data.doctor_phone ?? null;
      payload.doctor_clinic = parsed.data.doctor_clinic ?? null;
      payload.next_appointment_at    = parsed.data.next_appointment_at ?? null;
      payload.next_appointment_notes = parsed.data.next_appointment_notes ?? null;
    }
    const { error } = await supabase.from('babies').update(payload).eq('id', baby.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setMsg('Saved.');
    router.refresh();
  }

  async function onSoftDelete() {
    if (!window.confirm(`Delete ${baby.name}'s profile? Logs remain in the database but the baby disappears from your dashboard.`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('babies').update({ deleted_at: new Date().toISOString() }).eq('id', baby.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Hero band — avatar + name + chips */}
      <div className="relative overflow-hidden rounded-[32px] border border-slate-200/70 bg-gradient-to-br from-coral-50 via-peach-50 to-mint-50 shadow-card p-6 flex items-center gap-6 flex-wrap">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id="bpf-a" cx="85%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#F4A6A6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F4A6A6" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="300" fill="url(#bpf-a)" />
          <circle cx="700" cy="60" r="70" fill="#FFF" opacity="0.4" />
          <circle cx="760" cy="240" r="40" fill="#FFF" opacity="0.3" />
        </svg>
        <div className="relative">
          <BabyAvatar url={localAvatar} size="2xl" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploadingAvatar}
            title="Change photo"
            className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-white grid place-items-center shadow-card border border-slate-200 text-ink hover:bg-slate-50">
            {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarChange} className="hidden" />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-mint-700">Baby profile</div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <h2 className="text-3xl font-bold tracking-tight text-ink-strong">{name || 'Unnamed'}</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Chip tint="coral">{gender}</Chip>
            {currentWeightKg != null && <Chip tint="mint">{fmtKg(currentWeightKg)}</Chip>}
            <Chip tint="brand">Healthy</Chip>
            {blood && blood !== 'unknown' && <Chip tint="peach">{blood}</Chip>}
          </div>
          {localAvatar && !uploadingAvatar && (
            <button type="button" onClick={onAvatarClear}
              className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-coral-700">
              <Trash2 className="h-3 w-3" /> Remove photo
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2 sm:gap-6 -mb-px">
          {TABS.map(t => {
            const active = tab === t.key;
            const Icon = t.icon;
            if (t.key === 'health' && !canEditHealth) return null;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-3 text-sm border-b-2 transition whitespace-nowrap',
                  active ? 'border-coral-500 text-coral-700 font-semibold' : 'border-transparent text-ink-muted hover:text-ink',
                )}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab panels */}
      {tab === 'basic' && (
        <SectionCard icon={Info} tint="coral" title="Basic Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </Field>
            <Field label="Nickname (optional)">
              <Input value={nick} onChange={e => setNick(e.target.value)} placeholder="Juju" />
            </Field>
            <Field label="Date & time of birth">
              <Input type="datetime-local" value={dob} onChange={e => setDob(e.target.value)} required />
            </Field>
            <Field label="Gender">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: 'female', label: 'Female' },
                  { v: 'male',   label: 'Male' },
                  { v: 'other',  label: 'Other' },
                ].map(o => (
                  <button type="button" key={o.v} onClick={() => setGender(o.v as typeof gender)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                      gender === o.v ? 'border-coral-500 bg-coral-50 text-coral-700' : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}>
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </SectionCard>
      )}

      {tab === 'birth' && (
        <SectionCard icon={Gift} tint="mint" title="Birth Stats">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Birth weight">
              <div className="flex gap-2">
                <Input type="number" step="0.001" min={0} max={10} value={bw} onChange={e => setBw(e.target.value)} placeholder="3.25" />
                <span className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 grid place-items-center text-sm text-ink-muted">kg</span>
              </div>
            </Field>
            <Field label="Birth height">
              <div className="flex gap-2">
                <Input type="number" step="0.1" min={0} max={80} value={bh} onChange={e => setBh(e.target.value)} placeholder="51" />
                <span className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 grid place-items-center text-sm text-ink-muted">cm</span>
              </div>
            </Field>
            <Field label="Feeding factor (ml / kg / day)" className="sm:col-span-2">
              <Input type="number" step="1" min={50} max={250} value={factor} onChange={e => setFactor(e.target.value)} />
              <div className="mt-2 rounded-xl bg-mint-50 px-3 py-2 text-xs text-mint-900">
                {fmtKg(weightForCalc)} × {factor || '—'} ml/kg/day = <span className="font-semibold">{fmtMl(previewRecommended)}</span>
                {currentWeightKg == null && <span className="ml-2 text-peach-700">(using birth weight)</span>}
              </div>
              <p className="text-xs text-ink-muted mt-1">Recommended: 150 – 200 ml / kg / day for newborns.</p>
            </Field>
          </div>
        </SectionCard>
      )}

      {tab === 'health' && canEditHealth && (
        <SectionCard icon={Stethoscope} tint="lavender" title="Health Information">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Blood type">
              <Select value={blood} onChange={e => setBlood(e.target.value)}>
                {['unknown','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b =>
                  <option key={b} value={b}>{b}</option>
                )}
              </Select>
            </Field>
          </div>
          <div className="mt-5 rounded-2xl border border-lavender-200 bg-gradient-to-br from-lavender-50 to-white p-4 flex items-start gap-3">
            <span className="h-10 w-10 rounded-xl bg-lavender-500 text-white grid place-items-center shrink-0">
              <Stethoscope className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink-strong">Doctors &amp; appointments moved</div>
              <p className="text-xs text-ink-muted mt-0.5">
                You can now add <strong>multiple doctors</strong> (pediatrician, specialist, dentist) and book
                appointments with each of them from their own dedicated page.
              </p>
              <a href={`/babies/${baby.id}/doctors`}
                className="mt-2 inline-flex items-center gap-1 rounded-full bg-lavender-500 hover:bg-lavender-600 text-white text-xs font-semibold px-3 py-1.5">
                Open Doctors &amp; appointments →
              </a>
            </div>
          </div>
          <div className="mt-3 text-xs text-ink-muted">
            Doctor details and appointments are visible to parents and owners only — doctors, nurses and caregivers don&apos;t see this section.
          </div>
          {/* Hidden fields kept to preserve the form's state contract. */}
          <input type="hidden" value={docName ?? ''} readOnly />
          <input type="hidden" value={docPhone ?? ''} readOnly />
          <input type="hidden" value={docClinic ?? ''} readOnly />
          <input type="hidden" value={appt ?? ''} readOnly />
          <input type="hidden" value={apptNotes ?? ''} readOnly />
        </SectionCard>
      )}

      {tab === 'prefs' && (
        <SectionCard icon={SlidersHorizontal} tint="brand" title="Preferences">
          <p className="text-sm text-ink-muted">
            Language, timezone and unit preferences are coming soon. For now the app runs in English with metric units and the Africa/Cairo timezone.
          </p>
        </SectionCard>
      )}

      {tab === 'notes' && (
        <SectionCard icon={StickyNote} tint="peach" title="Notes">
          <Textarea rows={6} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
            placeholder="Anything other caregivers should know…" />
        </SectionCard>
      )}

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}
      {msg && <p className="text-sm text-mint-700 font-medium">{msg}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}
          className="flex-1 h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-coral-500 to-coral-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {canDelete && (
          <Button type="button" variant="danger" onClick={onSoftDelete} disabled={saving}
            className="h-14 rounded-2xl">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </div>
    </form>
  );
}

function Chip({ tint, children }: { tint: 'coral'|'mint'|'brand'|'peach'|'lavender'; children: React.ReactNode }) {
  const map = {
    coral:    'bg-white/80 text-coral-700',
    mint:     'bg-white/80 text-mint-700',
    brand:    'bg-white/80 text-brand-700',
    peach:    'bg-white/80 text-peach-700',
    lavender: 'bg-white/80 text-lavender-700',
  }[tint];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 font-medium shadow-sm ${map}`}>{children}</span>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SectionCard({
  icon: Icon, tint, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tint: 'coral' | 'mint' | 'lavender' | 'brand' | 'peach';
  title: string;
  children: React.ReactNode;
}) {
  const tintClasses = {
    coral:    'bg-coral-100 text-coral-600',
    mint:     'bg-mint-100 text-mint-600',
    lavender: 'bg-lavender-100 text-lavender-600',
    brand:    'bg-brand-100 text-brand-600',
    peach:    'bg-peach-100 text-peach-600',
  }[tint];
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={cn('h-9 w-9 rounded-xl grid place-items-center shrink-0', tintClasses)}>
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-lg font-bold text-ink-strong">{title}</h3>
      </div>
      {children}
    </section>
  );
}


'use client';

// BumpPhotoForm — Wave 38B. Lets the user upload a single bump photo
// with optional belly-circumference + weight + note. Mirrors the
// UploadForm pattern: storage upload first, then RPC insert (which
// auto-computes gestational week from LMP/EDD).

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react';

const BUCKET = 'medical-files';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}
function makeToken(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function BumpPhotoForm({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr = lang === 'ar';

  const [bellyCm,   setBellyCm]   = useState('');
  const [weightKg,  setWeightKg]  = useState('');
  const [week,      setWeek]      = useState('');  // optional override
  const [notes,     setNotes]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setSuccess(false);
    setBusy(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); setErr(isAr ? 'يجب تسجيل الدخول' : 'Not signed in'); return; }

    let storage_path: string | null = null;
    let mime_type:    string | null = null;
    const file = fileRef.current?.files?.[0];

    if (file) {
      if (!file.type.startsWith('image/')) {
        setBusy(false);
        setErr(isAr ? 'الملف يجب أن يكون صورة' : 'File must be an image');
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setBusy(false);
        setErr(isAr ? 'الصورة أكبر من ٨ ميجا' : 'Image over 8 MB');
        return;
      }
      const path = `babies/${babyId}/bumps/${makeToken()}_${safeName(file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (up.error) { setBusy(false); setErr(up.error.message); return; }
      storage_path = path;
      mime_type    = file.type;
    }

    const { error } = await supabase.rpc('add_bump_photo', {
      p_baby:             babyId,
      p_taken_at:         new Date().toISOString(),
      p_storage_path:     storage_path,
      p_mime_type:        mime_type,
      p_gestational_week: week ? Number(week) : null,
      p_belly_circ_cm:    bellyCm ? Number(bellyCm) : null,
      p_weight_kg:        weightKg ? Number(weightKg) : null,
      p_notes:            notes.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setSuccess(true);
    setBellyCm(''); setWeightKg(''); setWeek(''); setNotes('');
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  }

  return (
    <form onSubmit={submit}
      className="rounded-2xl border border-slate-200 bg-white shadow-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-coral-100 text-coral-700 grid place-items-center shrink-0">
          <Camera className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-ink-strong">
            {isAr ? 'إضافة صورة جديدة للبطن' : 'Add a new bump photo'}
          </h3>
          <p className="text-xs text-ink-muted">
            {isAr
              ? 'أسبوع الحمل يُحسب تلقائياً. كل الحقول الباقية اختيارية.'
              : 'Gestational week is auto-computed. Every other field is optional.'}
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          {isAr ? 'الصورة' : 'Photo'}
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          className="mt-1 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-coral-500 file:px-3 file:py-2 file:text-white hover:file:bg-coral-600 file:cursor-pointer file:text-xs file:font-semibold" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'الأسبوع' : 'Week'}
          </label>
          <input type="number" min={1} max={42} value={week}
            onChange={e => setWeek(e.target.value)}
            placeholder={isAr ? 'تلقائي' : 'auto'}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'محيط البطن (سم)' : 'Belly (cm)'}
          </label>
          <input type="number" step="0.5" min={40} max={200} value={bellyCm}
            onChange={e => setBellyCm(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            {isAr ? 'الوزن (كجم)' : 'Weight (kg)'}
          </label>
          <input type="number" step="0.1" min={30} max={200} value={weightKg}
            onChange={e => setWeightKg(e.target.value)}
            placeholder="—"
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          {isAr ? 'ملاحظة' : 'Note'}
        </label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          rows={2} maxLength={400}
          placeholder={isAr ? 'مثال: شعرت بأول حركة' : 'e.g. felt first kick today'}
          className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm" />
      </div>

      {err && (
        <div className="rounded-lg border border-coral-200 bg-coral-50 p-2 text-xs text-coral-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{err}</span>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-mint-200 bg-mint-50/60 p-2 text-xs text-mint-700 flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{isAr ? 'تم الحفظ' : 'Saved'}</span>
        </div>
      )}

      <button type="submit" disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold text-sm px-5 py-2 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {isAr ? 'حفظ الصورة' : 'Save photo'}
      </button>
    </form>
  );
}

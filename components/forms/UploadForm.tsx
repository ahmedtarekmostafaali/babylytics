'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Input';
import type { FileKind } from '@/lib/types';
import { useT } from '@/lib/i18n/client';

const BUCKET = 'medical-files';

const KIND_DIR: Record<FileKind, string> = {
  prescription:      'prescriptions',
  report:            'reports',
  stool_image:       'stool_images',
  daily_note:        'daily_notes',
  other:             'other',
  admission_report:  'admissions',
  discharge_report:  'discharges',
  lab_report:        'labs',
  ultrasound:        'ultrasounds',
  prenatal_lab:      'prenatal_labs',
  maternal_vitals:   'maternal_vitals',
  genetic_screening: 'genetic',
  birth_plan:        'birth_plans',
};

const KIND_HINTS_HANDWRITTEN: Record<FileKind, boolean> = {
  prescription:      false,
  report:            false,
  stool_image:       false,
  daily_note:        true,
  other:             false,
  admission_report:  false,
  discharge_report:  false,
  lab_report:        false,
  ultrasound:        false,
  prenatal_lab:      false,
  maternal_vitals:   false,
  genetic_screening: false,
  birth_plan:        false,
};

function randomToken() {
  // short, url-safe, no deps
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function UploadForm({ babyId }: { babyId: string }) {
  const router = useRouter();
  const t = useT();
  const [kind, setKind]     = useState<FileKind>('daily_note');
  const [handwritten, setHandwritten] = useState<boolean>(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const [msg, setMsg]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onKindChange(k: FileKind) {
    setKind(k);
    setHandwritten(KIND_HINTS_HANDWRITTEN[k]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr(t('forms.up_pick_file')); return; }
    setBusy(true);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); setErr(t('forms.up_not_signed_in')); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `babies/${babyId}/${KIND_DIR[kind]}/${randomToken()}_${safeName}`;

    // 1. Upload to storage (RLS policies gate write access by path)
    const up = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (up.error) { setBusy(false); setErr(up.error.message); return; }

    // 2. Create medical_files row
    const ins = await supabase.from('medical_files').insert({
      baby_id: babyId,
      kind,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      is_handwritten: handwritten,
      uploaded_by: auth.user.id,
    }).select('id').single();
    if (ins.error || !ins.data) { setBusy(false); setErr(ins.error?.message ?? t('forms.up_db_failed')); return; }

    const fileId = ins.data.id as string;
    setMsg(t('forms.up_running_ocr'));

    // 3. Kick off OCR (non-blocking for the user, but we wait so we can route to review).
    //    OCR is only auto-run on daily_note / prescription / report. Stool images skip.
    let extractedId: string | null = null;
    if (kind !== 'stool_image' && kind !== 'other') {
      const { data: ocr, error: ocrErr } = await supabase.functions.invoke('ocr-extract', {
        body: { file_id: fileId },
      });
      if (ocrErr) {
        // Upload succeeded; OCR failed. Surface message but still land on file page.
        setMsg(t('forms.up_ocr_failed'));
      } else if (ocr && typeof ocr === 'object' && 'extracted_id' in ocr) {
        extractedId = (ocr as { extracted_id: string }).extracted_id;
      }
    }

    setBusy(false);
    if (extractedId) {
      router.push(`/babies/${babyId}/ocr/${extractedId}`);
    } else {
      router.push(`/babies/${babyId}/files/${fileId}`);
    }
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <Label htmlFor="k">{t('forms.up_file_type')}</Label>
        <Select id="k" value={kind} onChange={e => onKindChange(e.target.value as FileKind)}>
          <option value="daily_note">{t('forms.up_kind_daily')}</option>
          <option value="prescription">{t('forms.up_kind_rx')}</option>
          <option value="report">{t('forms.up_kind_report')}</option>
          <option value="stool_image">{t('forms.up_kind_stool')}</option>
          <option value="other">{t('forms.up_kind_other')}</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="f">{t('forms.up_file_label')}</Label>
        <input
          id="f"
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          required
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-500 file:px-3 file:py-2 file:text-white hover:file:bg-brand-600"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={handwritten} onChange={e => setHandwritten(e.target.checked)} />
        {t('forms.up_handwritten')}
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={busy}>{busy ? t('forms.up_uploading') : t('forms.up_submit')}</Button>
      <p className="text-xs text-slate-500">
        {t('forms.up_help')}
      </p>
    </form>
  );
}

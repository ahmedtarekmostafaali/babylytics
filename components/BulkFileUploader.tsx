'use client';

// BulkFileUploader — Wave 28. Drop or pick up to 50 files at once and
// upload them all to medical_files in one batch. Each file's kind is
// auto-guessed from the filename and overridable per-file before
// committing. OCR is NOT triggered automatically — bulk uploads stay
// fast and the user opens the file's page later to run OCR if they
// want the contents extracted.
//
// Sequential uploads with per-file progress + a final summary. The
// existing single-file UploadForm pattern (storage upload → insert
// medical_files row) is reused per file.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Upload, Loader2, Check, AlertCircle, X, FileText, Image as ImageIcon,
  ArrowRight,
} from 'lucide-react';

const BUCKET = 'medical-files';
const MAX_FILES = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB / file

// File-kind catalogue — same enum as medical_files_kind_check.
type FileKind =
  | 'prescription' | 'report' | 'lab_report' | 'ultrasound'
  | 'admission_report' | 'discharge_report' | 'prenatal_lab'
  | 'maternal_vitals' | 'genetic_screening' | 'birth_plan'
  | 'daily_note' | 'other';

const KIND_DIR: Record<FileKind, string> = {
  prescription:      'prescriptions',
  report:            'reports',
  lab_report:        'labs',
  ultrasound:        'ultrasounds',
  admission_report:  'admissions',
  discharge_report:  'discharges',
  prenatal_lab:      'prenatal_labs',
  maternal_vitals:   'maternal_vitals',
  genetic_screening: 'genetic',
  birth_plan:        'birth_plans',
  daily_note:        'daily_notes',
  other:             'other',
};

const KIND_LABEL: Record<FileKind, { en: string; ar: string }> = {
  prescription:      { en: 'Prescription',     ar: 'روشتة' },
  report:            { en: 'Report',           ar: 'تقرير' },
  lab_report:        { en: 'Lab report',       ar: 'تحليل' },
  ultrasound:        { en: 'Ultrasound',       ar: 'سونار' },
  admission_report:  { en: 'Admission',        ar: 'دخول مستشفى' },
  discharge_report:  { en: 'Discharge',        ar: 'خروج مستشفى' },
  prenatal_lab:      { en: 'Prenatal lab',     ar: 'تحليل حمل' },
  maternal_vitals:   { en: 'Maternal vitals',  ar: 'مؤشرات الأم' },
  genetic_screening: { en: 'Genetic',          ar: 'فحص جيني' },
  birth_plan:        { en: 'Birth plan',       ar: 'خطة ولادة' },
  daily_note:        { en: 'Note',             ar: 'ملاحظة' },
  other:             { en: 'Other',            ar: 'أخرى' },
};

/** Auto-guess kind from filename — case-insensitive substring match.
 *  Falls back to 'other' so the user can re-assign before committing. */
function guessKind(name: string): FileKind {
  const n = name.toLowerCase();
  if (n.includes('ultrasound') || n.includes('us_') || n.includes('sono')) return 'ultrasound';
  if (n.includes('lab') || n.includes('cbc') || n.includes('cmp'))         return 'lab_report';
  if (n.includes('prescription') || n.includes('rx_') || n.includes('روشتة')) return 'prescription';
  if (n.includes('admission') || n.includes('admit'))                       return 'admission_report';
  if (n.includes('discharge'))                                              return 'discharge_report';
  if (n.includes('prenatal') || n.includes('pregnancy'))                    return 'prenatal_lab';
  if (n.includes('genetic') || n.includes('nipt') || n.includes('panorama')) return 'genetic_screening';
  if (n.includes('birth') && n.includes('plan'))                            return 'birth_plan';
  if (n.includes('vitals') || n.includes('bp_') || n.includes('blood'))     return 'maternal_vitals';
  if (n.includes('report') || n.includes('summary'))                        return 'report';
  if (n.includes('note'))                                                   return 'daily_note';
  return 'other';
}

interface PendingFile {
  id:       string;
  file:     File;
  kind:     FileKind;
  status:   'pending' | 'uploading' | 'done' | 'error';
  errorMsg: string | null;
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export function BulkFileUploader({
  babyId, lang = 'en',
}: {
  babyId: string;
  lang?: 'en' | 'ar';
}) {
  const router = useRouter();
  const isAr   = lang === 'ar';
  const [files, setFiles]   = useState<PendingFile[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone]     = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [bulkKind, setBulkKind] = useState<FileKind | ''>('');

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const next: PendingFile[] = [];
    for (const f of arr) {
      if (files.length + next.length >= MAX_FILES) break;
      if (f.size > MAX_FILE_BYTES) {
        next.push({ id: makeId(), file: f, kind: 'other', status: 'error',
          errorMsg: isAr ? 'الملف أكبر من ٢٥ ميجا' : 'File over 25 MB' });
        continue;
      }
      next.push({
        id:       makeId(),
        file:     f,
        kind:     guessKind(f.name),
        status:   'pending',
        errorMsg: null,
      });
    }
    setFiles(prev => [...prev, ...next]);
  }
  function removeFile(id: string) { setFiles(prev => prev.filter(f => f.id !== id)); }
  function setKind(id: string, kind: FileKind) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, kind } : f));
  }
  function applyBulkKind() {
    if (!bulkKind) return;
    setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, kind: bulkKind } : f));
  }

  async function commit() {
    if (files.length === 0) return;
    setRunning(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setFiles(prev => prev.map(f => ({ ...f, status: 'error', errorMsg: 'Not signed in' })));
      setRunning(false);
      return;
    }

    // Sequential upload — keeps the per-file progress legible and
    // avoids burying the storage endpoint with 50 parallel writes.
    for (const f of files) {
      if (f.status !== 'pending') continue;
      setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'uploading' } : p));
      const path = `babies/${babyId}/${KIND_DIR[f.kind]}/${makeId()}_${safeName(f.file.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: f.file.type || 'application/octet-stream',
      });
      if (up.error) {
        setFiles(prev => prev.map(p => p.id === f.id
          ? { ...p, status: 'error', errorMsg: up.error.message } : p));
        continue;
      }
      const ins = await supabase.from('medical_files').insert({
        baby_id:        babyId,
        kind:           f.kind,
        storage_bucket: BUCKET,
        storage_path:   path,
        mime_type:      f.file.type || null,
        size_bytes:     f.file.size,
        is_handwritten: false,
        uploaded_by:    auth.user.id,
      }).select('id').single();
      if (ins.error) {
        setFiles(prev => prev.map(p => p.id === f.id
          ? { ...p, status: 'error', errorMsg: ins.error.message } : p));
        // Roll back the storage upload so we don't orphan the blob.
        await supabase.storage.from(BUCKET).remove([path]);
        continue;
      }
      setFiles(prev => prev.map(p => p.id === f.id ? { ...p, status: 'done' } : p));
    }
    setRunning(false);
    setDone(true);
    router.refresh();
  }

  const pendingCount  = files.filter(f => f.status === 'pending').length;
  const uploadedCount = files.filter(f => f.status === 'done').length;
  const errorCount    = files.filter(f => f.status === 'error').length;

  if (done && pendingCount === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-mint-200 bg-mint-50/60 p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-mint-500 text-white grid place-items-center mb-3">
            <Check className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-ink-strong">
            {isAr
              ? `تم رفع ${uploadedCount} ملف${errorCount > 0 ? ` (فشل ${errorCount})` : ''}`
              : `Uploaded ${uploadedCount} file${uploadedCount === 1 ? '' : 's'}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`}
          </h3>
          <p className="mt-2 text-sm text-ink-muted">
            {isAr
              ? 'افتحي صفحة كل ملف لتشغيل OCR واستخراج المحتوى.'
              : 'Open any file\'s page to run OCR and extract its contents.'}
          </p>
          <a href={`/babies/${babyId}/ocr`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2.5">
            {isAr ? 'عرض كل الملفات' : 'View all files'} <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        {errorCount > 0 && (
          <div className="rounded-2xl border border-coral-200 bg-coral-50 p-4 text-xs text-coral-700">
            <strong>{isAr ? 'الملفات الفاشلة:' : 'Failed files:'}</strong>
            <ul className="mt-2 space-y-1">
              {files.filter(f => f.status === 'error').map(f => (
                <li key={f.id}>{f.file.name} — {f.errorMsg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? 'border-coral-500 bg-coral-50/40' : 'border-slate-300 bg-white'
        }`}>
        <div className="mx-auto h-12 w-12 rounded-full bg-coral-100 text-coral-600 grid place-items-center mb-3">
          <Upload className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-ink-strong">
          {isAr ? 'اسحبي ملفاتك هنا' : 'Drop your files here'}
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          {isAr
            ? `حتى ${MAX_FILES} ملف، حد أقصى ٢٥ ميجا للملف الواحد`
            : `Up to ${MAX_FILES} files, max 25 MB each`}
        </p>
        <label className="mt-4 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2 cursor-pointer">
          <Upload className="h-4 w-4" /> {isAr ? 'اختاري ملفات' : 'Choose files'}
          <input type="file" multiple accept="image/*,application/pdf" className="hidden"
            onChange={e => { if (e.target.files) addFiles(e.target.files); }} />
        </label>
      </div>

      {/* Bulk-kind shortcut + file list */}
      {files.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              {isAr ? `${files.length} ملف` : `${files.length} file${files.length === 1 ? '' : 's'}`}
            </span>
            <span className="text-xs text-ink-muted">·</span>
            <label className="text-xs text-ink-muted flex items-center gap-1.5">
              {isAr ? 'تطبيق نوع على الكل:' : 'Apply kind to all:'}
              <select value={bulkKind} onChange={e => setBulkKind(e.target.value as FileKind)}
                className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1">
                <option value="">{isAr ? '— اختاري —' : '— pick —'}</option>
                {(Object.keys(KIND_LABEL) as FileKind[]).map(k => (
                  <option key={k} value={k}>{isAr ? KIND_LABEL[k].ar : KIND_LABEL[k].en}</option>
                ))}
              </select>
              <button type="button" onClick={applyBulkKind} disabled={!bulkKind || running}
                className="rounded-full bg-slate-100 hover:bg-slate-200 text-ink-strong px-2 py-0.5 text-[11px] font-semibold disabled:opacity-50">
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </label>
          </div>

          <ul className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {files.map(f => (
              <li key={f.id} className="flex items-center gap-3 p-3">
                <span className={`h-9 w-9 rounded-lg grid place-items-center shrink-0 ${
                  f.file.type.startsWith('image/') ? 'bg-lavender-100 text-lavender-700' : 'bg-coral-100 text-coral-700'
                }`}>
                  {f.file.type.startsWith('image/')
                    ? <ImageIcon className="h-4 w-4" />
                    : <FileText className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-strong truncate">{f.file.name}</div>
                  <div className="text-[10px] text-ink-muted">
                    {(f.file.size / 1024).toFixed(0)} KB
                    {f.errorMsg && <span className="ms-2 text-coral-700">· {f.errorMsg}</span>}
                  </div>
                </div>
                <select value={f.kind} onChange={e => setKind(f.id, e.target.value as FileKind)}
                  disabled={f.status !== 'pending' || running}
                  className="text-xs rounded-md border border-slate-200 bg-white px-2 py-1 max-w-[100px] sm:max-w-[140px] shrink-0 disabled:opacity-50">
                  {(Object.keys(KIND_LABEL) as FileKind[]).map(k => (
                    <option key={k} value={k}>{isAr ? KIND_LABEL[k].ar : KIND_LABEL[k].en}</option>
                  ))}
                </select>
                <span className="w-6 grid place-items-center shrink-0">
                  {f.status === 'pending'   && (
                    <button type="button" onClick={() => removeFile(f.id)}
                      className="text-ink-muted hover:text-coral-700">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  {f.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-coral-600" />}
                  {f.status === 'done'      && <Check    className="h-4 w-4 text-mint-600" />}
                  {f.status === 'error'     && <AlertCircle className="h-4 w-4 text-coral-600" />}
                </span>
              </li>
            ))}
          </ul>

          <div className="p-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setFiles([]); setDone(false); }}
              disabled={running}
              className="text-sm text-ink-muted hover:text-ink-strong px-3 py-2 disabled:opacity-50">
              {isAr ? 'مسح' : 'Clear'}
            </button>
            <button type="button" onClick={commit}
              disabled={pendingCount === 0 || running}
              className="inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {running
                ? (<><Loader2 className="h-4 w-4 animate-spin" /> {isAr ? `جارٍ الرفع ${uploadedCount}/${files.length}` : `Uploading ${uploadedCount}/${files.length}`}</>)
                : (<>{isAr ? `رفع ${pendingCount} ملف` : `Upload ${pendingCount} file${pendingCount === 1 ? '' : 's'}`} <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 text-xs text-ink-muted leading-relaxed">
        <FileText className="h-3.5 w-3.5 inline-block me-1.5" />
        {isAr
          ? 'OCR لا يعمل تلقائياً في الرفع الجماعي للحفاظ على السرعة. افتحي صفحة الملف لتشغيل OCR لاحقاً.'
          : 'OCR is not run automatically on bulk uploads — open any file\'s page later to extract its contents.'}
      </div>
    </div>
  );
}

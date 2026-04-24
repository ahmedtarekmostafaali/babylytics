'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { FileUp, FolderArchive, Loader2 } from 'lucide-react';
import type { FileKind } from '@/lib/types';

const BUCKET = 'medical-files';

const KIND_DIR: Record<FileKind, string> = {
  prescription: 'prescriptions',
  report:       'reports',
  stool_image:  'stool_images',
  daily_note:   'daily_notes',
  other:        'other',
};

function randomToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type Mode = 'ocr' | 'archive';

/**
 * The two hero drop-zones at the top of Smart Scan. Each one takes over the
 * upload flow in a different mode:
 *   - "ocr" mode uploads + invokes the `ocr-extract` edge function, then sends
 *     the user to the review screen.
 *   - "archive" mode is a pure upload (no OCR) for reference documents.
 */
export function SmartScanUploader({ babyId, mode }: { babyId: string; mode: Mode }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accept = mode === 'ocr' ? 'image/*,application/pdf' : '*/*';
  const maxMb  = mode === 'ocr' ? 10 : 20;

  async function upload(file: File) {
    if (file.size > maxMb * 1024 * 1024) { setErr(`File too large (limit ${maxMb} MB).`); return; }
    setErr(null); setBusy(true);
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); setErr('Not signed in.'); return; }

    const kind: FileKind = mode === 'ocr' ? 'daily_note' : 'other';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `babies/${babyId}/${KIND_DIR[kind]}/${randomToken()}_${safeName}`;

    const up = await supabase.storage.from(BUCKET).upload(storagePath, file, {
      cacheControl: '3600', upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (up.error) { setBusy(false); setErr(up.error.message); return; }

    const ins = await supabase.from('medical_files').insert({
      baby_id: babyId,
      kind,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      is_handwritten: mode === 'ocr',
      uploaded_by: auth.user.id,
    }).select('id').single();
    if (ins.error || !ins.data) { setBusy(false); setErr(ins.error?.message ?? 'db insert failed'); return; }

    const fileId = ins.data.id as string;

    if (mode === 'ocr') {
      const { data: ocr, error: ocrErr } = await supabase.functions.invoke('ocr-extract', {
        body: { file_id: fileId },
      });
      if (ocrErr) {
        setBusy(false);
        // Upload succeeded, OCR failed — still show the inbox with the file visible.
        router.push(`/babies/${babyId}/ocr?file=${fileId}`);
        router.refresh();
        return;
      }
      const extractedId = ocr && typeof ocr === 'object' && 'extracted_id' in ocr
        ? (ocr as { extracted_id: string }).extracted_id
        : null;
      setBusy(false);
      if (extractedId) router.push(`/babies/${babyId}/ocr/${extractedId}`);
      else router.push(`/babies/${babyId}/ocr?file=${fileId}`);
      router.refresh();
      return;
    }

    // Archive mode — just bounce back to the inbox in the archive tab
    setBusy(false);
    router.push(`/babies/${babyId}/ocr?tab=archive&file=${fileId}`);
    router.refresh();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  const isOcr = mode === 'ocr';
  const scheme = isOcr
    ? { grad: 'from-lavender-50 to-white', icon: 'bg-lavender-100 text-lavender-600', ring: 'border-lavender-300', hoverRing: 'hover:border-lavender-400', title: 'OCR Extraction', subtitle: 'Upload handwritten notes or prescriptions.', helper: 'AI will extract data and suggest entries.', cta: 'Go to OCR Inbox', dashedBg: 'bg-lavender-50/40' }
    : { grad: 'from-mint-50 to-white',    icon: 'bg-mint-100 text-mint-600',         ring: 'border-mint-300',     hoverRing: 'hover:border-mint-400',     title: 'Normal Upload (Archive)', subtitle: 'Upload any file to keep as a reference.', helper: 'No data will be extracted.', cta: 'Go to Archive', dashedBg: 'bg-mint-50/40' };

  return (
    <div className={cn('relative rounded-2xl bg-gradient-to-br', scheme.grad, 'border border-slate-200/70 shadow-card p-5')}>
      <div className="flex items-start gap-3 mb-4">
        <span className={cn('h-11 w-11 rounded-2xl grid place-items-center shrink-0', scheme.icon)}>
          {isOcr ? <FileUp className="h-5 w-5" /> : <FolderArchive className="h-5 w-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-ink-strong">{scheme.title}</h3>
            {isOcr && <span className="rounded-full bg-lavender-500 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">AI</span>}
          </div>
          <p className="text-xs text-ink-muted">{scheme.subtitle}</p>
          <p className="text-xs text-ink-muted">{scheme.helper}</p>
        </div>
      </div>

      <button type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        disabled={busy}
        className={cn(
          'w-full rounded-2xl border-2 border-dashed px-4 py-8 text-center transition',
          scheme.ring, scheme.hoverRing, scheme.dashedBg,
          dragOver && 'ring-2 ring-offset-2 ring-offset-white',
          isOcr ? 'ring-lavender-500' : 'ring-mint-500',
          busy && 'opacity-60 cursor-not-allowed',
        )}>
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-ink-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className={cn('h-10 w-10 rounded-xl grid place-items-center', scheme.icon)}>
              {isOcr ? <FileUp className="h-5 w-5" /> : <FolderArchive className="h-5 w-5" />}
            </span>
            <div className="text-sm font-semibold text-ink-strong">
              Upload {isOcr ? 'image or PDF' : 'files'}
            </div>
            <div className="text-xs text-ink-muted">
              Drag &amp; drop or <span className={isOcr ? 'text-lavender-700 underline' : 'text-mint-700 underline'}>browse</span>
            </div>
            <div className="text-[10px] text-ink-muted">
              {isOcr ? `JPG, PNG, PDF up to ${maxMb} MB` : `PDF, JPG, PNG up to ${maxMb} MB`}
            </div>
          </div>
        )}
      </button>

      {err && <p className="mt-2 text-xs text-coral-600 font-medium">{err}</p>}

      <input ref={fileRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
    </div>
  );
}

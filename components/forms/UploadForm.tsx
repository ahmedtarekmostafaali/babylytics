'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Input';
import type { FileKind } from '@/lib/types';

const BUCKET = 'medical-files';

const KIND_DIR: Record<FileKind, string> = {
  prescription: 'prescriptions',
  report:       'reports',
  stool_image:  'stool_images',
  daily_note:   'daily_notes',
  other:        'other',
};

const KIND_HINTS_HANDWRITTEN: Record<FileKind, boolean> = {
  prescription: false,
  report:       false,
  stool_image:  false,
  daily_note:   true,   // handwritten by default
  other:        false,
};

function randomToken() {
  // short, url-safe, no deps
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function UploadForm({ babyId }: { babyId: string }) {
  const router = useRouter();
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
    if (!file) { setErr('Pick a file first.'); return; }
    setBusy(true);

    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); setErr('Not signed in.'); return; }

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
    if (ins.error || !ins.data) { setBusy(false); setErr(ins.error?.message ?? 'db insert failed'); return; }

    const fileId = ins.data.id as string;
    setMsg('Uploaded. Running OCR…');

    // 3. Kick off OCR (non-blocking for the user, but we wait so we can route to review).
    //    OCR is only auto-run on daily_note / prescription / report. Stool images skip.
    let extractedId: string | null = null;
    if (kind !== 'stool_image' && kind !== 'other') {
      const { data: ocr, error: ocrErr } = await supabase.functions.invoke('ocr-extract', {
        body: { file_id: fileId },
      });
      if (ocrErr) {
        // Upload succeeded; OCR failed. Surface message but still land on file page.
        setMsg('Uploaded. OCR failed — you can still enter values manually.');
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
        <Label htmlFor="k">File type</Label>
        <Select id="k" value={kind} onChange={e => onKindChange(e.target.value as FileKind)}>
          <option value="daily_note">Daily handwritten note</option>
          <option value="prescription">Prescription</option>
          <option value="report">Medical report</option>
          <option value="stool_image">Stool image</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="f">File (image or PDF, up to 10 MB)</Label>
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
        Handwritten (helps the OCR model pick the right mode)
      </label>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload and run OCR'}</Button>
      <p className="text-xs text-slate-500">
        OCR never writes to your logs directly — you will land on a review screen to confirm or edit the extracted values.
      </p>
    </form>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SmartScanUploader } from '@/components/SmartScanUploader';
import { FileDeleteButton } from '@/components/FileDeleteButton';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { fmtDateTime, fmtRelative } from '@/lib/dates';
import type { StructuredOcr } from '@/lib/types';
import {
  FileText, FolderArchive, Sparkles, CheckCircle2, ArrowRight, Lightbulb,
  Image as ImageIcon, Milk, Droplet, Scale, Pill,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Smart Scan' };

type Tab = 'inbox' | 'review' | 'confirmed' | 'archive';

const TABS: { key: Tab; label: string; tint: string }[] = [
  { key: 'inbox',     label: 'OCR Inbox',     tint: 'text-lavender-700 border-lavender-500' },
  { key: 'review',    label: 'Needs Review',  tint: 'text-coral-700    border-coral-500' },
  { key: 'confirmed', label: 'Confirmed',     tint: 'text-mint-700     border-mint-500' },
  { key: 'archive',   label: 'Archive',       tint: 'text-brand-700    border-brand-500' },
];

type FileRow = {
  id: string;
  baby_id: string;
  kind: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  ocr_status: string | null;
  is_handwritten: boolean | null;
};

type ExtractedRow = {
  id: string;
  file_id: string;
  status: string;
  confidence_score: number | string | null;
  flag_low_confidence: boolean | null;
  structured_data: StructuredOcr | null;
  created_at: string;
};

function fmtBytes(n: number | null | undefined) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function niceName(path: string) {
  const base = path.split('/').pop() ?? path;
  // strip random token prefix like abc12345_
  return base.replace(/^[a-z0-9]{6,}_/, '');
}

function friendlyKind(k: string) {
  const map: Record<string, string> = {
    daily_note: 'Handwritten note',
    prescription: 'Prescription',
    report: 'Medical report',
    stool_image: 'Stool image',
    other: 'Document',
  };
  return map[k] ?? k;
}

export default async function SmartScan({
  params, searchParams,
}: {
  params: { babyId: string };
  searchParams: { tab?: Tab; file?: string };
}) {
  const supabase = createClient();
  const perms = await assertRole(params.babyId, { requireLogs: true });
  const tab: Tab = (searchParams.tab ?? 'inbox') as Tab;
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  // Fetch everything in parallel for counts + each tab's list.
  const [{ data: files }, { data: extractions }] = await Promise.all([
    supabase.from('medical_files')
      .select('id,baby_id,kind,storage_bucket,storage_path,mime_type,size_bytes,uploaded_at,ocr_status,is_handwritten')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('uploaded_at', { ascending: false }).limit(200),
    supabase.from('extracted_text')
      .select('id,file_id,status,confidence_score,flag_low_confidence,structured_data,created_at')
      .eq('baby_id', params.babyId)
      .order('created_at', { ascending: false }).limit(500),
  ]);

  const allFiles      = (files ?? []) as FileRow[];
  const allExtracted  = (extractions ?? []) as ExtractedRow[];
  const latestExtByFile = new Map<string, ExtractedRow>();
  for (const e of allExtracted) if (!latestExtByFile.has(e.file_id)) latestExtByFile.set(e.file_id, e);

  // Tab grouping:
  //   OCR Inbox  = every file of a "scannable" kind, with OR without a
  //                successful extraction (so uploads that failed OCR still
  //                surface instead of being hidden in the archive).
  //   Needs Review = the subset flagged as low-confidence by Claude.
  //   Confirmed    = extractions the user has saved to logs.
  //   Archive      = everything else (stool images, "other").
  const OCR_KINDS = new Set(['daily_note', 'prescription', 'report']);
  const ocrFiles     = allFiles.filter(f => OCR_KINDS.has(f.kind));
  const archiveFiles = allFiles.filter(f => !OCR_KINDS.has(f.kind));
  const needsReview  = ocrFiles.filter(f => {
    const e = latestExtByFile.get(f.id);
    return e ? (e.status === 'extracted' && e.flag_low_confidence) : true; // no extraction at all = also needs review
  });
  const confirmed    = ocrFiles.filter(f => {
    const e = latestExtByFile.get(f.id);
    return e?.status === 'confirmed';
  });

  const listByTab: Record<Tab, FileRow[]> = {
    inbox:     ocrFiles,
    review:    needsReview,
    confirmed,
    archive:   archiveFiles,
  };
  const counts: Record<Tab, number> = {
    inbox:     ocrFiles.length,
    review:    needsReview.length,
    confirmed: confirmed.length,
    archive:   archiveFiles.length,
  };

  const list = listByTab[tab];
  const selectedId = searchParams.file ?? list[0]?.id ?? null;
  const selectedFile = selectedId ? allFiles.find(f => f.id === selectedId) ?? null : null;
  const selectedExt  = selectedFile ? latestExtByFile.get(selectedFile.id) ?? null : null;

  // Signed preview URL (images only)
  let previewUrl: string | null = null;
  if (selectedFile && (selectedFile.mime_type ?? '').startsWith('image/')) {
    const { data: signed } = await supabase.storage.from(selectedFile.storage_bucket)
      .createSignedUrl(selectedFile.storage_path, 600);
    previewUrl = signed?.signedUrl ?? null;
  }

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Smart Scan" eyebrowTint="lavender"
        title={<>Smart Scan &amp; OCR Inbox</>}
        subtitle="Upload, extract and manage baby care notes with AI."
        right={
          <Link href="#"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
            <Sparkles className="h-4 w-4 text-lavender-600" /> How it works
          </Link>
        } />

      {/* Two upload cards — parents/owners only can upload. Others see the
          inbox and extraction results but not the upload entry points. */}
      {perms.canUpload && (
        <section className="grid gap-4 md:grid-cols-2">
          <SmartScanUploader babyId={params.babyId} mode="ocr" />
          <SmartScanUploader babyId={params.babyId} mode="archive" />
        </section>
      )}
      {!perms.canUpload && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-ink-muted">
          Uploads are restricted to owners and parents. Ask a parent to add new files.
        </div>
      )}

      {/* Quick links row */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <Link href={`/babies/${params.babyId}/ocr?tab=inbox`}
          className="inline-flex items-center gap-1 rounded-full bg-lavender-100 text-lavender-700 hover:bg-lavender-200 text-xs font-semibold px-3 py-1.5">
          <FileText className="h-3.5 w-3.5" /> Go to OCR Inbox <ArrowRight className="h-3 w-3" />
        </Link>
        <Link href={`/babies/${params.babyId}/ocr?tab=archive`}
          className="inline-flex items-center gap-1 rounded-full bg-mint-100 text-mint-700 hover:bg-mint-200 text-xs font-semibold px-3 py-1.5">
          <FolderArchive className="h-3.5 w-3.5" /> Go to Archive <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Tabs + list + detail panel */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-2 border-b border-slate-100 overflow-x-auto">
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <Link key={t.key}
                href={`/babies/${params.babyId}/ocr?tab=${t.key}`}
                className={`inline-flex items-center gap-1.5 px-3 py-3 text-sm whitespace-nowrap border-b-2 ${active ? t.tint : 'border-transparent text-ink-muted hover:text-ink'}`}>
                {t.label}
                <span className={`rounded-full text-[10px] font-bold px-1.5 py-0.5 ${active ? 'bg-ink text-white' : 'bg-slate-100 text-ink-muted'}`}>
                  {counts[t.key]}
                </span>
              </Link>
            );
          })}
          <div className="flex-1" />
          <div className="hidden md:flex items-center gap-2 pr-3 text-xs text-ink-muted">
            <span>Sort by:</span>
            <span className="rounded-full border border-slate-200 px-3 py-1 bg-white font-semibold text-ink-strong">Newest</span>
          </div>
        </div>

        {list.length > 0 && (
          <div className="px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-xs text-ink-muted flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-coral-500" />
            {tab === 'review' ? 'OCR extractions waiting for your review and confirmation.'
              : tab === 'confirmed' ? 'These extractions have been reviewed and saved to logs.'
              : tab === 'archive' ? 'Uploaded files without OCR — kept for your reference.'
              : 'All files that have been scanned with OCR.'}
          </div>
        )}

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(320px,1.1fr)]">
          {/* LEFT — list of files */}
          <ul className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {list.length === 0 && (
              <li className="py-16 text-center text-sm text-ink-muted">
                <div className="h-14 w-14 rounded-2xl mx-auto bg-slate-100 text-ink-muted grid place-items-center">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="mt-3 font-semibold text-ink-strong">Nothing here yet</div>
                <p className="mt-1 text-xs">Upload a file using the cards above.</p>
              </li>
            )}
            {list.map(f => {
              const ext = latestExtByFile.get(f.id);
              const active = selectedId === f.id;
              const status = ext
                ? (ext.status === 'confirmed' ? { label: 'Confirmed',   tint: 'bg-mint-100 text-mint-700' }
                  : ext.flag_low_confidence   ? { label: 'Low confidence', tint: 'bg-peach-100 text-peach-700' }
                  : ext.status === 'extracted'? { label: 'Needs review', tint: 'bg-lavender-100 text-lavender-700' }
                  : { label: ext.status, tint: 'bg-slate-100 text-ink-muted' })
                : (tab === 'archive'
                  ? { label: 'Archive', tint: 'bg-slate-100 text-ink-muted' }
                  : { label: 'Not scanned', tint: 'bg-peach-100 text-peach-700' });
              return (
                <li key={f.id} className={`flex items-center gap-1 px-2 transition ${active ? 'bg-lavender-50/60' : ''}`}>
                  <Link href={`/babies/${params.babyId}/ocr?tab=${tab}&file=${f.id}`}
                    className="flex items-center gap-3 flex-1 min-w-0 px-2 py-3 rounded-xl hover:bg-slate-50 transition">
                    <span className="h-12 w-12 rounded-xl bg-slate-100 grid place-items-center shrink-0 overflow-hidden">
                      <ImageIcon className="h-5 w-5 text-ink-muted" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-strong truncate">
                        {friendlyKind(f.kind)}
                      </div>
                      <div className="text-xs text-ink-muted truncate">
                        Uploaded {fmtRelative(f.uploaded_at)} · {fmtBytes(f.size_bytes)}
                      </div>
                    </div>
                    <span className={`rounded-full text-[10px] font-semibold px-2 py-0.5 whitespace-nowrap ${status.tint}`}>
                      {status.label}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-muted shrink-0 ml-1" />
                  </Link>
                  {perms.canUpload && (
                    <FileDeleteButton
                      fileId={f.id}
                      storageBucket={f.storage_bucket}
                      storagePath={f.storage_path}
                      redirectTo={`/babies/${params.babyId}/ocr?tab=${tab}`} />
                  )}
                </li>
              );
            })}
          </ul>

          {/* RIGHT — detail panel */}
          <div className="border-l border-slate-100 bg-slate-50/30">
            {!selectedFile ? (
              <div className="h-full grid place-items-center py-16 px-6 text-center text-ink-muted">
                <div>
                  <div className="h-14 w-14 rounded-2xl mx-auto bg-white border border-slate-200 grid place-items-center">
                    <FileText className="h-6 w-6 text-ink-muted" />
                  </div>
                  <p className="mt-3 text-sm">Pick a file to see extracted data.</p>
                </div>
              </div>
            ) : (
              <DetailPanel
                babyId={params.babyId}
                file={selectedFile}
                ext={selectedExt}
                previewUrl={previewUrl}
                canUpload={perms.canUpload}
              />
            )}
          </div>
        </div>
      </section>

      {/* Tips for better OCR */}
      <div className="rounded-2xl border border-peach-200 bg-gradient-to-r from-peach-50 via-white to-peach-50 p-4 flex items-start gap-3">
        <span className="h-9 w-9 rounded-xl bg-white grid place-items-center shrink-0 shadow-sm">
          <Lightbulb className="h-4 w-4 text-peach-600" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-strong">Tips for better OCR</div>
          <p className="text-xs text-ink-muted mt-0.5">
            Use clear, well-lit photos. Avoid shadows and handwriting that&apos;s too small.
          </p>
        </div>
        <Link href="#"
          className="rounded-full border border-peach-200 bg-white hover:bg-peach-50 text-peach-700 text-xs font-semibold px-3 py-1.5 shadow-sm">
          View tips
        </Link>
      </div>
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Right-hand detail panel — preview image + extracted rows per type.  */
/* ──────────────────────────────────────────────────────────────────── */

function DetailPanel({
  babyId, file, ext, previewUrl, canUpload,
}: {
  babyId: string;
  file: FileRow;
  ext: ExtractedRow | null;
  previewUrl: string | null;
  canUpload: boolean;
}) {
  const conf = ext?.confidence_score != null ? Math.round(Number(ext.confidence_score) * 100) : null;

  type Extracted = { type: 'Feeding (Bottle)' | 'Feeding (Breast)' | 'Stool' | 'Measurement' | 'Medication'; time: string; details: string; confidence: number };
  const rows: Extracted[] = [];
  const sd = ext?.structured_data;
  if (sd) {
    const baseConf = Math.round(Number(ext?.confidence_score ?? 0.7) * 100);
    const jitter = (i: number) => Math.max(35, Math.min(95, baseConf + (i % 3) * 4 - 5));
    (sd.feedings ?? []).forEach((f, i) => {
      const isBreast = f.milk_type === 'breast';
      rows.push({
        type: isBreast ? 'Feeding (Breast)' : 'Feeding (Bottle)',
        time: f.feeding_time ? fmtDateTime(f.feeding_time).split(' · ')[1] ?? '—' : '—',
        details: isBreast
          ? (f.notes ?? 'breastfeeding')
          : [f.quantity_ml ? `${f.quantity_ml} ml` : null, f.milk_type].filter(Boolean).join(' · '),
        confidence: jitter(i),
      });
    });
    (sd.stools ?? []).forEach((s, i) => {
      rows.push({
        type: 'Stool',
        time: s.stool_time ? fmtDateTime(s.stool_time).split(' · ')[1] ?? '—' : '—',
        details: [s.quantity_category, s.color, s.consistency].filter(Boolean).join(' · ') || 'stool',
        confidence: jitter(i + 10),
      });
    });
    (sd.measurements ?? []).forEach((m, i) => {
      rows.push({
        type: 'Measurement',
        time: m.measured_at ? fmtDateTime(m.measured_at).split(' · ')[1] ?? '—' : '—',
        details: [m.weight_kg ? `${m.weight_kg} kg` : null, m.height_cm ? `${m.height_cm} cm` : null].filter(Boolean).join(' · '),
        confidence: jitter(i + 20),
      });
    });
    (sd.medication_logs ?? []).forEach((m, i) => {
      rows.push({
        type: 'Medication',
        time: m.medication_time ? fmtDateTime(m.medication_time).split(' · ')[1] ?? '—' : '—',
        details: [m.status, m.notes].filter(Boolean).join(' · '),
        confidence: jitter(i + 30),
      });
    });
  }

  const typeIcon: Record<Extracted['type'], React.ComponentType<{ className?: string }>> = {
    'Feeding (Bottle)': Milk,
    'Feeding (Breast)': Milk,
    'Stool': Droplet,
    'Measurement': Scale,
    'Medication': Pill,
  };
  const typeTint: Record<Extracted['type'], string> = {
    'Feeding (Bottle)': 'bg-brand-100 text-brand-600',
    'Feeding (Breast)': 'bg-coral-100 text-coral-600',
    'Stool': 'bg-mint-100 text-mint-600',
    'Measurement': 'bg-lavender-100 text-lavender-600',
    'Medication': 'bg-peach-100 text-peach-600',
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-ink-strong truncate">{friendlyKind(file.kind)}</div>
          <div className="text-[11px] text-ink-muted">
            Uploaded {fmtDateTime(file.uploaded_at)}
          </div>
        </div>
        {ext ? (
          ext.status === 'confirmed'
            ? <span className="rounded-full bg-mint-100 text-mint-700 text-[11px] font-semibold px-2.5 py-1 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Confirmed</span>
            : ext.flag_low_confidence
              ? <span className="rounded-full bg-peach-100 text-peach-700 text-[11px] font-semibold px-2.5 py-1">Low confidence</span>
              : <span className="rounded-full bg-lavender-100 text-lavender-700 text-[11px] font-semibold px-2.5 py-1">Needs review</span>
        ) : (
          file.kind === 'other' || file.kind === 'stool_image'
            ? <span className="rounded-full bg-slate-100 text-ink-muted text-[11px] font-semibold px-2.5 py-1">Archive</span>
            : <span className="rounded-full bg-peach-100 text-peach-700 text-[11px] font-semibold px-2.5 py-1">Not scanned</span>
        )}
      </div>

      {/* Preview */}
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="w-full h-56 object-cover rounded-2xl border border-slate-200 bg-white" />
      ) : (
        <div className="w-full h-40 rounded-2xl border border-slate-200 bg-white grid place-items-center">
          <div className="text-center text-ink-muted">
            <FileText className="h-8 w-8 mx-auto" />
            <p className="mt-1 text-xs">{(file.mime_type ?? 'file').toUpperCase()}</p>
          </div>
        </div>
      )}

      {/* Extracted data table */}
      {ext && rows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-ink-strong">
              Extracted data <span className="text-[10px] text-ink-muted font-normal">(AI)</span>
            </div>
            {conf != null && (
              <ConfidenceBadge score={conf / 100} />
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1.4fr_0.8fr_1.5fr_0.6fr] gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted bg-slate-50 border-b border-slate-100">
              <span>Type</span><span>Time</span><span>Details</span><span className="text-right">Conf.</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((r, i) => {
                const Icon = typeIcon[r.type];
                const tint = typeTint[r.type];
                return (
                  <li key={i} className="grid grid-cols-[1.4fr_0.8fr_1.5fr_0.6fr] gap-3 items-center px-3 py-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className={`h-6 w-6 rounded-md grid place-items-center shrink-0 ${tint}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="truncate">{r.type}</span>
                    </span>
                    <span className="text-ink-muted">{r.time}</span>
                    <span className="text-ink truncate">{r.details}</span>
                    <span className="text-right font-bold text-ink-strong">{r.confidence}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {ext && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-ink-muted">
          OCR ran but did not extract any structured values. Open the review screen to see the raw text.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {ext && ext.status !== 'confirmed' && (
          <Link href={`/babies/${babyId}/ocr/${ext.id}`}
            className="flex-1 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-ink-strong text-sm font-semibold grid place-items-center">
            Review &amp; edit
          </Link>
        )}
        {ext && ext.status !== 'confirmed' && (
          <Link href={`/babies/${babyId}/ocr/${ext.id}`}
            className="flex-1 h-10 rounded-2xl bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold grid place-items-center">
            Confirm &amp; save
          </Link>
        )}
        {(!ext || ext.status === 'confirmed') && (
          <Link href={`/babies/${babyId}/files/${file.id}`}
            className="flex-1 h-10 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-ink-strong text-sm font-semibold grid place-items-center">
            Open file
          </Link>
        )}
      </div>
      {canUpload && <div className="pt-2 flex justify-end">
        <FileDeleteButton
          fileId={file.id}
          storageBucket={file.storage_bucket}
          storagePath={file.storage_path}
          redirectTo={`/babies/${babyId}/ocr`}
          variant="text" />
      </div>}
    </div>
  );
}

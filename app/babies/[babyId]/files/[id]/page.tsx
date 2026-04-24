import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { RerunOcrButton } from '@/components/RerunOcrButton';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDateTime, fmtRelative } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function FileDetail({ params }: { params: { babyId: string; id: string } }) {
  const supabase = createClient();
  const { data: file } = await supabase
    .from('medical_files')
    .select('id,baby_id,kind,storage_bucket,storage_path,mime_type,size_bytes,is_handwritten,ocr_status,uploaded_at')
    .eq('id', params.id).is('deleted_at', null).single();
  if (!file) notFound();

  const { data: extractions } = await supabase
    .from('extracted_text')
    .select('id,provider,model,confidence_score,flag_low_confidence,is_handwritten,detected_language,status,created_at,confirmed_at')
    .eq('file_id', params.id)
    .order('created_at', { ascending: false });

  const { data: signed } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 600);
  const previewUrl = signed?.signedUrl ?? null;
  const isImage = (file.mime_type ?? '').startsWith('image/');
  const isPdf   = (file.mime_type ?? '') === 'application/pdf';

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel="dashboard"
        eyebrow="Medical record" eyebrowTint="coral"
        title={<span className="capitalize">{file.kind.replace('_', ' ')}</span>}
        subtitle={`Uploaded ${fmtRelative(file.uploaded_at)} · ${file.mime_type ?? 'unknown'}${file.size_bytes ? ` · ${Math.round(file.size_bytes / 1024)} KB` : ''} · OCR ${file.ocr_status}`}
        right={<RerunOcrButton fileId={file.id} babyId={params.babyId} />}
      />

      <Card>
        <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
        <CardContent>
          {!previewUrl && <p className="text-sm text-ink-muted">Preview unavailable.</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {previewUrl && isImage && <img src={previewUrl} alt="" className="max-h-[70vh] rounded-xl border border-slate-200" />}
          {previewUrl && isPdf   && <iframe src={previewUrl} className="w-full h-[70vh] rounded-xl border border-slate-200" />}
          {previewUrl && !isImage && !isPdf && <a href={previewUrl} className="text-brand-600 hover:underline text-sm">Open file</a>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>OCR attempts</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(extractions ?? []).length === 0 && <p className="text-ink-muted">No OCR run yet for this file.</p>}
          {extractions?.map(x => (
            <div key={x.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-ink-strong">
                  {x.provider}{x.model ? ` (${x.model})` : ''} · {x.status}
                  {x.is_handwritten ? ' · handwritten' : ''}
                  {x.detected_language ? ` · ${x.detected_language}` : ''}
                </div>
                <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                  <span>{fmtDateTime(x.created_at)}</span>
                  <ConfidenceBadge score={x.confidence_score} />
                </div>
              </div>
              {x.status === 'confirmed'
                ? <span className="text-xs text-mint-700">confirmed {fmtRelative(x.confirmed_at)}</span>
                : <Link href={`/babies/${params.babyId}/ocr/${x.id}`}>
                    <Button size="sm" variant={x.flag_low_confidence ? 'primary' : 'secondary'}>Review</Button>
                  </Link>}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

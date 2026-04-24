import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDateTime } from '@/lib/dates';
import { Upload, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OcrInbox({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  const { data: rows } = await supabase
    .from('extracted_text')
    .select('id,file_id,provider,model,status,confidence_score,flag_low_confidence,is_handwritten,detected_language,created_at')
    .eq('baby_id', params.babyId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow="Smart Scan"
        eyebrowTint="coral"
        title="Photo log & OCR inbox"
        subtitle="Every extraction ever run — confirmed, pending review, or discarded."
        right={
          <Link href={`/babies/${params.babyId}/upload`}>
            <Button variant="peach" className="rounded-full">
              <Upload className="h-4 w-4" /> Upload new
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader><CardTitle>Extractions</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(rows ?? []).length === 0 && (
            <div className="py-10 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-coral-100 text-coral-600 grid place-items-center">
                <FileText className="h-8 w-8" />
              </div>
              <p className="mt-3 text-ink-muted">No OCR runs yet.</p>
              <Link href={`/babies/${params.babyId}/upload`}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-coral-500 hover:bg-coral-600 text-white font-semibold px-4 py-2 shadow-sm">
                <Upload className="h-4 w-4" /> Upload your first note
              </Link>
            </div>
          )}
          {rows?.map(x => (
            <div key={x.id} className="flex items-center justify-between py-3 gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink-strong truncate">
                  {x.provider}{x.model ? ` · ${x.model}` : ''} · <span className="capitalize">{x.status}</span>
                  {x.is_handwritten ? ' · handwritten' : ''}
                  {x.detected_language ? ` · ${x.detected_language}` : ''}
                </div>
                <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                  <span>{fmtDateTime(x.created_at)}</span>
                  <ConfidenceBadge score={x.confidence_score} />
                </div>
              </div>
              <Link href={`/babies/${params.babyId}/ocr/${x.id}`}>
                <Button size="sm" variant={x.status === 'extracted' ? (x.flag_low_confidence ? 'primary' : 'secondary') : 'secondary'}>
                  {x.status === 'extracted' ? 'Review' : 'Open'}
                </Button>
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

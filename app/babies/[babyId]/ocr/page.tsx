import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDateTime } from '@/lib/dates';

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
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Smart Scan" eyebrowTint="coral" title="OCR inbox"
        subtitle="Every extraction ever run — confirmed, pending review, or discarded." />

      <Card>
        <CardHeader><CardTitle>Extractions</CardTitle></CardHeader>
        <CardContent className="divide-y divide-slate-100 text-sm">
          {(rows ?? []).length === 0 && <p className="text-ink-muted">No OCR runs yet.</p>}
          {rows?.map(x => (
            <div key={x.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium text-ink-strong">
                  {x.provider}{x.model ? ` · ${x.model}` : ''} · <span className="capitalize">{x.status}</span>
                  {x.is_handwritten ? ' · handwritten' : ''}
                  {x.detected_language ? ` · ${x.detected_language}` : ''}
                </div>
                <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                  <span>{fmtDateTime(x.created_at)}</span>
                  <ConfidenceBadge score={x.confidence_score} />
                </div>
              </div>
              {x.status === 'extracted'
                ? <Link href={`/babies/${params.babyId}/ocr/${x.id}`}>
                    <Button size="sm" variant={x.flag_low_confidence ? 'primary' : 'secondary'}>Review</Button>
                  </Link>
                : <Link href={`/babies/${params.babyId}/ocr/${x.id}`} className="text-xs text-ink-muted hover:underline">open →</Link>}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

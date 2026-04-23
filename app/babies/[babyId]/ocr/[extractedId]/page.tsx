import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Nav } from '@/components/Nav';
import { OcrReview } from '@/components/OcrReview';
import type { StructuredOcr } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function OcrReviewPage({ params }: { params: { babyId: string; extractedId: string } }) {
  const supabase = createClient();

  const { data: extracted } = await supabase
    .from('extracted_text')
    .select('id,file_id,baby_id,provider,model,raw_text,structured_data,confidence_score,is_handwritten,detected_language,flag_low_confidence,status')
    .eq('id', params.extractedId)
    .eq('baby_id', params.babyId)
    .single();
  if (!extracted) notFound();

  const [{ data: file }, { data: meds }] = await Promise.all([
    supabase.from('medical_files')
      .select('id,storage_bucket,storage_path,mime_type')
      .eq('id', extracted.file_id).single(),
    supabase.from('medications')
      .select('id,name')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('name', { ascending: true }),
  ]);

  let previewUrl: string | null = null;
  if (file && (file.mime_type ?? '').startsWith('image/')) {
    const { data: signed } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 600);
    previewUrl = signed?.signedUrl ?? null;
  }

  return (
    <div>
      <Nav />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href={`/babies/${params.babyId}/files/${extracted.file_id}`} className="text-sm text-slate-500 hover:underline">← file</Link>
            <h1 className="text-xl font-semibold mt-1">Review OCR extraction</h1>
            <p className="text-sm text-slate-500">Edit any value. Nothing is saved to your logs until you hit <strong>Confirm</strong>.</p>
          </div>
        </div>

        <OcrReview
          extracted={{
            id: extracted.id,
            file_id: extracted.file_id,
            baby_id: extracted.baby_id,
            provider: extracted.provider,
            model: extracted.model,
            raw_text: extracted.raw_text,
            confidence_score: extracted.confidence_score,
            is_handwritten: extracted.is_handwritten,
            detected_language: extracted.detected_language,
            flag_low_confidence: extracted.flag_low_confidence,
            status: extracted.status as 'extracted',
            structured_data: extracted.structured_data as StructuredOcr,
          }}
          meds={(meds ?? []) as { id: string; name: string }[]}
          previewUrl={previewUrl}
          babyId={params.babyId}
        />
      </main>
    </div>
  );
}

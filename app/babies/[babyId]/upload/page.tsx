import { redirect } from 'next/navigation';

/**
 * Legacy upload page — Smart Scan at /ocr now owns both OCR and archive uploads
 * via its two hero drop-zones.
 */
export default function UploadRedirect({ params }: { params: { babyId: string } }) {
  redirect(`/babies/${params.babyId}/ocr`);
}

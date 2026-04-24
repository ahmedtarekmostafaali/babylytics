import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { Card, CardContent } from '@/components/ui/Card';
import { Comments } from '@/components/Comments';
import { SmartScanUploader } from '@/components/SmartScanUploader';
import { FileDeleteButton } from '@/components/FileDeleteButton';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtRelative } from '@/lib/dates';
import { Pill, FileText, Stethoscope, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EditAppointment({
  params,
}: {
  params: { babyId: string; id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = membership?.role as string | undefined;
  if (role !== 'owner' && role !== 'parent' && role !== 'editor') {
    redirect(`/babies/${params.babyId}`);
  }

  const [{ data }, { data: docs }] = await Promise.all([
    supabase.from('appointments')
      .select('id,doctor_id,scheduled_at,duration_min,purpose,location,status,notes')
      .eq('id', params.id).is('deleted_at', null).single(),
    supabase.from('doctors').select('id,name,specialty')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false }),
  ]);
  if (!data) notFound();

  // Files uploaded recently — surface so the parent can link them mentally to
  // this appointment. We don't have an FK from medical_files → appointments,
  // so we just show the most recent prescriptions and reports for this baby.
  const { data: recentFiles } = await supabase.from('medical_files')
    .select('id,kind,storage_bucket,storage_path,mime_type,size_bytes,uploaded_at')
    .eq('baby_id', params.babyId).is('deleted_at', null)
    .in('kind', ['prescription', 'report'])
    .order('uploaded_at', { ascending: false })
    .limit(5);

  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/doctors`} backLabel="Doctors"
        eyebrow="Edit" eyebrowTint="lavender" title="Edit appointment" />
      <Card><CardContent className="py-6">
        <AppointmentForm
          babyId={params.babyId}
          doctors={(docs ?? []) as { id: string; name: string; specialty: string | null }[]}
          initial={{
            id: data.id, doctor_id: data.doctor_id, scheduled_at: data.scheduled_at,
            duration_min: data.duration_min, purpose: data.purpose, location: data.location,
            status: data.status as 'scheduled'|'completed'|'cancelled'|'missed'|'rescheduled',
            notes: data.notes,
          }}
        />
      </CardContent></Card>

      {/* Prescription / report uploads tied to this visit */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-lavender-600" />
          <h3 className="text-sm font-bold text-ink-strong">Visit attachments</h3>
          <span className="text-[11px] text-ink-muted">prescriptions, reports, scans</span>
        </div>
        <div className="p-4 grid gap-4 md:grid-cols-2">
          <SmartScanUploader babyId={params.babyId} mode="ocr" />
          <SmartScanUploader babyId={params.babyId} mode="archive" />
        </div>

        {recentFiles && recentFiles.length > 0 && (
          <div className="border-t border-slate-100">
            <div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted bg-slate-50/50">
              Recent prescriptions &amp; reports
            </div>
            <ul className="divide-y divide-slate-100">
              {recentFiles.map(f => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-9 w-9 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                    {f.kind === 'prescription' ? <Pill className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-strong truncate capitalize">
                      {f.kind.replace('_', ' ')}
                    </div>
                    <div className="text-[11px] text-ink-muted truncate">
                      Uploaded {fmtRelative(f.uploaded_at)}
                    </div>
                  </div>
                  <Link href={`/babies/${params.babyId}/ocr?file=${f.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    Open <ArrowRight className="h-3 w-3" />
                  </Link>
                  <FileDeleteButton fileId={f.id}
                    storageBucket={f.storage_bucket} storagePath={f.storage_path}
                    redirectTo={`/babies/${params.babyId}/doctors/appointments/${params.id}`} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <Comments babyId={params.babyId} target="babies" targetId={params.babyId}
        title="Visit notes" scopeDate={data.scheduled_at?.slice(0, 10)} />
    </PageShell>
  );
}

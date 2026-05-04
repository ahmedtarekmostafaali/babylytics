import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { loadUserPrefs } from '@/lib/user-prefs';
import { fmtDate, fmtRelative } from '@/lib/dates';
import { BumpPhotoForm } from '@/components/forms/BumpPhotoForm';
import { Camera, Trash2 } from 'lucide-react';
import { DeleteBumpButton } from '@/components/DeleteBumpButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bump journal' };

interface BumpRow {
  id:               string;
  taken_at:         string;
  gestational_week: number | null;
  storage_path:     string | null;
  mime_type:        string | null;
  belly_circ_cm:    number | null;
  weight_kg:        number | null;
  notes:            string | null;
}

export default async function BumpJournalPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: baby } = await supabase.from('babies')
    .select('id,name,lifecycle_stage')
    .eq('id', params.babyId).single();
  if (!baby) notFound();
  if ((baby as { lifecycle_stage?: string }).lifecycle_stage !== 'pregnancy') {
    redirect(`/babies/${params.babyId}`);
  }

  const userPrefs = await loadUserPrefs(supabase);
  const isAr = userPrefs.language === 'ar';

  const { data: rows } = await supabase.rpc('list_bump_photos', { p_baby: params.babyId });
  const photos = (rows ?? []) as BumpRow[];

  // Sign each storage path so the client can render the image. Signed
  // URLs expire after 1 hour — plenty for a single page view.
  const signed = await Promise.all(
    photos.map(async p => {
      if (!p.storage_path) return { ...p, url: null };
      const { data } = await supabase.storage.from('medical-files')
        .createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? null };
    })
  );

  return (
    <PageShell max="3xl">
      <PageHeader
        backHref={`/babies/${params.babyId}`}
        backLabel={baby.name}
        eyebrow={isAr ? 'الحمل' : 'PREGNANCY'}
        eyebrowTint="lavender"
        title={isAr ? 'يوميات البطن' : 'Bump journal'}
        subtitle={isAr
          ? 'صور أسبوعية للبطن. أسبوع الحمل يُحسب تلقائياً من LMP/EDD.'
          : 'Weekly belly photos. Gestational week is auto-computed from your LMP/EDD.'} />

      <BumpPhotoForm babyId={params.babyId} lang={userPrefs.language} />

      {/* Timeline */}
      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted px-1">
          {isAr
            ? `كل الصور (${signed.length})`
            : `All photos (${signed.length})`}
        </h3>
        {signed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-ink-muted">
            <Camera className="h-6 w-6 mx-auto mb-2 text-ink-muted" />
            {isAr
              ? 'لا توجد صور بعد. ابدئي بإضافة صورة من الأعلى.'
              : 'No photos yet. Start by adding one above.'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {signed.map(p => (
              <article key={p.id}
                className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt={`Bump week ${p.gestational_week ?? '?'}`}
                    className="w-full aspect-[3/4] object-cover bg-slate-100" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-slate-50 grid place-items-center text-xs text-ink-muted">
                    {isAr ? 'بدون صورة' : 'No photo'}
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink-strong">
                      {p.gestational_week
                        ? (isAr ? `أسبوع ${p.gestational_week}` : `Week ${p.gestational_week}`)
                        : (isAr ? 'بدون أسبوع' : 'No week')}
                    </span>
                    <span className="text-[10px] text-ink-muted" title={fmtDate(p.taken_at)}>
                      {fmtRelative(p.taken_at)}
                    </span>
                  </div>
                  {(p.belly_circ_cm || p.weight_kg) && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.belly_circ_cm && (
                        <span className="text-[10px] rounded-full bg-coral-50 text-coral-700 border border-coral-200 px-1.5 py-0.5">
                          {p.belly_circ_cm} cm
                        </span>
                      )}
                      {p.weight_kg && (
                        <span className="text-[10px] rounded-full bg-mint-50 text-mint-700 border border-mint-200 px-1.5 py-0.5">
                          {p.weight_kg} kg
                        </span>
                      )}
                    </div>
                  )}
                  {p.notes && (
                    <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap break-words">
                      {p.notes}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <DeleteBumpButton id={p.id} lang={userPrefs.language} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="text-[11px] text-ink-muted text-center px-4">
        {isAr
          ? 'الصور خاصة بكِ وبالرعاة الأهل. الشريك في وضع الشريك لا يراها.'
          : 'Photos are private to you and parent caregivers. Partner-mode caregivers cannot see them.'}
      </p>
    </PageShell>
  );
}

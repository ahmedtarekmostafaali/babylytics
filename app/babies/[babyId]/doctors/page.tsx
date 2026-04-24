import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { fmtDate, fmtDateTime, fmtRelative } from '@/lib/dates';
import {
  Stethoscope, Plus, CalendarClock, Phone, Mail, MapPin, Star,
  ArrowRight, CheckCircle2, AlertTriangle, XCircle, RotateCcw,
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Doctors & appointments' };

type Doctor = {
  id: string; name: string; specialty: string | null; clinic: string | null;
  phone: string | null; email: string | null; address: string | null;
  notes: string | null; is_primary: boolean; created_at: string;
};
type Appointment = {
  id: string; doctor_id: string | null; scheduled_at: string; duration_min: number | null;
  purpose: string | null; location: string | null; status: 'scheduled'|'completed'|'cancelled'|'missed'|'rescheduled';
  notes: string | null; created_at: string;
};

const STATUS_META: Record<Appointment['status'], { icon: React.ComponentType<{ className?: string }>; chip: string; label: string }> = {
  scheduled:   { icon: CalendarClock, chip: 'bg-brand-100    text-brand-700',    label: 'Scheduled' },
  completed:   { icon: CheckCircle2,  chip: 'bg-mint-100     text-mint-700',     label: 'Completed' },
  cancelled:   { icon: XCircle,       chip: 'bg-slate-100    text-ink',          label: 'Cancelled' },
  missed:      { icon: AlertTriangle, chip: 'bg-coral-100    text-coral-700',    label: 'Missed' },
  rescheduled: { icon: RotateCcw,     chip: 'bg-peach-100    text-peach-700',    label: 'Rescheduled' },
};

export default async function DoctorsPage({ params }: { params: { babyId: string } }) {
  const supabase = createClient();
  const { data: baby } = await supabase.from('babies').select('id,name').eq('id', params.babyId).single();
  if (!baby) notFound();

  // Role gate — non-parents are bounced back to the overview.
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase.from('baby_users')
    .select('role').eq('baby_id', params.babyId).eq('user_id', user?.id ?? '').maybeSingle();
  const role = membership?.role as 'owner'|'parent'|'editor'|string | undefined;
  if (role !== 'owner' && role !== 'parent' && role !== 'editor') {
    redirect(`/babies/${params.babyId}`);
  }

  const [{ data: docs }, { data: apps }] = await Promise.all([
    supabase.from('doctors')
      .select('id,name,specialty,clinic,phone,email,address,notes,is_primary,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('appointments')
      .select('id,doctor_id,scheduled_at,duration_min,purpose,location,status,notes,created_at')
      .eq('baby_id', params.babyId).is('deleted_at', null)
      .order('scheduled_at', { ascending: true }),
  ]);

  const doctors = (docs ?? []) as Doctor[];
  const appointments = (apps ?? []) as Appointment[];
  const doctorById = new Map(doctors.map(d => [d.id, d]));

  const now = Date.now();
  const upcoming = appointments.filter(a => a.status === 'scheduled' && new Date(a.scheduled_at).getTime() >= now);
  const past = appointments.filter(a => a.status !== 'scheduled' || new Date(a.scheduled_at).getTime() < now)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
    .slice(0, 20);

  return (
    <PageShell max="5xl">
      <PageHeader backHref={`/babies/${params.babyId}`} backLabel={baby.name}
        eyebrow="Health" eyebrowTint="lavender"
        title="Doctors & appointments"
        subtitle={`${doctors.length} doctor${doctors.length === 1 ? '' : 's'} · ${upcoming.length} upcoming`}
        right={
          <div className="flex items-center gap-2">
            <Link href={`/babies/${params.babyId}/doctors/new`}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-sm text-ink px-3 py-1.5 shadow-sm">
              <Plus className="h-4 w-4" /> Doctor
            </Link>
            <Link href={`/babies/${params.babyId}/doctors/appointments/new`}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5 shadow-sm">
              <CalendarClock className="h-4 w-4" /> Book appointment
            </Link>
          </div>
        } />

      {doctors.length === 0 && appointments.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-10 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-lavender-100 text-lavender-600 grid place-items-center">
            <Stethoscope className="h-8 w-8" />
          </div>
          <p className="mt-3 text-ink-muted">No doctors added yet.</p>
          <p className="text-xs text-ink-muted mt-1">Add your pediatrician and any specialists so appointments and phone numbers are always handy.</p>
          <Link href={`/babies/${params.babyId}/doctors/new`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-sm font-semibold px-4 py-1.5">
            <Plus className="h-4 w-4" /> Add your first doctor
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Upcoming appointments</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map(a => {
              const doc = a.doctor_id ? doctorById.get(a.doctor_id) : undefined;
              const meta = STATUS_META[a.status];
              return (
                <Link key={a.id} href={`/babies/${params.babyId}/doctors/appointments/${a.id}`}
                  className="block rounded-2xl bg-gradient-to-br from-lavender-50 to-white border border-slate-200/70 hover:shadow-panel transition p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-10 w-10 rounded-xl bg-lavender-500 text-white grid place-items-center shrink-0">
                      <CalendarClock className="h-5 w-5" />
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.chip}`}>
                      <meta.icon className="h-3 w-3" /> {meta.label}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-ink-muted uppercase tracking-wider">{fmtRelative(a.scheduled_at)}</div>
                    <div className="text-lg font-bold text-ink-strong leading-tight">{fmtDateTime(a.scheduled_at)}</div>
                    {a.purpose && <div className="text-sm text-ink mt-0.5">{a.purpose}</div>}
                    {doc && <div className="text-xs text-ink-muted mt-1">with <span className="font-semibold">{doc.name}</span>{doc.specialty ? ` · ${doc.specialty}` : ''}</div>}
                    {a.location && <div className="text-xs text-ink-muted">at {a.location}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {doctors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Doctors</h2>
            <Link href={`/babies/${params.babyId}/doctors/new`}
              className="text-xs text-brand-700 font-semibold hover:underline">+ Add another</Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {doctors.map(d => (
              <li key={d.id} className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-lavender-100 text-lavender-600 grid place-items-center shrink-0">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-ink-strong truncate">{d.name}</div>
                      {d.is_primary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-peach-100 text-peach-700 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5">
                          <Star className="h-3 w-3 fill-peach-500 text-peach-600" /> Primary
                        </span>
                      )}
                    </div>
                    {d.specialty && <div className="text-xs text-ink-muted">{d.specialty}</div>}
                    {d.clinic && <div className="text-xs text-ink mt-1">{d.clinic}</div>}
                    <div className="mt-2 grid gap-1 text-xs">
                      {d.phone   && <div className="flex items-center gap-1.5 text-ink"><Phone className="h-3 w-3" /> {d.phone}</div>}
                      {d.email   && <div className="flex items-center gap-1.5 text-ink"><Mail  className="h-3 w-3" /> {d.email}</div>}
                      {d.address && <div className="flex items-center gap-1.5 text-ink"><MapPin className="h-3 w-3" /> {d.address}</div>}
                    </div>
                  </div>
                  <Link href={`/babies/${params.babyId}/doctors/${d.id}`}
                    className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-1">
                    Edit
                  </Link>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/babies/${params.babyId}/doctors/appointments/new?doctor=${d.id}`}
                    className="flex-1 text-center rounded-xl bg-gradient-to-r from-lavender-500 to-brand-500 text-white text-xs font-semibold px-3 py-2">
                    <CalendarClock className="inline h-3 w-3 mr-1" />
                    Book appointment
                  </Link>
                  {d.phone && (
                    <a href={`tel:${d.phone}`}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold px-3 py-2 text-ink-strong">
                      <Phone className="inline h-3 w-3 mr-1" /> Call
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Past appointments</h2>
          <ul className="rounded-2xl bg-white border border-slate-200 shadow-card divide-y divide-slate-100">
            {past.map(a => {
              const doc = a.doctor_id ? doctorById.get(a.doctor_id) : undefined;
              const meta = STATUS_META[a.status];
              return (
                <li key={a.id}>
                  <Link href={`/babies/${params.babyId}/doctors/appointments/${a.id}`}
                    className="grid grid-cols-[44px_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span className="h-10 w-10 rounded-xl bg-slate-100 text-ink-muted grid place-items-center shrink-0">
                      <CalendarClock className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink-strong truncate">
                        {a.purpose ?? (doc ? `Visit with ${doc.name}` : 'Appointment')}
                      </div>
                      <div className="text-xs text-ink-muted truncate">
                        {fmtDate(a.scheduled_at)}{doc ? ` · ${doc.name}` : ''}{a.location ? ` · ${a.location}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${meta.chip}`}>
                        <meta.icon className="h-3 w-3" /> {meta.label}
                      </span>
                      <ArrowRight className="h-4 w-4 text-ink-muted" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageShell>
  );
}

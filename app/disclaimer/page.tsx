import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { AlertTriangle, Heart, Stethoscope, Phone, Ban, ShieldCheck } from 'lucide-react';

export const metadata = { title: 'Medical Disclaimer' };

const LAST_UPDATED = 'April 2026';

export default function Disclaimer() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-2 text-coral-600">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider font-semibold">Important — please read</span>
        </div>
        <h1 className="text-3xl font-bold text-ink-strong">Medical Disclaimer</h1>
        <p className="text-sm text-ink-muted">Last updated: {LAST_UPDATED}</p>
      </header>

      {/* Big red warning banner */}
      <div className="rounded-2xl border-2 border-coral-400 bg-coral-50 p-5 flex items-start gap-4">
        <span className="h-11 w-11 rounded-xl bg-coral-500 text-white grid place-items-center shrink-0">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="flex-1 text-sm">
          <div className="font-bold text-coral-900 text-base mb-1">
            Babylytics is not a medical device or a substitute for professional medical care.
          </div>
          <p className="text-coral-900/90">
            The information shown in this app is for <strong>tracking and organizational purposes only</strong>.
            It does not constitute medical advice, diagnosis, or treatment. Always consult your pediatrician,
            family physician, or an emergency service for any medical decision concerning your child.
          </p>
        </div>
      </div>

      <section className="text-sm text-ink space-y-5">
        <DisSection icon={Stethoscope} title="1. Not medical advice">
          <p>
            Babylytics helps parents and caregivers <em>record</em> information about their baby — feedings,
            diaper changes, sleep, medications, temperature, measurements, vaccinations, and notes from
            their pediatrician. The app does not review, interpret, or validate any of that information
            in a clinical sense.
          </p>
          <p>
            Values shown as "recommended" (for example recommended daily feed, normal temperature ranges,
            typical sleep hours, or the suggested vaccination schedule) are <strong>general educational
            defaults</strong> derived from public sources. They are not tailored to your child&apos;s
            individual needs and they are <strong>not</strong> a substitute for advice from a licensed
            healthcare professional.
          </p>
        </DisSection>

        <DisSection icon={Ban} title="2. Not a diagnostic tool">
          <p>
            Flags like "fever", "overdue", "low OCR confidence" or any colour-coded alert are purely
            informational. They are <strong>not</strong> a clinical diagnosis. Do not change a treatment,
            dose, or vaccination schedule based solely on what the app shows.
          </p>
        </DisSection>

        <DisSection icon={Phone} title="3. In an emergency">
          <p className="font-semibold text-coral-700">
            Do not use this app as your primary way to respond to a medical emergency.
          </p>
          <p>
            If your child is seriously ill, not breathing normally, has a seizure, a very high fever
            (≥ 39 °C in a young infant), persistent vomiting, is unresponsive, or you have any other
            urgent concern — <strong>call your local emergency number immediately</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Egypt: <strong>123</strong> (ambulance) or <strong>137</strong></li>
            <li>Europe / most countries: <strong>112</strong></li>
            <li>United States: <strong>911</strong></li>
            <li>United Kingdom: <strong>999</strong></li>
          </ul>
        </DisSection>

        <DisSection icon={Heart} title="4. Caregiver responsibility">
          <p>
            Every entry in the app is user-generated. The accuracy, completeness, and timeliness of
            feeding volumes, doses, temperatures, and appointment dates depend entirely on the person
            recording them. If a caregiver forgets to log a dose, the app has no way to detect that.
          </p>
          <p>
            Before sharing the app with another caregiver, review the permission levels on the{' '}
            <em>Caregivers</em> page. You are responsible for who you invite.
          </p>
        </DisSection>

        <DisSection icon={Stethoscope} title="5. OCR accuracy">
          <p>
            The Smart Scan feature uses an AI model to extract text from photos of handwritten notes,
            prescriptions, and reports. The extraction may be <strong>inaccurate or incomplete</strong>.
            You must review every extracted value before saving it. Confidence percentages are the
            model&apos;s self-estimate, not an objective accuracy measure.
          </p>
        </DisSection>

        <DisSection icon={ShieldCheck} title="6. No warranty">
          <p>
            Babylytics is provided without warranty. The author of the app is not liable for any health
            outcome — positive or negative — arising from its use. See the full liability terms in the{' '}
            <Link href="/terms" className="text-brand-700 underline">Terms of Service</Link>.
          </p>
        </DisSection>

        <DisSection icon={Heart} title="7. Always talk to your pediatrician">
          <p>
            If anything in the app suggests a concern — an unusually high temperature, a missed
            medication, a growth trend that surprises you — the right next step is always to contact
            your pediatrician. Bring the relevant report (exported as PDF from the Reports page) with
            you to the appointment.
          </p>
        </DisSection>

        <p className="text-xs text-ink-muted pt-6 border-t border-slate-200">
          See also:{' '}
          <Link href="/privacy" className="text-brand-700 underline">Privacy Policy</Link>
          {' '}·{' '}
          <Link href="/terms" className="text-brand-700 underline">Terms of Service</Link>
        </p>
      </section>
    </div>
  );
}

function DisSection({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-strong">
        <Icon className="h-4 w-4 text-coral-600" />
        {title}
      </h2>
      <div className="text-sm text-ink space-y-2">{children}</div>
    </section>
  );
}

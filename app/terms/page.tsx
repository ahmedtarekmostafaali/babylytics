import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Scale, FileText, AlertTriangle, Ban, ShieldCheck, Gavel } from 'lucide-react';

export const metadata = { title: 'Terms of Service' };

const LAST_UPDATED = 'April 2026';

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-2 text-brand-600">
          <Scale className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider font-semibold">Legal</span>
        </div>
        <h1 className="text-3xl font-bold text-ink-strong">Terms of Service</h1>
        <p className="text-sm text-ink-muted">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="text-sm text-ink space-y-5">
        <p>
          These Terms govern your use of <strong>Babylytics</strong> (the "Service") operated at{' '}
          <a href="https://babylytics.org" className="text-brand-700 underline">babylytics.org</a>.
          By creating an account and using the Service, you agree to these Terms.
        </p>

        <TermsSection icon={FileText} title="1. Who may use the Service">
          <ul className="list-disc pl-5 space-y-1">
            <li>You must be at least <strong>18 years old</strong>.</li>
            <li>You must be a parent or legal guardian of any baby whose data you add, or have the documented consent of that baby&apos;s parent/guardian.</li>
            <li>You may not create accounts on behalf of someone else without their permission.</li>
            <li>One account per person. Sharing a password is not permitted — invite caregivers instead.</li>
          </ul>
        </TermsSection>

        <TermsSection icon={FileText} title="2. What you can (and can't) do">
          <p>You can:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Record care logs for your babies and invite family members or health professionals.</li>
            <li>Upload photos of handwritten notes for OCR extraction.</li>
            <li>Export your data as PDF or image at any time.</li>
          </ul>
          <p>You may <strong>not</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the Service to provide medical advice, diagnosis, or treatment to others.</li>
            <li>Upload content that is illegal, abusive, or infringes someone else&apos;s rights.</li>
            <li>Attempt to access data belonging to another family.</li>
            <li>Probe, scan, or reverse-engineer the Service in ways that degrade it for others.</li>
            <li>Use automated scripts or bots to generate excessive load (rate limits apply to OCR).</li>
            <li>Resell or commercially redistribute the Service without written permission.</li>
          </ul>
        </TermsSection>

        <TermsSection icon={AlertTriangle} title="3. The Service is not a medical device">
          <p>
            Babylytics is an <strong>information-tracking tool</strong>. It is not a diagnostic device,
            it has not been reviewed by the FDA, the EMA, or any Ministry of Health. The recommended
            feeding amounts, fever thresholds, and vaccination schedule are <strong>educational
            defaults</strong>, not medical advice.
          </p>
          <p>See the full <Link href="/disclaimer" className="text-brand-700 underline">Medical Disclaimer</Link>.</p>
        </TermsSection>

        <TermsSection icon={ShieldCheck} title="4. Your data and content">
          <p>
            You own the data you put into the Service. By uploading, you grant us a limited licence to
            store and process it in order to operate the Service. We do not train AI models on your
            data. See the <Link href="/privacy" className="text-brand-700 underline">Privacy Policy</Link>{' '}
            for details.
          </p>
        </TermsSection>

        <TermsSection icon={Ban} title="5. Suspension and termination">
          <p>
            You can delete your account at any time (email us at{' '}
            <a href="mailto:ahmedtarekmostafaali@gmail.com" className="text-brand-700 underline">
              ahmedtarekmostafaali@gmail.com
            </a>).
          </p>
          <p>
            We may suspend or terminate accounts that violate these Terms or that abuse the Service
            (e.g. excessive OCR calls, attempted abuse of other users). We will give 30 days&apos;
            notice where possible, except in the case of urgent safety or legal issues.
          </p>
        </TermsSection>

        <TermsSection icon={AlertTriangle} title="6. No warranty">
          <p>
            The Service is provided <strong>"as is"</strong>, without warranty of any kind, express or
            implied — including but not limited to warranties of merchantability, fitness for a
            particular purpose, or non-infringement. We make no promise that the Service will be
            uninterrupted, error-free, or that any data will always be retained despite our backup
            efforts.
          </p>
        </TermsSection>

        <TermsSection icon={Gavel} title="7. Limitation of liability">
          <p>
            To the fullest extent permitted by law, the operator of Babylytics will not be liable for
            any indirect, incidental, consequential, or punitive damages, loss of data, loss of
            profits, or health outcomes, arising from or related to your use of the Service. Our
            total liability will not exceed the amount you have paid for the Service in the past
            twelve months (which, for a free tier, is zero).
          </p>
        </TermsSection>

        <TermsSection icon={Gavel} title="8. Governing law">
          <p>
            These Terms are governed by the laws of the Arab Republic of Egypt, without regard to its
            conflict-of-law provisions. Any dispute will be resolved in the competent courts of Cairo,
            Egypt.
          </p>
          <p>
            Nothing in these Terms affects mandatory consumer-protection rights that you may have
            under the law of your country of residence.
          </p>
        </TermsSection>

        <TermsSection icon={FileText} title="9. Changes">
          <p>
            We may update these Terms occasionally. When we do, we&apos;ll post the new version here
            with a new "Last updated" date and, for material changes, show a notice in the app. Your
            continued use after the change means you accept the new Terms.
          </p>
        </TermsSection>

        <p className="text-xs text-ink-muted pt-6 border-t border-slate-200">
          See also: <Link href="/privacy" className="text-brand-700 underline">Privacy Policy</Link>
          {' '}·{' '}
          <Link href="/disclaimer" className="text-brand-700 underline">Medical Disclaimer</Link>
        </p>
      </section>
    </div>
  );
}

function TermsSection({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-strong">
        <Icon className="h-4 w-4 text-brand-600" />
        {title}
      </h2>
      <div className="text-sm text-ink space-y-2">{children}</div>
    </section>
  );
}

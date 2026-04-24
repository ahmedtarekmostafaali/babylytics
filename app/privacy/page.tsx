import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Shield, Lock, Eye, Globe, FileText, Mail } from 'lucide-react';

export const metadata = { title: 'Privacy Policy' };

const LAST_UPDATED = 'April 2026';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="space-y-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-2 text-brand-600">
          <Shield className="h-5 w-5" />
          <span className="text-xs uppercase tracking-wider font-semibold">Legal</span>
        </div>
        <h1 className="text-3xl font-bold text-ink-strong">Privacy Policy</h1>
        <p className="text-sm text-ink-muted">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="prose prose-sm max-w-none text-ink space-y-5">
        <p>
          This Privacy Policy describes how <strong>Babylytics</strong> ("we", "us", "the Service") collects,
          uses, stores and shares personal information when you use the app at{' '}
          <a href="https://babylytics.org" className="text-brand-700 underline">babylytics.org</a>.
          We care deeply about your family&apos;s privacy — especially because the app stores health
          information about children.
        </p>

        <Section icon={FileText} title="1. Who we are">
          <p>
            Babylytics is a personal, non-commercial project operated by the app owner (contact below).
            It is <strong>not</strong> a medical device, clinic, or licensed healthcare provider. See the{' '}
            <Link href="/disclaimer" className="text-brand-700 underline">Medical Disclaimer</Link>.
          </p>
        </Section>

        <Section icon={Eye} title="2. What we collect">
          <p>When you create an account and use the app, the following information is stored:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Account data:</strong> email, display name, hashed password (managed by Supabase Auth).</li>
            <li><strong>Baby profile:</strong> name, date of birth, gender, birth weight/height, optional photo, blood type, notes.</li>
            <li><strong>Care logs:</strong> feedings, diaper changes, medications and dose logs, measurements, temperature readings, sleep sessions, vaccination schedule.</li>
            <li><strong>Doctor information:</strong> doctor names, clinics, phone numbers, email, addresses, appointments (visible only to owners and parents).</li>
            <li><strong>Caregiver access:</strong> the emails you invite and the role you grant them.</li>
            <li><strong>Uploaded files:</strong> prescriptions, reports, handwritten notes, photos you upload for OCR or archiving.</li>
            <li><strong>OCR output:</strong> extracted text and structured data from files you submit for scanning.</li>
            <li><strong>Comments:</strong> notes you leave on any log entry.</li>
            <li><strong>Technical logs:</strong> standard web-server logs (IP, user-agent, request time) collected by our hosting providers.</li>
          </ul>
          <p>
            We do <strong>not</strong> use cookies for advertising. We do not sell your data. We do not
            share it with third parties other than the processors listed in section 6.
          </p>
        </Section>

        <Section icon={Lock} title="3. Legal basis (for EU users)">
          <p>
            For users subject to the EU GDPR, our legal basis for processing health data is your
            explicit <strong>consent</strong>, given when you create an account and check the consent box
            on signup. You can withdraw consent at any time by deleting your account (section 7).
          </p>
          <p>
            Because the data concerns children, we rely on the consent of the parent or legal guardian
            creating the account. You must be 18+ to register.
          </p>
        </Section>

        <Section icon={FileText} title="4. How we use your data">
          <ul className="list-disc pl-5 space-y-1">
            <li>To display your logs, charts, reports and reminders.</li>
            <li>To send in-app notifications (e.g. medication due, OCR confidence).</li>
            <li>To let caregivers you invite see the data according to their role.</li>
            <li>To operate OCR on files you submit — the image or PDF is sent to Anthropic&apos;s Claude API for text extraction, then stored in our database.</li>
            <li>To maintain an audit log of every change (for medical traceability).</li>
            <li>To back up the database and storage for recovery.</li>
          </ul>
        </Section>

        <Section icon={Globe} title="5. Where your data is stored">
          <p>
            Data is stored on <strong>Supabase</strong> (Postgres + Storage) in their managed cloud, and
            the app is hosted on <strong>Vercel</strong>. Backups are maintained by Supabase. Both are
            US-headquartered companies with global infrastructure.
          </p>
          <p>
            If you are in the EU, your data may be transferred outside the EU. We rely on the standard
            contractual clauses (SCCs) in place between these providers and their customers.
          </p>
        </Section>

        <Section icon={Globe} title="6. Third-party processors">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> — database, authentication, storage, backups.</li>
            <li><strong>Vercel</strong> — application hosting and CDN.</li>
            <li><strong>Anthropic</strong> — Claude AI model used only for OCR of files you submit. Files uploaded for OCR are processed by Anthropic under its zero-retention policy for API requests; no training happens on your data.</li>
          </ul>
        </Section>

        <Section icon={Shield} title="7. Your rights">
          <p>You can, at any time:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Access</strong> — view and export your baby&apos;s data via the Reports screen (PDF / image).</li>
            <li><strong>Correct</strong> — edit any log, profile field, or comment directly in the app.</li>
            <li><strong>Delete</strong> — soft-delete individual entries from any log page, or delete your entire baby profile from Settings → Profile.</li>
            <li><strong>Revoke access</strong> — remove any caregiver from the Caregivers page.</li>
            <li><strong>Export</strong> — use the Full Report to download every entry.</li>
            <li><strong>Full account erasure</strong> — email us (section 10). We will permanently delete your account, all babies under your ownership, all logs, storage objects, and audit history within 30 days.</li>
          </ul>
        </Section>

        <Section icon={Lock} title="8. Security">
          <p>
            Every table is protected by row-level security — no data is readable or writable without an
            authenticated session that belongs to the baby&apos;s caregivers. Passwords are bcrypt-hashed
            by Supabase Auth. Traffic is encrypted with TLS. Storage buckets are private; files are only
            accessible through short-lived signed URLs.
          </p>
          <p>
            Despite best effort, no system is 100% secure. If you suspect a breach, contact us
            immediately (section 10).
          </p>
        </Section>

        <Section icon={FileText} title="9. Retention">
          <p>
            Active account data is retained for as long as your account exists. Soft-deleted entries are
            preserved for auditing for up to 2 years, then purged. Server access logs are kept for 30
            days. If you delete your account, all rows are hard-deleted within 30 days.
          </p>
        </Section>

        <Section icon={Mail} title="10. Contact">
          <p>
            For any privacy question, correction request, or account deletion, email us at{' '}
            <a href="mailto:ahmedtarekmostafaali@gmail.com" className="text-brand-700 underline">
              ahmedtarekmostafaali@gmail.com
            </a>.
            We aim to respond within 5 business days.
          </p>
        </Section>

        <Section icon={FileText} title="11. Changes to this policy">
          <p>
            We may update this policy occasionally. Material changes will be announced on the app&apos;s
            login page or by email.
          </p>
        </Section>

        <p className="text-xs text-ink-muted pt-6 border-t border-slate-200">
          See also: <Link href="/terms" className="text-brand-700 underline">Terms of Service</Link>
          {' '}·{' '}
          <Link href="/disclaimer" className="text-brand-700 underline">Medical Disclaimer</Link>
        </p>
      </section>
    </div>
  );
}

function Section({ icon: Icon, title, children }: {
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

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { FeedbackForm } from '@/components/forms/FeedbackForm';
import { FeedbackHistoryItem } from '@/components/FeedbackHistoryItem';
import { fmtDateTime } from '@/lib/dates';
import { Bug, Lightbulb, MessageSquareText, HelpCircle, Inbox, Sparkles } from 'lucide-react';
import { loadUserPrefs } from '@/lib/user-prefs';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Feedback' };

type Row = {
  id: string;
  kind: 'bug' | 'feature_request' | 'feedback' | 'question';
  subject: string;
  body: string;
  attachment_path: string | null;
  status: 'open' | 'triaged' | 'in_progress' | 'resolved' | 'dismissed';
  admin_response: string | null;
  created_at: string;
  updated_at: string;
};

export default async function FeedbackPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const userPrefs = await loadUserPrefs(supabase);
  const t = tFor(userPrefs.language);

  const { data: rowsData } = await supabase.from('user_feedback')
    .select('id,kind,subject,body,attachment_path,status,admin_response,created_at,updated_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (rowsData ?? []) as Row[];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-coral-700 inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5" /> {t('feedback.eyebrow')}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-strong">{t('feedback.title')}</h1>
        <p className="mt-1 text-sm text-ink-muted">{t('feedback.subtitle')}</p>
      </div>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
        <FeedbackForm />
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Inbox className="h-4 w-4 text-ink-muted" />
          <h2 className="text-sm font-bold text-ink-strong">{t('feedback.history')}</h2>
          {rows.length > 0 && (
            <span className="ml-auto text-[11px] text-ink-muted">{rows.length} {t('feedback.items')}</span>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-ink-muted text-sm">
            {t('feedback.empty')}
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map(r => (
              <FeedbackHistoryItem key={r.id} row={r} lang={userPrefs.language} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

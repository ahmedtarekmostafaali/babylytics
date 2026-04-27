'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Bug, Lightbulb, MessageSquareText, HelpCircle, Paperclip, MessageCircle } from 'lucide-react';
import { fmtDateTime } from '@/lib/dates';
import { tFor, type Lang } from '@/lib/i18n';

type Kind = 'bug' | 'feature_request' | 'feedback' | 'question';
type Status = 'open' | 'triaged' | 'in_progress' | 'resolved' | 'dismissed';

type Row = {
  id: string;
  kind: Kind;
  subject: string;
  body: string;
  attachment_path: string | null;
  status: Status;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
};

const KIND_META: Record<Kind, { Icon: React.ComponentType<{ className?: string }>; tint: string }> = {
  bug:             { Icon: Bug,                tint: 'bg-coral-100 text-coral-700' },
  feature_request: { Icon: Lightbulb,          tint: 'bg-lavender-100 text-lavender-700' },
  feedback:        { Icon: MessageSquareText,  tint: 'bg-mint-100 text-mint-700' },
  question:        { Icon: HelpCircle,         tint: 'bg-brand-100 text-brand-700' },
};

const STATUS_TINT: Record<Status, string> = {
  open:        'bg-slate-100 text-ink',
  triaged:     'bg-brand-100 text-brand-700',
  in_progress: 'bg-peach-100 text-peach-700',
  resolved:    'bg-mint-100 text-mint-700',
  dismissed:   'bg-slate-100 text-ink-muted',
};

export function FeedbackHistoryItem({ row, lang = 'en' }: { row: Row; lang?: Lang }) {
  const t = tFor(lang);
  const meta = KIND_META[row.kind];
  const Icon = meta.Icon;
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  // Lazily sign the attachment URL when an item with one is rendered.
  useEffect(() => {
    if (!row.attachment_path) return;
    const supabase = createClient();
    supabase.storage.from('feedback-attachments')
      .createSignedUrl(row.attachment_path, 60 * 60)  // 1h
      .then(({ data }) => setAttachmentUrl(data?.signedUrl ?? null));
  }, [row.attachment_path]);

  return (
    <li className="rounded-2xl bg-white border border-slate-200 p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${meta.tint}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted">
              {t(`feedback.kind_${row.kind}`)}
            </span>
            <span className={`text-[10px] uppercase font-bold tracking-wider rounded-full px-2 py-0.5 ${STATUS_TINT[row.status]}`}>
              {t(`feedback.status_${row.status}`)}
            </span>
            <span className="ms-auto text-[11px] text-ink-muted whitespace-nowrap">{fmtDateTime(row.created_at)}</span>
          </div>
          <div className="mt-1 font-semibold text-ink-strong">{row.subject}</div>
          <p className="mt-1 text-sm text-ink leading-relaxed whitespace-pre-wrap">{row.body}</p>

          {row.attachment_path && (
            <div className="mt-3">
              {attachmentUrl ? (
                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
                  <Paperclip className="h-3 w-3" /> {t('feedback.view_attachment')}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <Paperclip className="h-3 w-3" /> {t('feedback.loading_attachment')}
                </span>
              )}
            </div>
          )}

          {row.admin_response && (
            <div className="mt-3 rounded-xl bg-mint-50 border border-mint-200 p-3 text-xs">
              <div className="flex items-center gap-1.5 text-mint-700 font-semibold mb-1">
                <MessageCircle className="h-3 w-3" /> {t('feedback.team_response')}
              </div>
              <p className="text-ink whitespace-pre-wrap">{row.admin_response}</p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

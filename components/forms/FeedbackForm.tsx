'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Bug, Lightbulb, MessageSquareText, HelpCircle, Send, Loader2, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

type Kind = 'bug' | 'feature_request' | 'feedback' | 'question';

const KINDS: { key: Kind; icon: React.ComponentType<{ className?: string }>; tint: 'coral'|'mint'|'lavender'|'brand' }[] = [
  { key: 'bug',             icon: Bug,                tint: 'coral' },
  { key: 'feature_request', icon: Lightbulb,          tint: 'lavender' },
  { key: 'feedback',        icon: MessageSquareText,  tint: 'mint' },
  { key: 'question',        icon: HelpCircle,         tint: 'brand' },
];

export function FeedbackForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [kind, setKind]       = useState<Kind>('feedback');
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [file, setFile]       = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);

  function pickFile(f: File | null) {
    if (!f) { setFile(null); setFilePreview(null); return; }
    if (f.size > 10 * 1024 * 1024) {
      setErr(t('feedback.err_file_too_big'));
      return;
    }
    if (!f.type.startsWith('image/')) {
      setErr(t('feedback.err_file_type'));
      return;
    }
    setErr(null);
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!subject.trim()) { setErr(t('feedback.err_subject')); return; }
    if (!body.trim())    { setErr(t('feedback.err_body')); return; }

    setSaving(true);
    const supabase = createClient();
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data.user?.id;
    if (!userId) { setErr('not authenticated'); setSaving(false); return; }

    let attachmentPath: string | null = null;
    if (file) {
      // Path layout: <user_id>/<timestamp>-<filename>
      // The storage RLS only allows reads/writes to objects whose first
      // path segment matches the caller's auth.uid() — see migration 038.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
      attachmentPath = `${userId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('feedback-attachments')
        .upload(attachmentPath, file, { contentType: file.type, upsert: false });
      if (upErr) { setErr(upErr.message); setSaving(false); return; }
    }

    const { error } = await supabase.from('user_feedback').insert({
      user_id: userId,
      kind,
      subject: subject.trim(),
      body: body.trim(),
      attachment_path: attachmentPath,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }

    setSubject(''); setBody(''); setFile(null); setFilePreview(null); setKind('feedback');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onSaved?.();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Kind picker */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-2">{t('feedback.kind_label')}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {KINDS.map(({ key, icon: Icon, tint }) => {
            const active = kind === key;
            const activeCss = {
              coral:    'bg-coral-500    text-white border-coral-500',
              mint:     'bg-mint-500     text-white border-mint-500',
              lavender: 'bg-lavender-500  text-white border-lavender-500',
              brand:    'bg-brand-500    text-white border-brand-500',
            }[tint];
            return (
              <button type="button" key={key} onClick={() => setKind(key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 transition',
                  active ? `${activeCss} shadow-sm` : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
                )}>
                <Icon className="h-5 w-5" />
                <span className="text-xs font-semibold">{t(`feedback.kind_${key}`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">{t('feedback.subject')}</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={200}
          placeholder={t('feedback.subject_ph')}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
      </div>

      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">{t('feedback.body')}</label>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} maxLength={8000}
          placeholder={t('feedback.body_ph')}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-coral-500 focus:ring-2 focus:ring-coral-500/30" />
        <div className="text-[10px] text-ink-muted mt-1 text-right">{body.length} / 8000</div>
      </div>

      {/* Attachment */}
      <div>
        <label className="block text-xs font-medium text-ink-muted mb-1.5">{t('feedback.attachment')}</label>
        {!file ? (
          <label className="flex items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-sm text-ink-muted transition">
            <ImagePlus className="h-5 w-5" />
            <span>{t('feedback.attach_cta')}</span>
            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only"
              onChange={e => pickFile(e.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-2 flex items-center gap-3">
            {filePreview && <img src={filePreview} alt="preview"
              className="h-16 w-16 rounded-lg object-cover" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink-strong truncate">{file.name}</div>
              <div className="text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</div>
            </div>
            <button type="button" onClick={() => pickFile(null)}
              className="h-8 w-8 grid place-items-center rounded-full hover:bg-slate-100"
              aria-label={t('feedback.remove_attachment')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-[11px] text-ink-muted mt-1.5">{t('feedback.attachment_help')}</p>
      </div>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <Button type="submit" disabled={saving}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-coral-600 text-white font-semibold">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {saving ? t('feedback.sending') : t('feedback.send')}
      </Button>
    </form>
  );
}

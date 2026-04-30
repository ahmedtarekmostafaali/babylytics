'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, TypeTile, WhenPicker, Field } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Droplet, Droplets, CloudRain, Camera, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/client';

type Size = 'small' | 'medium' | 'large';

export type StoolFormValue = {
  id?: string;
  baby_id: string;
  stool_time?: string | null;
  quantity_category?: Size | null;
  quantity_ml?: number | null;
  color?: string | null;
  consistency?: string | null;
  has_diaper_rash?: boolean;
  notes?: string | null;
  attachment_path?: string | null;
};

const COLORS = ['yellow', 'mustard', 'green', 'brown', 'dark brown', 'black', 'red-tinged'];
const CONSISTENCIES = ['watery', 'loose', 'soft', 'firm', 'pellets'];

export function StoolForm({ babyId, initial }: { babyId: string; initial?: StoolFormValue }) {
  const router = useRouter();
  const t = useT();
  const [time, setTime] = useState(initial?.stool_time ? isoToLocalInput(initial.stool_time) : nowLocalInput());
  const [size, setSize] = useState<Size>((initial?.quantity_category ?? 'medium') as Size);
  const [ml, setMl]     = useState(initial?.quantity_ml?.toString() ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [consistency, setConsistency] = useState(initial?.consistency ?? '');
  const [rash, setRash] = useState<boolean>(initial?.has_diaper_rash ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Diaper photo. Stored under <baby_id>/<uuid>.<ext> in the
  // 'stool-attachments' private bucket; column holds just the path.
  const [attachmentPath, setAttachmentPath] = useState<string | null>(initial?.attachment_path ?? null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Pick an image file.'); return; }
    if (file.size > 8 * 1024 * 1024) { setErr('Image must be under 8 MB.'); return; }
    setErr(null); setUploading(true);
    const supabase = createClient();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${babyId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('stool-attachments').upload(path, file, {
      cacheControl: '3600', upsert: false, contentType: file.type,
    });
    setUploading(false);
    if (error) { setErr(error.message); return; }
    // Drop the previous photo if there was one — the form holds at most one.
    if (attachmentPath && attachmentPath !== path) {
      await supabase.storage.from('stool-attachments').remove([attachmentPath]);
    }
    setAttachmentPath(path);
    // Local preview from the picked file (skips a round-trip to Storage).
    const reader = new FileReader();
    reader.onload = () => setAttachmentPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onRemoveAttachment() {
    if (!attachmentPath) return;
    const supabase = createClient();
    await supabase.storage.from('stool-attachments').remove([attachmentPath]);
    setAttachmentPath(null);
    setAttachmentPreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const iso = localInputToIso(time);
    if (!iso) { setErr('Pick a valid time.'); return; }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      stool_time: iso,
      quantity_category: size,
      quantity_ml: ml ? Number(ml) : null,
      color: color || null,
      consistency: consistency || null,
      has_diaper_rash: rash,
      notes: notes || null,
      attachment_path: attachmentPath,
    };
    const op = initial?.id
      ? supabase.from('stool_logs').update(payload).eq('id', initial.id)
      : supabase.from('stool_logs').insert({ baby_id: babyId, ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await op;
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/stool`);
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this stool log?')) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('stool_logs').update({ deleted_at: new Date().toISOString() }).eq('id', initial.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${babyId}/stool`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section n={1} title={t('forms.stool_size')}>
        <div className="grid grid-cols-3 gap-3">
          <TypeTile icon={Droplet}   label={t('forms.stool_small')}  tint="mint" active={size === 'small'}  onClick={() => setSize('small')} />
          <TypeTile icon={Droplets}  label={t('forms.stool_medium')} tint="mint" active={size === 'medium'} onClick={() => setSize('medium')} />
          <TypeTile icon={CloudRain} label={t('forms.stool_large')}  tint="mint" active={size === 'large'}  onClick={() => setSize('large')} />
        </div>
      </Section>

      <Section n={2} title={t('forms.feed_details')} optional>
        <div className="space-y-4">
          <Field label={t('forms.stool_color')}>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <Chip key={c} active={color === c} onClick={() => setColor(color === c ? '' : c)}>{c}</Chip>
              ))}
            </div>
          </Field>
          <Field label={t('forms.stool_consistency')}>
            <div className="flex flex-wrap gap-2">
              {CONSISTENCIES.map(c => (
                <Chip key={c} active={consistency === c} onClick={() => setConsistency(consistency === c ? '' : c)}>{c}</Chip>
              ))}
            </div>
          </Field>
          <Field label={t('forms.feed_quantity')}>
            <input type="number" min={0} max={1000} step={1}
              value={ml} onChange={e => setMl(e.target.value)}
              className="h-12 w-40 rounded-2xl border border-slate-200 bg-white px-4 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rash} onChange={e => setRash(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-mint-500 focus:ring-mint-500" />
            {t('forms.stool_diaper_rash')}
          </label>
        </div>
      </Section>

      <Section n={3} title={t('forms.when')}>
        <WhenPicker time={time} onChange={setTime} tint="mint" />
      </Section>

      <Section n={4} title={t('forms.feed_add_details')} optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder={t('forms.feed_notes_placeholder')}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {/* 5. Diaper photo — optional. Useful for the pediatrician to see
          actual colour/consistency without you fumbling for words. */}
      <Section n={5} title="Diaper photo" optional>
        {attachmentPath ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-3">
            {/* Preview shows the data-URL for the just-picked file; for a
                row loaded from the DB we just show the filename — signing a
                URL on every form load would be wasteful. */}
            {attachmentPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={attachmentPreview} alt="Diaper photo preview"
                className="h-16 w-16 rounded-xl object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-slate-100 grid place-items-center text-ink-muted shrink-0">
                <Camera className="h-6 w-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-ink-strong truncate">
                {attachmentPath.split('/').pop()}
              </div>
              <div className="text-xs text-ink-muted">Saved with this stool log.</div>
            </div>
            <button type="button" onClick={onRemoveAttachment}
              className="inline-flex items-center gap-1 rounded-full border border-coral-200 bg-coral-50 hover:bg-coral-100 text-coral-700 text-xs font-semibold px-3 py-1.5">
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <label className="block rounded-2xl border-2 border-dashed border-slate-200 hover:border-mint-400 hover:bg-mint-50/40 p-5 text-center cursor-pointer transition">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickFile} disabled={uploading} />
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-ink">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-mint-500" />}
              {uploading ? 'Uploading…' : 'Tap to take or choose a photo'}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">Stays private to people with access to this baby. Max 8 MB.</div>
          </label>
        )}
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-mint-500 to-mint-600">
          <Save className="h-5 w-5" /> {saving ? t('forms.saving') : initial?.id ? t('forms.save_changes') : t('forms.stool_log_cta')}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">{t('forms.delete')}</Button>
        )}
      </div>
    </form>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-sm border transition',
        active ? 'bg-mint-500 border-mint-500 text-white shadow-sm' : 'bg-white border-slate-200 text-ink hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  );
}

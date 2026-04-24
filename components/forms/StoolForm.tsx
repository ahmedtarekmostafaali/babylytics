'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Section, TypeTile, WhenPicker, Field } from '@/components/forms/FormKit';
import { localInputToIso, isoToLocalInput, nowLocalInput } from '@/lib/dates';
import { Save, Droplet, Droplets, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';

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
};

const COLORS = ['yellow', 'mustard', 'green', 'brown', 'dark brown', 'black', 'red-tinged'];
const CONSISTENCIES = ['watery', 'loose', 'soft', 'firm', 'pellets'];

export function StoolForm({ babyId, initial }: { babyId: string; initial?: StoolFormValue }) {
  const router = useRouter();
  const [time, setTime] = useState(initial?.stool_time ? isoToLocalInput(initial.stool_time) : nowLocalInput());
  const [size, setSize] = useState<Size>((initial?.quantity_category ?? 'medium') as Size);
  const [ml, setMl]     = useState(initial?.quantity_ml?.toString() ?? '');
  const [color, setColor] = useState(initial?.color ?? '');
  const [consistency, setConsistency] = useState(initial?.consistency ?? '');
  const [rash, setRash] = useState<boolean>(initial?.has_diaper_rash ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [err, setErr]   = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      <Section n={1} title="Size">
        <div className="grid grid-cols-3 gap-3">
          <TypeTile icon={Droplet}   label="Small"  tint="mint" active={size === 'small'}  onClick={() => setSize('small')} />
          <TypeTile icon={Droplets}  label="Medium" tint="mint" active={size === 'medium'} onClick={() => setSize('medium')} />
          <TypeTile icon={CloudRain} label="Large"  tint="mint" active={size === 'large'}  onClick={() => setSize('large')} />
        </div>
      </Section>

      <Section n={2} title="Appearance" optional>
        <div className="space-y-4">
          <Field label="Color">
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <Chip key={c} active={color === c} onClick={() => setColor(color === c ? '' : c)}>{c}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Consistency">
            <div className="flex flex-wrap gap-2">
              {CONSISTENCIES.map(c => (
                <Chip key={c} active={consistency === c} onClick={() => setConsistency(consistency === c ? '' : c)}>{c}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Quantity (ml, optional)">
            <input type="number" min={0} max={1000} step={1}
              value={ml} onChange={e => setMl(e.target.value)}
              placeholder="estimate if you know"
              className="h-12 w-40 rounded-2xl border border-slate-200 bg-white px-4 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rash} onChange={e => setRash(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-mint-500 focus:ring-mint-500" />
            Diaper rash present
          </label>
        </div>
      </Section>

      <Section n={3} title="When?">
        <WhenPicker time={time} onChange={setTime} tint="mint" />
      </Section>

      <Section n={4} title="Add details" optional>
        <textarea rows={3} value={notes ?? ''} onChange={e => setNotes(e.target.value)}
          placeholder="Anything worth remembering"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" />
      </Section>

      {err && <p className="text-sm text-coral-600 font-medium">{err}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}
          className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-mint-500 to-mint-600">
          <Save className="h-5 w-5" /> {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Save stool log'}
        </Button>
        {initial?.id && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={saving} className="h-14 rounded-2xl">Delete</Button>
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

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BabySchema, PregnancyOnboardSchema } from '@/lib/validators';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Baby, Heart } from 'lucide-react';
import { eddFromLmp } from '@/lib/lifecycle';

type Stage = 'pregnancy' | 'born';

export default function NewBabyPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage | null>(null);

  return (
    <PageShell max="3xl">
      <PageHeader backHref="/dashboard" backLabel="Dashboard"
        eyebrow="Welcome" eyebrowTint="coral"
        title={stage === 'pregnancy' ? 'Track a pregnancy' : stage === 'born' ? 'Add your baby' : 'Add a profile'}
        subtitle={stage === null ? 'You can always change details later.' : 'You can always edit these later.'} />

      {stage === null ? (
        <StagePicker onPick={setStage} />
      ) : stage === 'pregnancy' ? (
        <PregnancyForm onBack={() => setStage(null)} router={router} />
      ) : (
        <BornForm onBack={() => setStage(null)} router={router} />
      )}
    </PageShell>
  );
}

function StagePicker({ onPick }: { onPick: (s: Stage) => void }) {
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm text-ink-muted mb-4">Where are you on the journey?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onPick('pregnancy')}
            className="rounded-2xl border-2 border-lavender-200 bg-gradient-to-br from-lavender-50 to-coral-50 p-5 text-left hover:border-lavender-400 hover:shadow-card transition">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-lavender-500 text-white grid place-items-center">
                <Heart className="h-5 w-5" />
              </span>
              <div className="font-bold text-ink-strong">I&apos;m pregnant</div>
            </div>
            <p className="text-xs text-ink-muted mt-3">Track ultrasounds, prenatal visits, kicks, maternal vitals. When the baby arrives, we&apos;ll move everything over to the newborn tracker.</p>
          </button>
          <button
            onClick={() => onPick('born')}
            className="rounded-2xl border-2 border-coral-200 bg-gradient-to-br from-coral-50 to-peach-50 p-5 text-left hover:border-coral-400 hover:shadow-card transition">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-coral-500 text-white grid place-items-center">
                <Baby className="h-5 w-5" />
              </span>
              <div className="font-bold text-ink-strong">My baby is born</div>
            </div>
            <p className="text-xs text-ink-muted mt-3">Track feedings, stool, sleep, growth, vaccinations, and everything else.</p>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function PregnancyForm({ onBack, router }: { onBack: () => void; router: ReturnType<typeof useRouter> }) {
  const [name, setName] = useState('');
  const [edd, setEdd] = useState('');
  const [lmp, setLmp] = useState('');
  const [conception, setConception] = useState<'natural'|'ivf'|'iui'|'icsi'|'other'|''>('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-fill EDD from LMP if user enters LMP first.
  function onLmpChange(v: string) {
    setLmp(v);
    if (v && !edd) setEdd(eddFromLmp(v));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = PregnancyOnboardSchema.safeParse({
      name: name || null,
      edd: edd || null,
      lmp: lmp || null,
      conception_method: conception || null,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_pregnancy_with_owner', {
      p_name: parsed.data.name ?? 'Baby',
      p_edd: parsed.data.edd ?? null,
      p_lmp: parsed.data.lmp ?? null,
      p_conception_method: parsed.data.conception_method ?? null,
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${data}`);
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label>Baby&apos;s name (you can decide later)</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Optional — leave blank for now" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Last menstrual period (LMP)</Label>
              <Input type="date" value={lmp} onChange={e => onLmpChange(e.target.value)} />
              <p className="text-xs text-ink-muted mt-1">We&apos;ll auto-fill the EDD using Naegele&apos;s rule.</p>
            </div>
            <div>
              <Label>Estimated due date (EDD)</Label>
              <Input type="date" value={edd} onChange={e => setEdd(e.target.value)} required />
              <p className="text-xs text-ink-muted mt-1">From your doctor or first ultrasound.</p>
            </div>
          </div>
          <div>
            <Label>Conception method (optional)</Label>
            <Select value={conception} onChange={e => setConception(e.target.value as typeof conception)}>
              <option value="">— Prefer not to say —</option>
              <option value="natural">Natural</option>
              <option value="ivf">IVF</option>
              <option value="icsi">ICSI</option>
              <option value="iui">IUI</option>
              <option value="other">Other</option>
            </Select>
          </div>
          {err && <p className="text-sm text-coral-600">{err}</p>}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-coral-500">
              <Heart className="h-4 w-4" /> {loading ? 'Creating…' : 'Start tracking pregnancy'}
            </Button>
            <button type="button" onClick={onBack}
              className="text-sm text-ink-muted hover:text-ink-strong">Back</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BornForm({ onBack, router }: { onBack: () => void; router: ReturnType<typeof useRouter> }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male'|'female'>('female');
  const [birthWeight, setBirthWeight] = useState('');
  const [birthHeight, setBirthHeight] = useState('');
  const [factor, setFactor] = useState('150');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = BabySchema.safeParse({
      name, dob, gender,
      birth_weight_kg: birthWeight || null,
      birth_height_cm: birthHeight || null,
      feeding_factor: factor,
    });
    if (!parsed.success) { setErr(parsed.error.errors[0]?.message ?? 'invalid'); return; }
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_baby_with_owner', {
      p_name: parsed.data.name,
      p_dob: new Date(parsed.data.dob).toISOString(),
      p_gender: parsed.data.gender,
      p_birth_weight_kg: parsed.data.birth_weight_kg ?? null,
      p_birth_height_cm: parsed.data.birth_height_cm ?? null,
      p_feeding_factor: parsed.data.feeding_factor,
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${data}`);
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <Label htmlFor="n">Name</Label>
            <Input id="n" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d">Date &amp; time of birth</Label>
            <Input id="d" type="datetime-local" required value={dob} onChange={e => setDob(e.target.value)} />
            <p className="text-xs text-ink-muted mt-1">Exact time matters for first-day feeding math.</p>
          </div>
          <div>
            <Label htmlFor="g">Gender</Label>
            <Select id="g" value={gender} onChange={e => setGender(e.target.value as typeof gender)}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bw">Birth weight (kg)</Label>
              <Input id="bw" type="number" step="0.001" min={0} max={10} value={birthWeight} onChange={e => setBirthWeight(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bh">Birth height (cm)</Label>
              <Input id="bh" type="number" step="0.1" min={0} max={80} value={birthHeight} onChange={e => setBirthHeight(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="f">Feeding factor (ml / kg / day)</Label>
            <Input id="f" type="number" step="1" min={50} max={250} value={factor} onChange={e => setFactor(e.target.value)} />
            <p className="text-xs text-ink-muted mt-1">Default 150. Adjust on your pediatrician&apos;s advice.</p>
          </div>
          {err && <p className="text-sm text-coral-600">{err}</p>}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-2xl">
              <Baby className="h-4 w-4" /> {loading ? 'Saving…' : 'Create baby'}
            </Button>
            <button type="button" onClick={onBack}
              className="text-sm text-ink-muted hover:text-ink-strong">Back</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BabySchema, PregnancyOnboardSchema } from '@/lib/validators';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { Baby, Heart, Calendar } from 'lucide-react';
import { eddFromLmp } from '@/lib/lifecycle';
import { useT } from '@/lib/i18n/client';

// 044 batch: 'planning' is the new pre-pregnancy stage — Mom uses this
// while still trying to conceive, gets the cycle calendar + period log.
// She transitions to 'pregnancy' from her baby profile when ready.
type Stage = 'planning' | 'pregnancy' | 'born';

export default function NewBabyPage() {
  const router = useRouter();
  const t = useT();
  const [stage, setStage] = useState<Stage | null>(null);

  return (
    <PageShell max="3xl">
      <PageHeader backHref="/dashboard" backLabel={t('forms.nb_back_dashboard')}
        eyebrow={t('forms.nb_eyebrow')} eyebrowTint="coral"
        title={stage === 'pregnancy' ? t('forms.nb_title_pregnancy') : stage === 'born' ? t('forms.nb_title_born') : t('forms.nb_title_pick')}
        subtitle={stage === null ? t('forms.nb_subtitle_pick') : t('forms.nb_subtitle_form')} />

      {stage === null ? (
        <StagePicker onPick={setStage} />
      ) : stage === 'planning' ? (
        <PlanningForm onBack={() => setStage(null)} router={router} />
      ) : stage === 'pregnancy' ? (
        <PregnancyForm onBack={() => setStage(null)} router={router} />
      ) : (
        <BornForm onBack={() => setStage(null)} router={router} />
      )}
    </PageShell>
  );
}

// PlanningForm — minimal create flow: just a placeholder name (so the
// sidebar / dashboard have something to show). Cycle data gets logged on
// the planner page once the row exists.
function PlanningForm({ onBack, router }: { onBack: () => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
  const [name, setName] = useState('Future baby');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('create_planning_baby_with_owner', {
      p_name: name.trim() || 'Planning',
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    router.push(`/babies/${data}/planner`);
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-ink-muted">
            We'll set up your fertility planner. Pick a name (you can change it any time) — the calendar opens once we save.
          </p>
          <div>
            <Label>Placeholder name</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Future baby, Baby #2" />
          </div>
          {err && <p className="text-sm text-coral-600">{err}</p>}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-coral-500 to-peach-500">
              <Calendar className="h-4 w-4" /> {loading ? 'Creating…' : 'Open my planner'}
            </Button>
            <button type="button" onClick={onBack}
              className="text-sm text-ink-muted hover:text-ink-strong">{t('forms.nb_back')}</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StagePicker({ onPick }: { onPick: (s: Stage) => void }) {
  const t = useT();
  return (
    <Card>
      <CardContent className="py-6">
        <p className="text-sm text-ink-muted mb-4">{t('forms.nb_pick_question')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Planning is new in the 044 batch — pre-pregnancy fertility planner. */}
          <button
            onClick={() => onPick('planning')}
            className="rounded-2xl border-2 border-peach-200 bg-gradient-to-br from-peach-50 to-coral-50 p-5 text-left hover:border-peach-400 hover:shadow-card transition">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-peach-500 text-white grid place-items-center">
                <Calendar className="h-5 w-5" />
              </span>
              <div className="font-bold text-ink-strong">Planning</div>
            </div>
            <p className="text-xs text-ink-muted mt-3">Trying to conceive — track your cycle, ovulation, fertile window.</p>
          </button>
          <button
            onClick={() => onPick('pregnancy')}
            className="rounded-2xl border-2 border-lavender-200 bg-gradient-to-br from-lavender-50 to-coral-50 p-5 text-left hover:border-lavender-400 hover:shadow-card transition">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-lavender-500 text-white grid place-items-center">
                <Heart className="h-5 w-5" />
              </span>
              <div className="font-bold text-ink-strong">{t('forms.nb_pick_pregnant')}</div>
            </div>
            <p className="text-xs text-ink-muted mt-3">{t('forms.nb_pick_pregnant_help')}</p>
          </button>
          <button
            onClick={() => onPick('born')}
            className="rounded-2xl border-2 border-coral-200 bg-gradient-to-br from-coral-50 to-peach-50 p-5 text-left hover:border-coral-400 hover:shadow-card transition">
            <div className="flex items-center gap-2">
              <span className="h-10 w-10 rounded-xl bg-coral-500 text-white grid place-items-center">
                <Baby className="h-5 w-5" />
              </span>
              <div className="font-bold text-ink-strong">{t('forms.nb_pick_born')}</div>
            </div>
            <p className="text-xs text-ink-muted mt-3">{t('forms.nb_pick_born_help')}</p>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function PregnancyForm({ onBack, router }: { onBack: () => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
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
            <Label>{t('forms.pg_name_label')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('forms.pg_name_ph')} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t('forms.pg_lmp')}</Label>
              <Input type="date" value={lmp} onChange={e => onLmpChange(e.target.value)} />
              <p className="text-xs text-ink-muted mt-1">{t('forms.pg_lmp_help')}</p>
            </div>
            <div>
              <Label>{t('forms.pg_edd')}</Label>
              <Input type="date" value={edd} onChange={e => setEdd(e.target.value)} required />
              <p className="text-xs text-ink-muted mt-1">{t('forms.pg_edd_help')}</p>
            </div>
          </div>
          <div>
            <Label>{t('forms.pg_conception')}</Label>
            <Select value={conception} onChange={e => setConception(e.target.value as typeof conception)}>
              <option value="">{t('forms.pg_conception_skip')}</option>
              <option value="natural">{t('forms.pg_conception_natural')}</option>
              <option value="ivf">{t('forms.pg_conception_ivf')}</option>
              <option value="icsi">{t('forms.pg_conception_icsi')}</option>
              <option value="iui">{t('forms.pg_conception_iui')}</option>
              <option value="other">{t('forms.pg_conception_other')}</option>
            </Select>
          </div>
          {err && <p className="text-sm text-coral-600">{err}</p>}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-lavender-500 to-coral-500">
              <Heart className="h-4 w-4" /> {loading ? t('forms.pg_creating') : t('forms.pg_start_cta')}
            </Button>
            <button type="button" onClick={onBack}
              className="text-sm text-ink-muted hover:text-ink-strong">{t('forms.nb_back')}</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BornForm({ onBack, router }: { onBack: () => void; router: ReturnType<typeof useRouter> }) {
  const t = useT();
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
            <Label htmlFor="n">{t('forms.baby_name')}</Label>
            <Input id="n" required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="d">{t('forms.baby_dob')}</Label>
            <Input id="d" type="datetime-local" required value={dob} onChange={e => setDob(e.target.value)} />
            <p className="text-xs text-ink-muted mt-1">{t('forms.nb_born_dob_help')}</p>
          </div>
          <div>
            <Label htmlFor="g">{t('forms.baby_gender')}</Label>
            <Select id="g" value={gender} onChange={e => setGender(e.target.value as typeof gender)}>
              <option value="female">{t('forms.baby_gender_female')}</option>
              <option value="male">{t('forms.baby_gender_male')}</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bw">{t('forms.baby_birth_weight')}</Label>
              <Input id="bw" type="number" step="0.001" min={0} max={10} value={birthWeight} onChange={e => setBirthWeight(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="bh">{t('forms.baby_birth_height')}</Label>
              <Input id="bh" type="number" step="0.1" min={0} max={80} value={birthHeight} onChange={e => setBirthHeight(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="f">{t('forms.baby_feed_factor')}</Label>
            <Input id="f" type="number" step="1" min={50} max={250} value={factor} onChange={e => setFactor(e.target.value)} />
            <p className="text-xs text-ink-muted mt-1">{t('forms.nb_born_factor_help')}</p>
          </div>
          {err && <p className="text-sm text-coral-600">{err}</p>}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1 h-12 rounded-2xl">
              <Baby className="h-4 w-4" /> {loading ? t('forms.saving') : t('forms.nb_born_create')}
            </Button>
            <button type="button" onClick={onBack}
              className="text-sm text-ink-muted hover:text-ink-strong">{t('forms.nb_back')}</button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

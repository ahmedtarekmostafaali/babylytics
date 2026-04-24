'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BabySchema } from '@/lib/validators';
import { PageShell, PageHeader } from '@/components/PageHeader';

export default function NewBabyPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male'|'female'|'other'|'unspecified'>('unspecified');
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
    <PageShell max="3xl">
      <PageHeader backHref="/dashboard" backLabel="dashboard"
        eyebrow="Welcome" eyebrowTint="coral" title="Add a baby"
        subtitle="You can always change these later on the profile page." />
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
                <option value="unspecified">Unspecified</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
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
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Create baby'}</Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

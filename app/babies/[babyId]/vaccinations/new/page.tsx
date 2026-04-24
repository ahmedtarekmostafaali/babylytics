import { Card, CardContent } from '@/components/ui/Card';
import { VaccinationForm } from '@/components/forms/VaccinationForm';
import { PageShell, PageHeader } from '@/components/PageHeader';
import { assertRole } from '@/lib/role-guard';

export const metadata = { title: 'Add vaccination' };

export default async function NewVaccination({ params }: { params: { babyId: string } }) {
  await assertRole(params.babyId, { requireWrite: true });
  return (
    <PageShell max="3xl">
      <PageHeader backHref={`/babies/${params.babyId}/vaccinations`} backLabel="vaccinations"
        eyebrow="Health" eyebrowTint="lavender" title="Add vaccination"
        subtitle="Track scheduled and administered shots. Edit status anytime." />
      <Card><CardContent className="py-6"><VaccinationForm babyId={params.babyId} /></CardContent></Card>
    </PageShell>
  );
}

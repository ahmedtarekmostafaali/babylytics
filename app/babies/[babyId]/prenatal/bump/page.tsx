// Wave 40A: bump journal removed. Page now redirects to the pumping
// log on the same baby for any users who had bookmarked the old URL.

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DeprecatedBumpPage({ params }: { params: { babyId: string } }) {
  redirect(`/babies/${params.babyId}/pumping`);
}

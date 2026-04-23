import { redirect } from 'next/navigation';
// The babies list lives on /dashboard. Redirect for bookmarkability.
export default function BabiesIndex() { redirect('/dashboard'); }

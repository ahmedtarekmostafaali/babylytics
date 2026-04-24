// Deprecated — use ExportButton instead. Kept as a shim so any stale imports
// still compile. Delete this file once everything migrates over.
import { ExportButton } from '@/components/ExportButton';

export function PrintButton({ label = 'Save as PDF' }: { label?: string } = {}) {
  return <ExportButton label={label} />;
}

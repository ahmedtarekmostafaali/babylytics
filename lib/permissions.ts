/**
 * Role-based permissions for Babylytics.
 *
 * Five effective levels (caregiver is an alias of nurse, editor is a legacy
 * alias of parent):
 *
 *   owner    → everything
 *   parent   → everything (the primary caregivers)
 *   doctor   → read logs, add comments, export reports
 *   nurse    → read logs only
 *   viewer   → overview only (no logs, no reports)
 *
 * All UI gates go through these helpers. Server-side RLS enforces the same
 * rules so even a misbehaving client can't bypass them.
 */

export type Role =
  | 'owner' | 'parent' | 'doctor' | 'nurse' | 'viewer'
  | 'editor'    // legacy alias of parent
  | 'caregiver' // legacy alias of nurse
  | null
  | undefined;

function r(role: Role): string {
  return (role ?? '').toString();
}

/** Is the user an owner or parent (the "full access" tier)? */
export function isParent(role: Role): boolean {
  return r(role) === 'owner' || r(role) === 'parent' || r(role) === 'editor';
}

/** Can the user write logs (feedings, stool, medications, etc.)? */
export function canWriteLogs(role: Role): boolean {
  return isParent(role);
}

/** Can the user post comments? */
export function canComment(role: Role): boolean {
  return isParent(role) || r(role) === 'doctor';
}

/** Can the user export reports (save as PDF / image)? */
export function canExportReports(role: Role): boolean {
  return isParent(role) || r(role) === 'doctor';
}

/** Can the user upload attachments (photos, prescriptions, PDFs)? */
export function canUploadFiles(role: Role): boolean {
  return isParent(role);
}

/** Can the user read the log pages at all (beyond the overview)? */
export function canViewLogs(role: Role): boolean {
  // Viewers are restricted to the overview. Every other role may read logs.
  return r(role) !== '' && r(role) !== 'viewer';
}

/** Does the user have any access to this baby at all? */
export function hasAnyAccess(role: Role): boolean {
  return r(role) !== '';
}

/** Nice label for the role pill. */
export function roleLabel(role: Role): string {
  const k = r(role);
  return {
    owner:  'Owner',
    parent: 'Parent',
    editor: 'Parent',
    doctor: 'Doctor',
    nurse:  'Nurse',
    caregiver: 'Nurse',
    viewer: 'Viewer',
  }[k] ?? 'Unknown';
}

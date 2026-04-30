// Server-side helpers for "logged by Sarah · 2 hours ago" / "edited by Ahmed
// · just now" footers. Uses two RPCs from migration 031:
//   - row_audit_summaries(table, ids[]) → created/last-updated for a batch
//   - user_display_names(uids[])        → uuid → friendly name + email
//
// The pattern on a list page: fetch the rows you'd normally fetch, collect
// their ids, then call `loadAuditSignatures(supabase, 'feedings', ids)` once.
// You get back a Map<rowId, AuditSig> ready to drop into a render.

import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditSig = {
  created_by: string | null;
  created_at: string | null;
  last_updated_by: string | null;
  last_updated_at: string | null;
};

export type AuditFooterData = AuditSig & {
  created_by_name: string | null;
  last_updated_by_name: string | null;
};

/** Whitelist must mirror the SQL allowlist in migrations 031 + 038. */
export type AuditTable =
  | 'feedings' | 'stool_logs' | 'sleep_logs' | 'medications' | 'medication_logs'
  | 'measurements' | 'temperature_logs' | 'vaccinations'
  | 'screen_time_logs' | 'activity_logs' | 'teething_logs' | 'speaking_logs'
  | 'developmental_milestones' | 'shopping_list_items' | 'allergies'
  | 'medical_conditions' | 'admissions' | 'discharges' | 'lab_panels' | 'lab_panel_items'
  | 'doctors' | 'appointments' | 'prenatal_visits' | 'ultrasounds' | 'fetal_movements'
  | 'maternal_symptoms' | 'medical_files'
  | 'vital_signs_logs' | 'blood_sugar_logs'
  // 044 batch: new vomiting tracker has its own audit trigger.
  | 'vomiting_logs' | 'menstrual_cycles';

/**
 * Load audit signatures for a batch of rows in one round-trip and resolve
 * the user UUIDs to display names. Returns a Map keyed by row id.
 */
export async function loadAuditSignatures(
  supabase: SupabaseClient,
  table: AuditTable,
  ids: string[],
): Promise<Map<string, AuditFooterData>> {
  const out = new Map<string, AuditFooterData>();
  if (ids.length === 0) return out;

  const { data: sigs } = await supabase.rpc('row_audit_summaries', {
    p_table: table, p_ids: ids,
  });
  const sigList = (sigs ?? []) as Array<{
    row_id: string;
    created_by: string | null; created_at: string | null;
    last_updated_by: string | null; last_updated_at: string | null;
  }>;

  // Collect every uuid we'll need to resolve to a name.
  const uuids = new Set<string>();
  for (const s of sigList) {
    if (s.created_by) uuids.add(s.created_by);
    if (s.last_updated_by) uuids.add(s.last_updated_by);
  }
  let nameMap = new Map<string, string>();
  if (uuids.size > 0) {
    const { data: names } = await supabase.rpc('user_display_names', {
      p_ids: Array.from(uuids),
    });
    for (const n of (names ?? []) as Array<{ id: string; name: string }>) {
      nameMap.set(n.id, n.name);
    }
  }

  for (const s of sigList) {
    out.set(s.row_id, {
      created_by:        s.created_by,
      created_at:        s.created_at,
      last_updated_by:   s.last_updated_by,
      last_updated_at:   s.last_updated_at,
      created_by_name:   s.created_by ? nameMap.get(s.created_by) ?? null : null,
      last_updated_by_name: s.last_updated_by ? nameMap.get(s.last_updated_by) ?? null : null,
    });
  }
  return out;
}

/** Convenience for a single row. */
export async function loadAuditSignature(
  supabase: SupabaseClient,
  table: AuditTable,
  id: string,
): Promise<AuditFooterData | null> {
  const m = await loadAuditSignatures(supabase, table, [id]);
  return m.get(id) ?? null;
}

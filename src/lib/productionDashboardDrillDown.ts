import type { AgeBand } from '@/lib/tracking';
import { isOpenStatus } from '@/lib/status';
import { namesMatch } from '@/lib/nameNormalize';

export interface ProductionDrillEntry {
  id: number;
  production_date: string;
  registration_number: string;
  insurer_name?: string | null;
  assignment?: string | null;
  amount: number;
  amount_without_vat?: number;
  done_by_name?: string | null;
  seen_by_name?: string | null;
  instructed_by_name?: string | null;
  status?: string;
}

export interface DatasheetDrillEntry {
  id: number;
  serial_no: string;
  claim_no: string | null;
  reg_no: string | null;
  status: string;
  client_insurer: string | null;
  assigned_to_name: string | null;
  created_by_name?: string | null;
  age_days: number | null;
  age_band: AgeBand;
  is_overdue: boolean;
  delay_notes?: unknown;
}


function assessorName(row: DatasheetDrillEntry): string {
  return row.assigned_to_name || row.created_by_name || 'Unassigned';
}

export function filterProductionByDate(entries: ProductionDrillEntry[], isoDate: string) {
  return entries.filter((e) => e.production_date.slice(0, 10) === isoDate);
}

export function filterProductionByInsurer(entries: ProductionDrillEntry[], name: string) {
  return entries.filter((e) => namesMatch(e.insurer_name || 'Unknown', name));
}

export function filterProductionByDoneBy(entries: ProductionDrillEntry[], name: string) {
  return entries.filter((e) => namesMatch(e.done_by_name || 'Unassigned', name));
}

export function filterProductionBySeenBy(entries: ProductionDrillEntry[], name: string) {
  return entries.filter((e) => namesMatch(e.seen_by_name || 'Unassigned', name));
}

export function filterProductionByInstructedBy(entries: ProductionDrillEntry[], name: string) {
  return entries.filter((e) => namesMatch(e.instructed_by_name || 'Unassigned', name));
}

export function filterProductionByAssignment(entries: ProductionDrillEntry[], name: string) {
  return entries.filter((e) => namesMatch(e.assignment || 'Unspecified', name));
}

/** Label format: "Person · Assignment" */
export function filterProductionByDoneByAssignment(entries: ProductionDrillEntry[], label: string) {
  const [person, assignment] = label.split(' · ').map((s) => s.trim());
  if (!person || !assignment) return [];
  return entries.filter(
    (e) =>
      namesMatch(e.done_by_name || 'Unassigned', person) &&
      namesMatch(e.assignment || 'Unspecified', assignment),
  );
}

export function filterProductionBySeenByAssignment(entries: ProductionDrillEntry[], label: string) {
  const [person, assignment] = label.split(' · ').map((s) => s.trim());
  if (!person || !assignment) return [];
  return entries.filter(
    (e) =>
      namesMatch(e.seen_by_name || 'Unassigned', person) &&
      namesMatch(e.assignment || 'Unspecified', assignment),
  );
}

/** Strip trailing " (amount)" from assignment bar labels. */
export function parseAssignmentBarLabel(label: string): string {
  const idx = label.lastIndexOf(' (');
  return idx > 0 ? label.slice(0, idx).trim() : label.trim();
}

export function filterOpenDatasheetsByAssessor(rows: DatasheetDrillEntry[], name: string) {
  return rows.filter(
    (r) => isOpenStatus(r.status) && namesMatch(assessorName(r), name),
  );
}

export function filterOpenDatasheetsByInsurer(rows: DatasheetDrillEntry[], name: string) {
  return rows.filter(
    (r) => isOpenStatus(r.status) && namesMatch(r.client_insurer || 'Unknown', name),
  );
}

export function filterOpenDatasheetsByAssessorAging(
  rows: DatasheetDrillEntry[],
  person: string,
  band: AgeBand,
) {
  return rows.filter(
    (r) =>
      isOpenStatus(r.status) &&
      namesMatch(assessorName(r), person) &&
      r.age_band === band,
  );
}

/** "Person · 0–3 days" → person + band key */
export function parseAssessorAgingLabel(label: string): { person: string; band: AgeBand } | null {
  const parts = label.split(' · ');
  if (parts.length < 2) return null;
  const person = parts.slice(0, -1).join(' · ').trim();
  const bandLabel = parts[parts.length - 1].trim().toLowerCase();
  const map: Record<string, AgeBand> = {
    '0–3 days': '0-3',
    '0-3 days': '0-3',
    '4–7 days': '4-7',
    '4-7 days': '4-7',
    '8–14 days': '8-14',
    '8-14 days': '8-14',
    '15+ days': '15+',
    'no instruction date': 'unknown',
  };
  const band = map[bandLabel];
  if (!band) return null;
  return { person, band };
}

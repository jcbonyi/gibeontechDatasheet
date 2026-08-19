import {
  listDatasheets,
  logDatasheetAudit,
  updateDatasheetRecord,
  type DbDatasheet,
} from '@/lib/db';
import { listProductionEntries, createNotification } from '@/lib/productionDb';
import { isOpenStatus, isTerminalStatus, STATUS_LABELS } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';

export type SyncActor = { id: number; name: string };

/** Kenyan-style plates: ignore spaces, hyphens, punctuation, and case. */
export function normalizeRegNoKey(raw: string | null | undefined): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Compact job-type key so Form Type and Assignment compare as similar:
 * "Re-inspection" ≈ "Re-Inspection", "Pre-theft" ≈ "Pre-Theft".
 */
export function normalizeJobTypeKey(raw: string | null | undefined): string {
  const compact = (raw || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '');
  if (!compact) return '';
  const aliases: Record<string, string> = {
    assessment: 'assessment',
    assessments: 'assessment',
    valuation: 'assessment',
    reinspection: 'reinspection',
    reinspections: 'reinspection',
    reinspect: 'reinspection',
    pretheft: 'pretheft',
    technical: 'technical',
    inspection: 'inspection',
    supplementary: 'supplementary',
  };
  return aliases[compact] || compact;
}

export function parseFormTypeList(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(/[,|]/);
  return list.map((t) => t.trim()).filter(Boolean);
}

export function formTypesMatchAssignment(
  formTypes: string | string[] | null | undefined,
  assignment: string | null | undefined,
): boolean {
  const assignmentKey = normalizeJobTypeKey(assignment);
  if (!assignmentKey) return false;
  return parseFormTypeList(formTypes).some((t) => normalizeJobTypeKey(t) === assignmentKey);
}

export function registrationNumbersMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = normalizeRegNoKey(a);
  const kb = normalizeRegNoKey(b);
  return Boolean(ka) && ka === kb;
}

function isCompletedProduction(status: string | null | undefined): boolean {
  return (status || 'completed') === 'completed';
}

/**
 * When a production job is saved, set matching open datasheets to Report Issued.
 */
export async function issueMatchingDatasheetsFromProduction(
  input: {
    registrationNumber: string | null | undefined;
    assignment: string | null | undefined;
    productionId?: number | null;
    status?: string | null;
  },
  actor: SyncActor,
): Promise<number[]> {
  if (!isCompletedProduction(input.status)) return [];
  const regKey = normalizeRegNoKey(input.registrationNumber);
  const assignmentKey = normalizeJobTypeKey(input.assignment);
  if (!regKey || !assignmentKey) return [];

  const sheets = await listDatasheets({ viewAll: true });
  const matches = sheets.filter(
    (row) =>
      isOpenStatus(row.status) &&
      registrationNumbersMatch(row.reg_no, input.registrationNumber) &&
      formTypesMatchAssignment(row.form_types, input.assignment),
  );

  const issuedIds: number[] = [];
  for (const row of matches) {
    const ok = await markDatasheetReportIssued(row, actor, {
      productionId: input.productionId ?? null,
      registrationNumber: input.registrationNumber || '',
      assignment: input.assignment || '',
    });
    if (ok) issuedIds.push(row.id);
  }
  return issuedIds;
}

/** True if an active production entry already covers this datasheet. */
export async function hasMatchingActiveProduction(
  registrationNumber: string | null | undefined,
  formTypes: string | string[] | null | undefined,
): Promise<boolean> {
  const regKey = normalizeRegNoKey(registrationNumber);
  if (!regKey || parseFormTypeList(formTypes).length === 0) return false;

  const entries = await listProductionEntries({});
  return entries.some(
    (e) =>
      isCompletedProduction(e.status) &&
      registrationNumbersMatch(e.registration_number, registrationNumber) &&
      formTypesMatchAssignment(formTypes, e.assignment),
  );
}

export async function shouldAutoIssueDatasheet(input: {
  status: string | null | undefined;
  registrationNumber: string | null | undefined;
  formTypes: string | string[] | null | undefined;
}): Promise<boolean> {
  try {
    const status = input.status || 'instructed';
    if (isTerminalStatus(status) || !isOpenStatus(status)) return false;
    return await hasMatchingActiveProduction(input.registrationNumber, input.formTypes);
  } catch (err) {
    console.error('Production match check for datasheet auto-issue failed', err);
    return false;
  }
}

async function markDatasheetReportIssued(
  row: Pick<DbDatasheet, 'id' | 'status' | 'serial_no' | 'reg_no'>,
  actor: SyncActor,
  meta: { productionId: number | null; registrationNumber: string; assignment: string },
): Promise<boolean> {
  const from = row.status as DatasheetStatus;
  if (from === 'report_issued' || from === 'closed' || from === 'cancelled') return false;

  await updateDatasheetRecord(row.id, {
    status: 'report_issued',
    updated_by: actor.id,
    reviewed_by: actor.id,
    reviewed_at: new Date().toISOString(),
  });

  await logDatasheetAudit(row.id, actor.id, actor.name, 'status_changed', {
    from,
    to: 'report_issued',
    label: STATUS_LABELS.report_issued,
    autoFromProduction: true,
    productionId: meta.productionId || undefined,
    registrationNumber: meta.registrationNumber,
    assignment: meta.assignment,
  });

  await createNotification({
    type: 'datasheet_report_issued',
    title: 'Datasheet marked Report Issued',
    body: `${row.serial_no} · ${meta.registrationNumber} · ${meta.assignment} (matched production)`,
  });

  return true;
}

import {
  listDatasheets,
  logDatasheetAudit,
  updateDatasheetRecord,
  type DbDatasheet,
  type DbDatasheetListRow,
} from '@/lib/db';
import { extractDenormalizedFields } from '@/lib/extractFields';
import { listProductionEntries, createNotification, type DbProductionEntry } from '@/lib/productionDb';
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
  let compact = (raw || '')
    .toLowerCase()
    .replace(/[\s._-]+/g, '')
    .replace(/reports?$/, '');
  if (!compact) return '';
  const aliases: Record<string, string> = {
    assessment: 'assessment',
    assessments: 'assessment',
    valuation: 'assessment',
    motorassessment: 'assessment',
    reinspection: 'reinspection',
    reinspections: 'reinspection',
    reinspect: 'reinspection',
    pretheft: 'pretheft',
    technical: 'technical',
    inspection: 'inspection',
    supplementary: 'supplementary',
    supplement: 'supplementary',
  };
  if (aliases[compact]) return aliases[compact];
  const ordered = [
    'reinspection',
    'pretheft',
    'supplementary',
    'assessment',
    'technical',
    'inspection',
  ];
  return ordered.find((k) => compact.includes(k)) || compact;
}

export function parseFormTypeList(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,|]/);
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

function isUsableProduction(status: string | null | undefined): boolean {
  return (status || 'completed') !== 'cancelled';
}

function datasheetMatchFields(row: Pick<DbDatasheet, 'form_data' | 'reg_no' | 'form_types' | 'serial_no'>) {
  const denorm = extractDenormalizedFields(row.form_data, row.serial_no);
  const formTypes = denorm.form_types || row.form_types || null;
  const regNo = denorm.reg_no || row.reg_no || null;
  return { regNo, formTypes };
}

function productionIndex(entries: DbProductionEntry[]) {
  const byKey = new Map<string, DbProductionEntry[]>();
  for (const e of entries) {
    if (!isUsableProduction(e.status)) continue;
    const regKey = normalizeRegNoKey(e.registration_number);
    const typeKey = normalizeJobTypeKey(e.assignment);
    if (!regKey || !typeKey) continue;
    const key = `${regKey}::${typeKey}`;
    const list = byKey.get(key) || [];
    list.push(e);
    byKey.set(key, list);
  }
  return byKey;
}

function matchingProduction(
  index: Map<string, DbProductionEntry[]>,
  regNo: string | null,
  formTypes: string | string[] | null,
): DbProductionEntry | null {
  const regKey = normalizeRegNoKey(regNo);
  if (!regKey) return null;
  for (const type of parseFormTypeList(formTypes)) {
    const typeKey = normalizeJobTypeKey(type);
    if (!typeKey) continue;
    const hits = index.get(`${regKey}::${typeKey}`);
    if (hits?.length) return hits[0];
  }
  return null;
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
  if (!isUsableProduction(input.status)) return [];
  const regKey = normalizeRegNoKey(input.registrationNumber);
  const assignmentKey = normalizeJobTypeKey(input.assignment);
  if (!regKey || !assignmentKey) return [];

  const sheets = await listDatasheets({ viewAll: true });
  const matches = sheets.filter((row) => {
    if (!isOpenStatus(row.status)) return false;
    const { regNo, formTypes } = datasheetMatchFields(row);
    return (
      registrationNumbersMatch(regNo, input.registrationNumber) &&
      formTypesMatchAssignment(formTypes, input.assignment)
    );
  });

  const issuedIds: number[] = [];
  for (const row of matches) {
    const ok = await markDatasheetReportIssued(row, actor, {
      productionId: input.productionId ?? null,
      registrationNumber: input.registrationNumber || '',
      assignment: input.assignment || '',
      notify: true,
    });
    if (ok) issuedIds.push(row.id);
  }
  return issuedIds;
}

/**
 * Apply Report Issued to every open datasheet that already has a matching
 * production job. Used when the datasheet module loads so existing work is updated.
 */
export async function applyProductionIssuedToDatasheets<T extends DbDatasheetListRow>(
  sheets: T[],
  actor: SyncActor,
): Promise<T[]> {
  const open = sheets.filter((row) => isOpenStatus(row.status));
  if (!open.length) return sheets;

  const entries = await listProductionEntries({});
  const index = productionIndex(entries);
  if (!index.size) return sheets;

  const issued = new Set<number>();
  for (const row of open) {
    const { regNo, formTypes } = datasheetMatchFields(row);
    const prod = matchingProduction(index, regNo, formTypes);
    if (!prod) continue;
    const ok = await markDatasheetReportIssued(row, actor, {
      productionId: prod.id,
      registrationNumber: prod.registration_number,
      assignment: prod.assignment || '',
      notify: false,
    });
    if (ok) issued.add(row.id);
  }

  if (!issued.size) return sheets;

  return sheets.map((row) =>
    issued.has(row.id)
      ? {
          ...row,
          status: 'report_issued' as DatasheetStatus,
          updated_by: actor.id,
          reviewed_by: actor.id,
        }
      : row,
  );
}

/** True if an active production entry already covers this datasheet. */
export async function hasMatchingActiveProduction(
  registrationNumber: string | null | undefined,
  formTypes: string | string[] | null | undefined,
): Promise<boolean> {
  const regKey = normalizeRegNoKey(registrationNumber);
  if (!regKey || parseFormTypeList(formTypes).length === 0) return false;

  const entries = await listProductionEntries({});
  const index = productionIndex(entries);
  return Boolean(matchingProduction(index, registrationNumber || null, formTypes || null));
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
  meta: {
    productionId: number | null;
    registrationNumber: string;
    assignment: string;
    notify: boolean;
  },
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

  if (meta.notify) {
    await createNotification({
      type: 'datasheet_report_issued',
      title: 'Datasheet marked Report Issued',
      body: `${row.serial_no} · ${meta.registrationNumber} · ${meta.assignment} (matched production)`,
    });
  }

  return true;
}

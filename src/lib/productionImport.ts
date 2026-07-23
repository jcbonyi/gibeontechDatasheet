import ExcelJS from 'exceljs';
import { normalizeAssignment, normalizePaidStatus, type PaidStatus } from '@/lib/productionConfig';
import type { ProductionEntryInput } from '@/lib/productionDb';

export interface ParsedProductionRow {
  rowNumber: number;
  sheetName: string;
  production_date: string;
  insurer_name: string;
  registration_number: string;
  assignment: string | null;
  amount: number;
  amount_without_vat?: number;
  done_by_name: string | null;
  seen_by_name: string | null;
  instructed_by_name: string | null;
  fee_note_no: string | null;
  insured: string | null;
  claim_policy_number: string | null;
  paid_status: PaidStatus;
}

export interface ProductionImportParseResult {
  rows: ParsedProductionRow[];
  errors: { row: number; sheet?: string; message: string }[];
  sheetsImported: string[];
  sheetsSkipped: { name: string; reason: string }[];
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedProductionRow, 'rowNumber' | 'sheetName'>> = {
  date: 'production_date',
  production_date: 'production_date',
  insurer: 'insurer_name',
  insurer_name: 'insurer_name',
  'reg no': 'registration_number',
  regno: 'registration_number',
  'reg. no': 'registration_number',
  'reg. no.': 'registration_number',
  registration: 'registration_number',
  'registration number': 'registration_number',
  'registration no': 'registration_number',
  assignment: 'assignment',
  amount: 'amount',
  'without vat': 'amount_without_vat',
  withoutvat: 'amount_without_vat',
  'amount without vat': 'amount_without_vat',
  'done by': 'done_by_name',
  doneby: 'done_by_name',
  done_by: 'done_by_name',
  'seen by': 'seen_by_name',
  seenby: 'seen_by_name',
  seen_by: 'seen_by_name',
  'instructed by': 'instructed_by_name',
  instructedby: 'instructed_by_name',
  instructed_by: 'instructed_by_name',
  'fee note no': 'fee_note_no',
  'fee note no.': 'fee_note_no',
  'fee note': 'fee_note_no',
  feenoteno: 'fee_note_no',
  fee_note_no: 'fee_note_no',
  insured: 'insured',
  'claim policy number': 'claim_policy_number',
  'claim/policy number': 'claim_policy_number',
  'claim / policy number': 'claim_policy_number',
  'claim number': 'claim_policy_number',
  'policy number': 'claim_policy_number',
  claim_policy_number: 'claim_policy_number',
  paid: 'paid_status',
  'paid status': 'paid_status',
  paid_status: 'paid_status',
};

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function normHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function ymd(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += 2000;
  if (year < 1990 || year > 2100) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return formatDateUtc(value);
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const parts = (value as { richText: { text: string }[] }).richText;
    return parts.map((p) => p.text).join('').trim();
  }
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: string }).text || '').trim();
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return cellText((value as { result: unknown }).result);
  }
  return String(value).trim();
}

function formatDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function excelSerialToDate(serial: number): string | null {
  // Excel epoch (with 1900 leap bug): days since 1899-12-30
  if (!Number.isFinite(serial) || serial < 1) return null;
  // Ignore time-of-day fraction; keep calendar day stable across timezones
  const whole = Math.floor(serial);
  const utc = Date.UTC(1899, 11, 30) + whole * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateUtc(d);
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Prefer UTC calendar parts (ExcelJS date-only cells are UTC midnight).
    // If the Date was constructed in local time (non-midnight UTC), use local parts.
    const utcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0;
    if (utcMidnight) return formatDateUtc(value);
    return ymd(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === 'number') return excelSerialToDate(value);
  const text = cellText(value);
  if (!text) return null;

  // DD/MM/YYYY or DD-MM-YYYY (Kenya / common Excel exports)
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    // If second part > 12, it must be day → treat as MM/DD
    if (b > 12 && a <= 12) {
      const md = ymd(year, a, b);
      if (md) return md;
    }
    // Prefer DD/MM when day > 12 or ambiguous
    const asDmy = ymd(year, b, a);
    if (asDmy) return asDmy;
    const asMdy = ymd(year, a, b);
    if (asMdy) return asMdy;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  // 01-Jul-2026 / 1 July 2026 / Jul 1, 2026
  const named = text.match(
    /^(\d{1,2})[\/\-\s]+([A-Za-z]{3,9})[\/\-\s,]+(\d{2,4})$|^([A-Za-z]{3,9})[\/\-\s,]+(\d{1,2})(?:st|nd|rd|th)?[\/\-\s,]+(\d{2,4})$/,
  );
  if (named) {
    if (named[1] && named[2] && named[3]) {
      const month = MONTH_NAMES[named[2].toLowerCase()];
      if (month) return ymd(Number(named[3]), month, Number(named[1]));
    }
    if (named[4] && named[5] && named[6]) {
      const month = MONTH_NAMES[named[4].toLowerCase()];
      if (month) return ymd(Number(named[6]), month, Number(named[5]));
    }
  }

  return null;
}

function parseDateFromCell(cell: ExcelJS.Cell): string | null {
  // Prefer formatted display text (matches what users see in Excel)
  const displayed = String(cell.text || '').trim();
  if (displayed) {
    const fromText = parseDate(displayed);
    if (fromText) return fromText;
  }
  return parseDate(cell.value);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

type FieldKey = keyof Omit<ParsedProductionRow, 'rowNumber' | 'sheetName'>;

function mapHeaderRow(row: ExcelJS.Row): Map<number, FieldKey> {
  const colMap = new Map<number, FieldKey>();
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_ALIASES[normHeader(cell.value)] || HEADER_ALIASES[normHeader(cell.text)];
    if (key) colMap.set(colNumber, key);
  });
  return colMap;
}

function hasRequiredColumns(colMap: Map<number, FieldKey>): boolean {
  const mapped = new Set(colMap.values());
  return (
    mapped.has('production_date') &&
    mapped.has('insurer_name') &&
    mapped.has('registration_number') &&
    mapped.has('amount')
  );
}

function findHeader(sheet: ExcelJS.Worksheet): { rowNumber: number; colMap: Map<number, FieldKey> } | null {
  const last = Math.min(sheet.actualRowCount || sheet.rowCount || 20, 20);
  for (let r = 1; r <= last; r++) {
    const colMap = mapHeaderRow(sheet.getRow(r));
    if (hasRequiredColumns(colMap)) return { rowNumber: r, colMap };
  }
  return null;
}

function parseSheet(
  sheet: ExcelJS.Worksheet,
): { rows: ParsedProductionRow[]; errors: ProductionImportParseResult['errors'] } | null {
  const header = findHeader(sheet);
  if (!header) return null;

  const { rowNumber: headerRow, colMap } = header;
  const rows: ParsedProductionRow[] = [];
  const errors: ProductionImportParseResult['errors'] = [];
  const sheetName = sheet.name || 'Sheet';

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    const raw: Partial<ParsedProductionRow> = { rowNumber, sheetName };
    colMap.forEach((field, col) => {
      const cell = row.getCell(col);
      const value = cell.value;
      if (field === 'production_date') {
        raw.production_date = parseDateFromCell(cell) || undefined;
      } else if (field === 'amount' || field === 'amount_without_vat') {
        const n = parseAmount(value);
        if (n != null) raw[field] = n;
      } else if (field === 'registration_number') {
        raw.registration_number = cellText(value).toUpperCase();
      } else if (field === 'insurer_name') {
        raw.insurer_name = cellText(value);
      } else if (field === 'paid_status') {
        raw.paid_status = normalizePaidStatus(cellText(value));
      } else {
        const name = cellText(value);
        raw[field] = name || null;
      }
    });

    if (
      !raw.production_date &&
      !raw.insurer_name &&
      !raw.registration_number &&
      raw.amount == null
    ) {
      return;
    }

    if (!raw.production_date) {
      errors.push({
        row: rowNumber,
        sheet: sheetName,
        message: 'Invalid or missing DATE',
      });
      return;
    }
    if (!raw.insurer_name) {
      errors.push({ row: rowNumber, sheet: sheetName, message: 'Missing INSURER' });
      return;
    }
    if (!raw.registration_number) {
      errors.push({ row: rowNumber, sheet: sheetName, message: 'Missing REG NO' });
      return;
    }
    if (raw.amount == null || raw.amount < 0) {
      errors.push({ row: rowNumber, sheet: sheetName, message: 'Invalid AMOUNT' });
      return;
    }

    const assignment = raw.assignment
      ? normalizeAssignment(raw.assignment)
      : null;

    rows.push({
      rowNumber,
      sheetName,
      production_date: raw.production_date,
      insurer_name: raw.insurer_name,
      registration_number: raw.registration_number,
      assignment,
      amount: raw.amount,
      amount_without_vat: raw.amount_without_vat,
      done_by_name: raw.done_by_name ?? null,
      seen_by_name: raw.seen_by_name ?? null,
      instructed_by_name: raw.instructed_by_name ?? null,
      fee_note_no: raw.fee_note_no ?? null,
      insured: raw.insured ?? null,
      claim_policy_number: raw.claim_policy_number ?? null,
      paid_status: normalizePaidStatus(raw.paid_status),
    });
  });

  return { rows, errors };
}

export async function parseProductionWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ProductionImportParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  if (!wb.worksheets.length) {
    return {
      rows: [],
      errors: [{ row: 0, message: 'Workbook has no sheets' }],
      sheetsImported: [],
      sheetsSkipped: [],
    };
  }

  const rows: ParsedProductionRow[] = [];
  const errors: ProductionImportParseResult['errors'] = [];
  const sheetsImported: string[] = [];
  const sheetsSkipped: { name: string; reason: string }[] = [];

  for (const sheet of wb.worksheets) {
    // Skip obviously empty / hidden helper sheets
    if (sheet.state === 'hidden' || sheet.state === 'veryHidden') {
      sheetsSkipped.push({ name: sheet.name, reason: 'Hidden sheet' });
      continue;
    }
    const parsed = parseSheet(sheet);
    if (!parsed) {
      sheetsSkipped.push({
        name: sheet.name,
        reason:
          'No header row with DATE, INSURER, REG NO, AMOUNT (checked first 20 rows)',
      });
      continue;
    }
    sheetsImported.push(sheet.name);
    rows.push(...parsed.rows);
    errors.push(...parsed.errors);
  }

  if (!sheetsImported.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message:
            'No usable sheets found. Each sheet needs headers like DATE, INSURER, REG NO, AMOUNT (WITH/ WITHOUT VAT, DONE BY, SEEN BY, INSTRUCTED BY optional).',
        },
        ...sheetsSkipped.map((s) => ({
          row: 0,
          sheet: s.name,
          message: `Skipped "${s.name}": ${s.reason}`,
        })),
      ],
      sheetsImported: [],
      sheetsSkipped,
    };
  }

  return { rows, errors, sheetsImported, sheetsSkipped };
}

export function buildImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Production');
  ws.addRow([
    'DATE',
    'INSURER',
    'REG NO',
    'ASSIGNMENT',
    'AMOUNT',
    'WITHOUT VAT',
    'DONE BY',
    'SEEN BY',
    'INSTRUCTED BY',
    'FEE NOTE NO',
    'INSURED',
    'CLAIM/POLICY NUMBER',
    'PAID',
  ]);
  ws.getRow(1).font = { bold: true };
  ws.addRow([
    '2026-07-01',
    'Sample Insurer',
    'KAA 123A',
    'Assessment',
    11600,
    10000,
    'Jane Assessor',
    'John Manager',
    'Insurer Desk',
    'FN-001',
    'John Doe',
    'CLM/2026/001',
    'Unpaid',
  ]);
  ws.columns.forEach((c) => {
    c.width = 16;
  });
  return wb.xlsx.writeBuffer().then((buf) => Buffer.from(buf));
}

export type ResolvedStaff = { id: number; name: string };

export function matchUserId(
  name: string | null | undefined,
  staff: ResolvedStaff[],
): { id: number | null; warning?: string } {
  if (!name?.trim()) return { id: null };
  const needle = name.trim().toLowerCase();
  const exact = staff.find((s) => s.name.trim().toLowerCase() === needle);
  if (exact) return { id: exact.id };
  const partial = staff.filter(
    (s) =>
      s.name.trim().toLowerCase().includes(needle) ||
      needle.includes(s.name.trim().toLowerCase()),
  );
  if (partial.length === 1) return { id: partial[0].id };
  return {
    id: null,
    warning: `Could not match staff "${name}"`,
  };
}

export function toEntryInput(
  row: ParsedProductionRow,
  insurerId: number,
  doneBy: number | null,
  seenBy: number | null,
): ProductionEntryInput {
  return {
    production_date: row.production_date,
    insurer_id: insurerId,
    registration_number: row.registration_number,
    assignment: row.assignment,
    amount: row.amount,
    amount_without_vat: row.amount_without_vat ?? 0,
    done_by_user_id: doneBy,
    seen_by_user_id: seenBy,
    instructed_by: row.instructed_by_name?.trim() || null,
    instructed_by_user_id: null,
    fee_note_no: row.fee_note_no,
    insured: row.insured,
    claim_policy_number: row.claim_policy_number,
    paid_status: row.paid_status,
    remarks: null,
    status: 'completed',
  };
}

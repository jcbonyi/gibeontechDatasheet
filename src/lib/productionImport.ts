import ExcelJS from 'exceljs';
import { amountWithoutVat, normalizeAssignment } from '@/lib/productionConfig';
import type { ProductionEntryInput } from '@/lib/productionDb';

export interface ParsedProductionRow {
  rowNumber: number;
  production_date: string;
  insurer_name: string;
  registration_number: string;
  assignment: string | null;
  amount: number;
  amount_without_vat?: number;
  done_by_name: string | null;
  seen_by_name: string | null;
  instructed_by_name: string | null;
}

export interface ProductionImportParseResult {
  rows: ParsedProductionRow[];
  errors: { row: number; message: string }[];
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedProductionRow, 'rowNumber'>> = {
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
  'done_by': 'done_by_name',
  'seen by': 'seen_by_name',
  seenby: 'seen_by_name',
  'seen_by': 'seen_by_name',
  'instructed by': 'instructed_by_name',
  instructedby: 'instructed_by_name',
  'instructed_by': 'instructed_by_name',
};

function normHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function cellText(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: string }).text || '').trim();
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return cellText((value as { result: unknown }).result);
  }
  return String(value).trim();
}

function excelSerialToDate(serial: number): string | null {
  // Excel epoch (with 1900 leap bug): days since 1899-12-30
  if (!Number.isFinite(serial) || serial < 1) return null;
  const utc = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') return excelSerialToDate(value);
  const text = cellText(value);
  if (!text) return null;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      d.getUTCFullYear() === year &&
      d.getUTCMonth() === month - 1 &&
      d.getUTCDate() === day
    ) {
      return d.toISOString().slice(0, 10);
    }
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = cellText(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export async function parseProductionWorkbook(
  buffer: ArrayBuffer | Buffer,
): Promise<ProductionImportParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return { rows: [], errors: [{ row: 0, message: 'Workbook has no sheets' }] };
  }

  const headerRow = sheet.getRow(1);
  const colMap = new Map<number, keyof Omit<ParsedProductionRow, 'rowNumber'>>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = HEADER_ALIASES[normHeader(cell.value)];
    if (key) colMap.set(colNumber, key);
  });

  const required: (keyof Omit<ParsedProductionRow, 'rowNumber'>)[] = [
    'production_date',
    'insurer_name',
    'registration_number',
    'amount',
  ];
  const mapped = new Set(colMap.values());
  const missing = required.filter((r) => !mapped.has(r));
  if (missing.length) {
    return {
      rows: [],
      errors: [
        {
          row: 1,
          message: `Missing required columns: ${missing.join(', ')}. Expected headers like DATE, INSURER, REG NO, AMOUNT, WITHOUT VAT, DONE BY, SEEN BY, INSTRUCTED BY.`,
        },
      ],
    };
  }

  const rows: ParsedProductionRow[] = [];
  const errors: { row: number; message: string }[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: Partial<ParsedProductionRow> = { rowNumber };
    colMap.forEach((field, col) => {
      const value = row.getCell(col).value;
      if (field === 'production_date') {
        raw.production_date = parseDate(value) || undefined;
      } else if (field === 'amount' || field === 'amount_without_vat') {
        const n = parseAmount(value);
        if (n != null) raw[field] = n;
      } else if (field === 'registration_number') {
        raw.registration_number = cellText(value).toUpperCase();
      } else if (field === 'insurer_name') {
        raw.insurer_name = cellText(value);
      } else {
        const name = cellText(value);
        raw[field] = name || null;
      }
    });

    // Skip fully empty data rows
    if (
      !raw.production_date &&
      !raw.insurer_name &&
      !raw.registration_number &&
      raw.amount == null
    ) {
      return;
    }

    if (!raw.production_date) {
      errors.push({ row: rowNumber, message: 'Invalid or missing DATE' });
      return;
    }
    if (!raw.insurer_name) {
      errors.push({ row: rowNumber, message: 'Missing INSURER' });
      return;
    }
    if (!raw.registration_number) {
      errors.push({ row: rowNumber, message: 'Missing REG NO' });
      return;
    }
    if (raw.amount == null || raw.amount < 0) {
      errors.push({ row: rowNumber, message: 'Invalid AMOUNT' });
      return;
    }

    const assignment = raw.assignment ? normalizeAssignment(raw.assignment) : null;
    if (raw.assignment && String(raw.assignment).trim() && !assignment) {
      errors.push({
        row: rowNumber,
        message:
          'ASSIGNMENT must be Assessment, Re-Inspection, Pre-Theft, or Technical',
      });
      return;
    }

    rows.push({
      rowNumber,
      production_date: raw.production_date,
      insurer_name: raw.insurer_name,
      registration_number: raw.registration_number,
      assignment,
      amount: raw.amount,
      amount_without_vat: raw.amount_without_vat,
      done_by_name: raw.done_by_name ?? null,
      seen_by_name: raw.seen_by_name ?? null,
      instructed_by_name: raw.instructed_by_name ?? null,
    });
  });

  return { rows, errors };
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
  ]);
  ws.getRow(1).font = { bold: true };
  ws.addRow([
    '2026-07-01',
    'Sample Insurer',
    'KAA 123A',
    'Assessment',
    11600,
    amountWithoutVat(11600),
    'Jane Assessor',
    'John Manager',
    'Insurer Desk',
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
  instructedBy: number | null,
): ProductionEntryInput {
  return {
    production_date: row.production_date,
    insurer_id: insurerId,
    registration_number: row.registration_number,
    assignment: row.assignment,
    amount: row.amount,
    done_by_user_id: doneBy,
    seen_by_user_id: seenBy,
    instructed_by_user_id: instructedBy,
    remarks: null,
    status: 'completed',
  };
}

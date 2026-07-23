/**
 * Production Management defaults (locked for v1):
 * - Same JWT login as Assessment Tracker
 * - VAT-inclusive amounts; without VAT = amount / (1 + VAT_RATE)
 * - Done By / Seen By / Instructed By = existing users
 * - Role map: Admin=Administrator, PO/Ops=Manager, Assessor=Staff
 */

export const VAT_RATE = 0.16;

export const PRODUCTION_STATUSES = ['pending', 'completed', 'cancelled'] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ASSIGNMENT_TYPES = [
  'Assessment',
  'Re-Inspection',
  'Pre-Theft',
  'Technical',
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

/**
 * Normalize assignment text. Known aliases map to standard types;
 * any other non-empty value is kept as free text (import-friendly).
 */
export function normalizeAssignment(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).replace(/\u00a0/g, ' ').trim();
  if (!raw) return null;

  const exact = ASSIGNMENT_TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, AssignmentType> = {
    assessment: 'Assessment',
    assessments: 'Assessment',
    reinspection: 'Re-Inspection',
    reinspections: 'Re-Inspection',
    reinspect: 'Re-Inspection',
    're-inspection': 'Re-Inspection',
    pretheft: 'Pre-Theft',
    'pre-theft': 'Pre-Theft',
    technical: 'Technical',
    valuation: 'Assessment',
  };
  if (aliases[compact]) return aliases[compact];

  return raw;
}

export function isAssignmentType(value: string): value is AssignmentType {
  return (ASSIGNMENT_TYPES as readonly string[]).includes(value);
}

export function amountWithoutVat(amount: number, vatRate = VAT_RATE): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const net = amount / (1 + vatRate);
  return Math.round(net * 100) / 100;
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const DISPLAY_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Display dates as dd-mmm-yyyy (e.g. 23-Jul-2026). Safe for client + server. */
export function formatDisplayDate(value: string | null | undefined): string {
  const s = String(value || '').slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || '—';
  const month = DISPLAY_MONTHS[Number(m[2]) - 1];
  if (!month) return s;
  return `${m[3]}-${month}-${m[1]}`;
}

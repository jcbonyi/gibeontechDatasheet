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

/** Normalize free text / Excel values to a known assignment type. */
export function normalizeAssignment(value: unknown): AssignmentType | null {
  if (value == null) return null;
  const raw = String(value).replace(/\u00a0/g, ' ').trim();
  if (!raw) return null;

  const exact = ASSIGNMENT_TYPES.find((t) => t.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  const aliases: Record<string, AssignmentType> = {
    assessment: 'Assessment',
    reinspection: 'Re-Inspection',
    reinspections: 'Re-Inspection',
    reinspect: 'Re-Inspection',
    pretheft: 'Pre-Theft',
    technical: 'Technical',
  };
  return aliases[compact] || null;
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

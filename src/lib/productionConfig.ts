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

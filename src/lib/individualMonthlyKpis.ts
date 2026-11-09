import { normalizeNameKey } from '@/lib/nameNormalize';
import { formatMoney } from '@/lib/productionConfig';

/** Monthly personal KPIs for Assessment Tracker staff (Seen By count + Done By value). */
export type IndividualMonthlyKpiTarget = {
  /** Stable id / primary match token (lowercase first name). */
  key: string;
  label: string;
  /** Extra name fragments that map to this person (optional). */
  aliases?: string[];
  /** Instructions attended (production Seen By). Null = not tracked for this person. */
  targetSeen: number | null;
  /** Production Done By total value for the calendar month. */
  targetAmount: number;
};

export const INDIVIDUAL_MONTHLY_KPI_TARGETS: IndividualMonthlyKpiTarget[] = [
  { key: 'kelvin', label: 'Kelvin', targetSeen: null, targetAmount: 350_000 },
  { key: 'mjomba', label: 'Mjomba', targetSeen: null, targetAmount: 350_000 },
  {
    key: 'sam',
    label: 'Sam',
    aliases: ['samuel', 'samson', 'omondi', 'samson omondi'],
    targetSeen: null,
    targetAmount: 330_000,
  },
  { key: 'rahab', label: 'Rahab', targetSeen: null, targetAmount: 300_000 },
  { key: 'mungai', label: 'Mungai', targetSeen: null, targetAmount: 450_000 },
  { key: 'victor', label: 'Victor', targetSeen: 52, targetAmount: 190_000 },
  { key: 'edwin', label: 'Edwin', targetSeen: 105, targetAmount: 150_000 },
  { key: 'dennis', label: 'Dennis', targetSeen: null, targetAmount: 300_000 },
  { key: 'joel', label: 'Joel', targetSeen: 155, targetAmount: 50_000 },
];

export type ProductionKpiRow = {
  status?: string | null;
  amount?: number | null;
  done_by_name?: string | null;
  seen_by_name?: string | null;
  done_by_user_id?: number | null;
  seen_by_user_id?: number | null;
};

export type IndividualMonthlyKpiResult = {
  key: string;
  label: string;
  targetSeen: number | null;
  targetAmount: number;
  seenJobs: number;
  doneAmount: number;
  seenPct: number | null;
  amountPct: number | null;
  seenMet: boolean | null;
  amountMet: boolean;
};

function matchTokens(target: IndividualMonthlyKpiTarget): string[] {
  return [target.key, target.label, ...(target.aliases || [])]
    .map((t) => normalizeNameKey(t))
    .filter(Boolean);
}

/** True when a display name belongs to the KPI person (first-name / alias aware). */
export function nameMatchesKpiPerson(
  name: string | null | undefined,
  target: IndividualMonthlyKpiTarget,
): boolean {
  const n = normalizeNameKey(name);
  if (!n) return false;
  return matchTokens(target).some((token) => {
    if (n === token) return true;
    if (n.startsWith(`${token} `)) return true;
    if (n.endsWith(` ${token}`)) return true;
    return n.includes(` ${token} `);
  });
}

export function findKpiTargetForName(
  name: string | null | undefined,
): IndividualMonthlyKpiTarget | null {
  if (!name?.trim()) return null;
  return INDIVIDUAL_MONTHLY_KPI_TARGETS.find((t) => nameMatchesKpiPerson(name, t)) || null;
}

function pctOf(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

export function computeIndividualMonthlyKpi(
  target: IndividualMonthlyKpiTarget,
  rows: ProductionKpiRow[],
  opts?: { userId?: number | null },
): IndividualMonthlyKpiResult {
  const userId = opts?.userId ?? null;
  let seenJobs = 0;
  let doneAmount = 0;

  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    const amount = Number(r.amount) || 0;

    const seenMatch =
      (userId != null && r.seen_by_user_id === userId) ||
      nameMatchesKpiPerson(r.seen_by_name, target);
    if (seenMatch) seenJobs += 1;

    const doneMatch =
      (userId != null && r.done_by_user_id === userId) ||
      nameMatchesKpiPerson(r.done_by_name, target);
    if (doneMatch) doneAmount += amount;
  }

  doneAmount = Math.round(doneAmount * 100) / 100;
  const seenPct = target.targetSeen != null ? pctOf(seenJobs, target.targetSeen) : null;
  const amountPct = pctOf(doneAmount, target.targetAmount);

  return {
    key: target.key,
    label: target.label,
    targetSeen: target.targetSeen,
    targetAmount: target.targetAmount,
    seenJobs,
    doneAmount,
    seenPct,
    amountPct,
    seenMet: target.targetSeen != null ? seenJobs >= target.targetSeen : null,
    amountMet: doneAmount >= target.targetAmount,
  };
}

export function computeAllIndividualMonthlyKpis(
  rows: ProductionKpiRow[],
): IndividualMonthlyKpiResult[] {
  return INDIVIDUAL_MONTHLY_KPI_TARGETS.map((t) => computeIndividualMonthlyKpi(t, rows));
}

export function formatKpiAmount(n: number): string {
  return formatMoney(n);
}

export function calendarMonthRange(asOf = new Date()): { fromDate: string; toDate: string; label: string } {
  const y = asOf.getFullYear();
  const m = asOf.getMonth();
  const fromDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const toDate = [
    y,
    String(m + 1).padStart(2, '0'),
    String(asOf.getDate()).padStart(2, '0'),
  ].join('-');
  const label = asOf.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { fromDate, toDate, label };
}

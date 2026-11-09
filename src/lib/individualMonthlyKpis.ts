import { normalizeNameKey } from '@/lib/nameNormalize';
import { formatMoney } from '@/lib/productionConfig';
import { isOpenStatus } from '@/lib/status';

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

export type PendingJobRow = {
  status?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
};

export type IndividualMonthlyKpiResult = {
  key: string;
  label: string;
  targetSeen: number | null;
  targetAmount: number;
  seenJobs: number;
  doneAmount: number;
  pendingJobs: number;
  seenPct: number | null;
  amountPct: number | null;
  seenMet: boolean | null;
  amountMet: boolean;
};

export type TeamOverallKpi = {
  targetSeen: number;
  seenJobs: number;
  seenPct: number | null;
  targetAmount: number;
  doneAmount: number;
  amountPct: number;
  pendingJobs: number;
  peopleOnSeenTarget: number;
  peopleOnAmountTarget: number;
  peopleCount: number;
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

export function findKpiTargetByKey(key: string): IndividualMonthlyKpiTarget | null {
  return INDIVIDUAL_MONTHLY_KPI_TARGETS.find((t) => t.key === key) || null;
}

function pctOf(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

function countPendingForTarget(
  target: IndividualMonthlyKpiTarget,
  pendingRows: PendingJobRow[],
  userId?: number | null,
): number {
  let n = 0;
  for (const r of pendingRows) {
    if (!isOpenStatus(String(r.status || ''))) continue;
    if (userId != null && r.assigned_to === userId) {
      n += 1;
      continue;
    }
    if (nameMatchesKpiPerson(r.assigned_to_name, target)) n += 1;
  }
  return n;
}

export function computeIndividualMonthlyKpi(
  target: IndividualMonthlyKpiTarget,
  rows: ProductionKpiRow[],
  opts?: { userId?: number | null; pendingRows?: PendingJobRow[] },
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
  const pendingJobs = countPendingForTarget(target, opts?.pendingRows || [], userId);
  const seenPct = target.targetSeen != null ? pctOf(seenJobs, target.targetSeen) : null;
  const amountPct = pctOf(doneAmount, target.targetAmount);

  return {
    key: target.key,
    label: target.label,
    targetSeen: target.targetSeen,
    targetAmount: target.targetAmount,
    seenJobs,
    doneAmount,
    pendingJobs,
    seenPct,
    amountPct,
    seenMet: target.targetSeen != null ? seenJobs >= target.targetSeen : null,
    amountMet: doneAmount >= target.targetAmount,
  };
}

export function computeAllIndividualMonthlyKpis(
  rows: ProductionKpiRow[],
  pendingRows: PendingJobRow[] = [],
): IndividualMonthlyKpiResult[] {
  return INDIVIDUAL_MONTHLY_KPI_TARGETS.map((t) =>
    computeIndividualMonthlyKpi(t, rows, { pendingRows }),
  );
}

/** Cumulative team performance vs sum of individual targets. */
export function computeTeamOverallKpi(team: IndividualMonthlyKpiResult[]): TeamOverallKpi {
  let targetSeen = 0;
  let seenJobs = 0;
  let targetAmount = 0;
  let doneAmount = 0;
  let pendingJobs = 0;
  let peopleOnSeenTarget = 0;
  let peopleOnAmountTarget = 0;
  let peopleWithSeenTarget = 0;

  for (const p of team) {
    targetAmount += p.targetAmount;
    doneAmount += p.doneAmount;
    pendingJobs += p.pendingJobs;
    if (p.amountMet) peopleOnAmountTarget += 1;
    if (p.targetSeen != null) {
      peopleWithSeenTarget += 1;
      targetSeen += p.targetSeen;
      seenJobs += p.seenJobs;
      if (p.seenMet) peopleOnSeenTarget += 1;
    }
  }

  return {
    targetSeen,
    seenJobs,
    seenPct: peopleWithSeenTarget > 0 ? pctOf(seenJobs, targetSeen) : null,
    targetAmount: Math.round(targetAmount * 100) / 100,
    doneAmount: Math.round(doneAmount * 100) / 100,
    amountPct: pctOf(doneAmount, targetAmount),
    pendingJobs,
    peopleOnSeenTarget,
    peopleOnAmountTarget,
    peopleCount: team.length,
  };
}

export function formatKpiAmount(n: number): string {
  return formatMoney(n);
}

function isoDay(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function lastDayOfMonth(y: number, m0: number): Date {
  return new Date(y, m0 + 1, 0);
}

/** Resolve a YYYY-MM period (or current month) to inclusive dates. */
export function resolveKpiMonthRange(
  periodKey?: string | null,
  asOf = new Date(),
): { periodKey: string; fromDate: string; toDate: string; label: string; isCurrent: boolean } {
  const now = asOf;
  let y = now.getFullYear();
  let m0 = now.getMonth();

  if (periodKey && /^\d{4}-\d{2}$/.test(periodKey)) {
    y = Number(periodKey.slice(0, 4));
    m0 = Number(periodKey.slice(5, 7)) - 1;
  }

  const periodKeyOut = `${y}-${String(m0 + 1).padStart(2, '0')}`;
  const fromDate = `${periodKeyOut}-01`;
  const isCurrent = y === now.getFullYear() && m0 === now.getMonth();
  const end = isCurrent ? now : lastDayOfMonth(y, m0);
  const toDate = isoDay(end);
  const label = new Date(y, m0, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  return { periodKey: periodKeyOut, fromDate, toDate, label, isCurrent };
}

export function listKpiPeriodOptions(
  count = 12,
  asOf = new Date(),
): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    out.push({ key, label: i === 0 ? `${label} (current)` : label });
  }
  return out;
}

/** @deprecated use resolveKpiMonthRange */
export function calendarMonthRange(asOf = new Date()) {
  const r = resolveKpiMonthRange(undefined, asOf);
  return { fromDate: r.fromDate, toDate: r.toDate, label: r.label };
}

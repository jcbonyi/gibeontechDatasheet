import type { DbProductionEntry, DbProductionTarget } from '@/lib/productionDb';
import { formatMoney } from '@/lib/productionConfig';

function dateOnly(v: string): string {
  return v.slice(0, 10);
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sum(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function groupCountAmount(
  rows: DbProductionEntry[],
  keyFn: (r: DbProductionEntry) => string,
): { name: string; jobs: number; amount: number; withoutVat: number }[] {
  const map = new Map<string, { jobs: number; amount: number; withoutVat: number }>();
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    const key = keyFn(r) || 'Unknown';
    const cur = map.get(key) || { jobs: 0, amount: 0, withoutVat: 0 };
    cur.jobs += 1;
    cur.amount += Number(r.amount) || 0;
    cur.withoutVat += Number(r.amount_without_vat) || 0;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      jobs: v.jobs,
      amount: Math.round(v.amount * 100) / 100,
      withoutVat: Math.round(v.withoutVat * 100) / 100,
    }))
    .sort((a, b) => b.amount - a.amount || b.jobs - a.jobs);
}

export interface ProductionSummary {
  kpis: {
    todayJobs: number;
    todayAmount: number;
    yesterdayJobs: number;
    yesterdayAmount: number;
    weekJobs: number;
    weekAmount: number;
    monthJobs: number;
    monthAmount: number;
    yearJobs: number;
    yearAmount: number;
    totalJobs: number;
    totalAmount: number;
    totalWithoutVat: number;
    avgPerJob: number | null;
    avgJobsPerDay: number | null;
    avgPerUser: number | null;
    topStaff: string | null;
    topStaffUserId: number | null;
    topInsurer: string | null;
    topInsurerId: number | null;
  };
  dailyTrend: { date: string; jobs: number; amount: number }[];
  weeklyTrend: { week: string; jobs: number; amount: number }[];
  monthlyTrend: { month: string; jobs: number; amount: number }[];
  byInsurer: { name: string; jobs: number; amount: number; withoutVat: number }[];
  byDoneBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  bySeenBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  byInstructedBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  staffLeaderboard: {
    name: string;
    jobs: number;
    amount: number;
    avgValue: number | null;
  }[];
  targets: {
    daily?: { jobs: number; amount: number; targetJobs: number; targetAmount: number; met: boolean };
    weekly?: { jobs: number; amount: number; targetJobs: number; targetAmount: number; met: boolean };
    monthly?: { jobs: number; amount: number; targetJobs: number; targetAmount: number; met: boolean };
  };
}

export function buildProductionSummary(
  rows: DbProductionEntry[],
  targets: DbProductionTarget[] = [],
  asOf = new Date(),
): ProductionSummary {
  const active = rows.filter((r) => r.status !== 'cancelled');
  const today = isoDate(asOf);
  const yesterdayDate = new Date(asOf);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = isoDate(yesterdayDate);
  const weekStart = isoDate(startOfWeek(asOf));
  const monthKey = today.slice(0, 7);
  const yearKey = String(asOf.getFullYear());

  const inRange = (r: DbProductionEntry, from: string, to: string) => {
    const d = dateOnly(r.production_date);
    return d >= from && d <= to;
  };

  const todayRows = active.filter((r) => dateOnly(r.production_date) === today);
  const yesterdayRows = active.filter((r) => dateOnly(r.production_date) === yesterday);
  const weekRows = active.filter((r) => inRange(r, weekStart, today));
  const monthRows = active.filter((r) => dateOnly(r.production_date).startsWith(monthKey));
  const yearRows = active.filter((r) => dateOnly(r.production_date).startsWith(yearKey));

  const byDoneBy = groupCountAmount(active, (r) => r.done_by_name || 'Unassigned');
  const byInsurer = groupCountAmount(active, (r) => r.insurer_name || 'Unknown');

  const dayMap = new Map<string, { jobs: number; amount: number }>();
  const weekMap = new Map<string, { jobs: number; amount: number }>();
  const monthMap = new Map<string, { jobs: number; amount: number }>();
  for (const r of active) {
    const d = dateOnly(r.production_date);
    const day = dayMap.get(d) || { jobs: 0, amount: 0 };
    day.jobs += 1;
    day.amount += Number(r.amount) || 0;
    dayMap.set(d, day);

    const ws = isoDate(startOfWeek(new Date(`${d}T00:00:00`)));
    const wk = weekMap.get(ws) || { jobs: 0, amount: 0 };
    wk.jobs += 1;
    wk.amount += Number(r.amount) || 0;
    weekMap.set(ws, wk);

    const m = d.slice(0, 7);
    const mo = monthMap.get(m) || { jobs: 0, amount: 0 };
    mo.jobs += 1;
    mo.amount += Number(r.amount) || 0;
    monthMap.set(m, mo);
  }

  const amounts = active.map((r) => Number(r.amount) || 0);
  const uniqueDays = new Set(active.map((r) => dateOnly(r.production_date))).size;
  const uniqueStaff = new Set(
    active.map((r) => r.done_by_user_id).filter((id): id is number => id != null),
  ).size;

  const findTarget = (type: DbProductionTarget['period_type'], key: string) =>
    targets.find((t) => t.period_type === type && t.period_key === key);

  const dailyTarget = findTarget('daily', today);
  const weeklyTarget = findTarget('weekly', weekStart);
  const monthlyTarget = findTarget('monthly', monthKey);

  const packTarget = (
    jobs: number,
    amount: number,
    t?: DbProductionTarget,
  ) =>
    t
      ? {
          jobs,
          amount,
          targetJobs: Number(t.target_jobs) || 0,
          targetAmount: Number(t.target_amount) || 0,
          met:
            jobs >= (Number(t.target_jobs) || 0) &&
            amount >= (Number(t.target_amount) || 0),
        }
      : undefined;

  const topStaffName = byDoneBy[0]?.name || null;
  const topStaffUserId =
    topStaffName && topStaffName !== 'Unassigned'
      ? active.find((r) => (r.done_by_name || 'Unassigned') === topStaffName)?.done_by_user_id ??
        null
      : null;
  const topInsurerName = byInsurer[0]?.name || null;
  const topInsurerId =
    topInsurerName && topInsurerName !== 'Unknown'
      ? active.find((r) => (r.insurer_name || 'Unknown') === topInsurerName)?.insurer_id ?? null
      : null;

  return {
    kpis: {
      todayJobs: todayRows.length,
      todayAmount: sum(todayRows.map((r) => Number(r.amount))),
      yesterdayJobs: yesterdayRows.length,
      yesterdayAmount: sum(yesterdayRows.map((r) => Number(r.amount))),
      weekJobs: weekRows.length,
      weekAmount: sum(weekRows.map((r) => Number(r.amount))),
      monthJobs: monthRows.length,
      monthAmount: sum(monthRows.map((r) => Number(r.amount))),
      yearJobs: yearRows.length,
      yearAmount: sum(yearRows.map((r) => Number(r.amount))),
      totalJobs: active.length,
      totalAmount: sum(amounts),
      totalWithoutVat: sum(active.map((r) => Number(r.amount_without_vat))),
      avgPerJob: avg(amounts),
      avgJobsPerDay: uniqueDays ? Math.round((active.length / uniqueDays) * 10) / 10 : null,
      avgPerUser: uniqueStaff ? Math.round((sum(amounts) / uniqueStaff) * 100) / 100 : null,
      topStaff: topStaffName,
      topStaffUserId,
      topInsurer: topInsurerName,
      topInsurerId,
    },
    dailyTrend: [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, jobs: v.jobs, amount: Math.round(v.amount * 100) / 100 })),
    weeklyTrend: [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, v]) => ({ week, jobs: v.jobs, amount: Math.round(v.amount * 100) / 100 })),
    monthlyTrend: [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, jobs: v.jobs, amount: Math.round(v.amount * 100) / 100 })),
    byInsurer,
    byDoneBy,
    bySeenBy: groupCountAmount(active, (r) => r.seen_by_name || 'Unassigned'),
    byInstructedBy: groupCountAmount(active, (r) => r.instructed_by_name || 'Unassigned'),
    staffLeaderboard: byDoneBy.slice(0, 10).map((s) => ({
      name: s.name,
      jobs: s.jobs,
      amount: s.amount,
      avgValue: s.jobs ? Math.round((s.amount / s.jobs) * 100) / 100 : null,
    })),
    targets: {
      daily: packTarget(
        todayRows.length,
        sum(todayRows.map((r) => Number(r.amount))),
        dailyTarget,
      ),
      weekly: packTarget(
        weekRows.length,
        sum(weekRows.map((r) => Number(r.amount))),
        weeklyTarget,
      ),
      monthly: packTarget(
        monthRows.length,
        sum(monthRows.map((r) => Number(r.amount))),
        monthlyTarget,
      ),
    },
  };
}

export function reportPeriodLabel(from: string, to: string): string {
  return `${from} → ${to}`;
}

export type ChartPeriod = 'today' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth';

export const CHART_PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
];

/** Inclusive from/to dates (YYYY-MM-DD) for dashboard chart periods. */
export function resolveChartPeriodRange(
  period: ChartPeriod,
  asOf = new Date(),
): { fromDate: string; toDate: string } {
  const today = isoDate(asOf);
  const weekStart = startOfWeek(asOf);

  if (period === 'today') {
    return { fromDate: today, toDate: today };
  }

  if (period === 'thisWeek') {
    return { fromDate: isoDate(weekStart), toDate: today };
  }

  if (period === 'lastWeek') {
    const end = new Date(weekStart);
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return { fromDate: isoDate(start), toDate: isoDate(end) };
  }

  if (period === 'thisMonth') {
    const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    return { fromDate: isoDate(start), toDate: today };
  }

  // lastMonth
  const start = new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
  return { fromDate: isoDate(start), toDate: isoDate(end) };
}

export { formatMoney, isoDate, startOfWeek };

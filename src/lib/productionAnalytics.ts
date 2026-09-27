import type { DbProductionEntry, DbProductionTarget } from '@/lib/productionDb';
import { formatDisplayDate, formatMoney } from '@/lib/productionConfig';
import { normalizeDisplayName, normalizeNameKey, preferDisplayName } from '@/lib/nameNormalize';

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
  // Local calendar date (avoid UTC shifting in UTC+3 / similar zones)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const map = new Map<string, { name: string; jobs: number; amount: number; withoutVat: number }>();
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    const raw = normalizeDisplayName(keyFn(r) || 'Unknown', 'Unknown');
    const key = normalizeNameKey(raw);
    const cur = map.get(key) || { name: raw, jobs: 0, amount: 0, withoutVat: 0 };
    cur.name = preferDisplayName(cur.name, raw);
    cur.jobs += 1;
    cur.amount += Number(r.amount) || 0;
    cur.withoutVat += Number(r.amount_without_vat) || 0;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((v) => ({
      name: v.name,
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
    /** This month's production value for top staff (amount, not job count). */
    topStaffMonthAmount: number | null;
    topInsurer: string | null;
    topInsurerId: number | null;
  };
  dailyTrend: { date: string; jobs: number; amount: number }[];
  weeklyTrend: { week: string; jobs: number; amount: number }[];
  monthlyTrend: { month: string; jobs: number; amount: number }[];
  byInsurer: { name: string; jobs: number; amount: number; withoutVat: number }[];
  byAssignment: { name: string; jobs: number; amount: number; withoutVat: number }[];
  byDoneBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  bySeenBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  byInstructedBy: { name: string; jobs: number; amount: number; withoutVat: number }[];
  /** Done By × Assignment (e.g. "MJOMBA · Assessment"). */
  byDoneByAssignment: { name: string; jobs: number; amount: number; withoutVat: number }[];
  /** Seen By × Assignment (e.g. "FRANCIS · Assessment"). */
  bySeenByAssignment: { name: string; jobs: number; amount: number; withoutVat: number }[];
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
  const byAssignment = groupCountAmount(active, (r) =>
    normalizeDisplayName(r.assignment, 'Unspecified'),
  );
  const byDoneByAssignment = groupCountAmount(active, (r) => {
    const who = normalizeDisplayName(r.done_by_name, 'Unassigned');
    const assignment = normalizeDisplayName(r.assignment, 'Unspecified');
    return `${who} · ${assignment}`;
  });
  const bySeenByAssignment = groupCountAmount(active, (r) => {
    const who = normalizeDisplayName(r.seen_by_name, 'Unassigned');
    const assignment = normalizeDisplayName(r.assignment, 'Unspecified');
    return `${who} · ${assignment}`;
  });

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

  // Top staff = same monthly Done By rollup as the chart (by name, by amount).
  const monthByDoneBy = groupCountAmount(monthRows, (r) => r.done_by_name || 'Unassigned');
  const topStaff =
    monthByDoneBy.find((s) => s.name !== 'Unassigned') || monthByDoneBy[0] || null;

  const topStaffName =
    topStaff && topStaff.name !== 'Unassigned' ? topStaff.name : null;
  const topStaffMonthAmount = topStaffName != null ? topStaff.amount : null;
  const topStaffUserId =
    topStaffName != null
      ? monthRows.find(
          (r) =>
            normalizeNameKey(r.done_by_name || 'Unassigned') ===
              normalizeNameKey(topStaffName) && r.done_by_user_id != null,
        )?.done_by_user_id ?? null
      : null;
  const topInsurerName = byInsurer[0]?.name || null;
  const topInsurerId =
    topInsurerName && topInsurerName !== 'Unknown'
      ? active.find(
          (r) =>
            normalizeNameKey(r.insurer_name || 'Unknown') === normalizeNameKey(topInsurerName),
        )?.insurer_id ?? null
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
      topStaffMonthAmount,
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
    byAssignment,
    byDoneBy,
    bySeenBy: groupCountAmount(active, (r) => r.seen_by_name || 'Unassigned'),
    byInstructedBy: groupCountAmount(active, (r) => r.instructed_by_name || 'Unassigned'),
    byDoneByAssignment,
    bySeenByAssignment,
    staffLeaderboard: monthByDoneBy.slice(0, 10).map((s) => ({
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

export type ChartPeriod =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth';

export const CHART_PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
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

  if (period === 'yesterday') {
    const y = new Date(asOf);
    y.setDate(y.getDate() - 1);
    const yesterday = isoDate(y);
    return { fromDate: yesterday, toDate: yesterday };
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

// ── Period comparison (day/week vs prior month or custom) ──────────────────

export type ComparePreset =
  | 'off'
  | 'todayVsSameDayLastMonth'
  | 'thisWeekVsSameWeekLastMonth'
  | 'customDays'
  | 'customWeeks';

export const COMPARE_PRESETS: { key: ComparePreset; label: string; hint: string }[] = [
  { key: 'off', label: 'Off', hint: 'No comparison' },
  {
    key: 'todayVsSameDayLastMonth',
    label: 'Today vs same day last month',
    hint: 'e.g. 25 Sep vs 25 Aug',
  },
  {
    key: 'thisWeekVsSameWeekLastMonth',
    label: 'This week vs same week last month',
    hint: 'Aligned weekdays Mon–today',
  },
  { key: 'customDays', label: 'Custom days', hint: 'A start/end and B start/end' },
  { key: 'customWeeks', label: 'Custom weeks', hint: 'Pick two week starts' },
];

export interface DateRange {
  fromDate: string;
  toDate: string;
  label: string;
}

export interface CompareRanges {
  primary: DateRange;
  compare: DateRange;
}

/** Same calendar day one month earlier (clamped to month length). */
export function sameCalendarDayLastMonth(asOf = new Date()): Date {
  const day = asOf.getDate();
  const lastDayPrev = new Date(asOf.getFullYear(), asOf.getMonth(), 0).getDate();
  return new Date(asOf.getFullYear(), asOf.getMonth() - 1, Math.min(day, lastDayPrev));
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysInclusive(fromDate: string, toDate: string): number {
  const a = new Date(`${fromDate.slice(0, 10)}T00:00:00`);
  const b = new Date(`${toDate.slice(0, 10)}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function parseIsoDateLocal(iso: string): Date {
  const s = iso.slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Month-to-date for the calendar month of `asOfIso`, through that date inclusive. */
export function monthToDateRange(asOfIso: string): DateRange {
  const d = parseIsoDateLocal(asOfIso);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const toDate = isoDate(d);
  const fromDate = isoDate(start);
  const monthName = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  return {
    fromDate,
    toDate,
    label: `Month to ${formatDisplayDate(toDate)} (${monthName})`,
  };
}

export function resolveCompareRanges(
  preset: ComparePreset,
  opts: {
    asOf?: Date;
    primaryDate?: string;
    compareDate?: string;
    /** Custom days — Period A inclusive range */
    primaryFromDate?: string;
    primaryToDate?: string;
    /** Custom days — Period B inclusive range */
    compareFromDate?: string;
    compareToDate?: string;
    primaryWeekStart?: string;
    compareWeekStart?: string;
  } = {},
): CompareRanges | null {
  if (preset === 'off') return null;
  const asOf = opts.asOf ?? new Date();
  const today = isoDate(asOf);

  if (preset === 'todayVsSameDayLastMonth') {
    const prior = isoDate(sameCalendarDayLastMonth(asOf));
    return {
      primary: { fromDate: today, toDate: today, label: `Today (${formatDisplayDate(today)})` },
      compare: {
        fromDate: prior,
        toDate: prior,
        label: `Same day last month (${formatDisplayDate(prior)})`,
      },
    };
  }

  if (preset === 'thisWeekVsSameWeekLastMonth') {
    const weekStart = startOfWeek(asOf);
    const primaryFrom = isoDate(weekStart);
    const primaryTo = today;
    const span = daysInclusive(primaryFrom, primaryTo);
    const anchor = sameCalendarDayLastMonth(asOf);
    const compareStart = startOfWeek(anchor);
    const compareFrom = isoDate(compareStart);
    const compareTo = addDaysIso(compareFrom, span);
    return {
      primary: {
        fromDate: primaryFrom,
        toDate: primaryTo,
        label: `This week (${formatDisplayDate(primaryFrom)} → ${formatDisplayDate(primaryTo)})`,
      },
      compare: {
        fromDate: compareFrom,
        toDate: compareTo,
        label: `Same week last month (${formatDisplayDate(compareFrom)} → ${formatDisplayDate(compareTo)})`,
      },
    };
  }

  if (preset === 'customDays') {
    const normalizeRange = (fromRaw: string, toRaw: string) => {
      let from = fromRaw.slice(0, 10);
      let to = toRaw.slice(0, 10);
      if (from > to) {
        const tmp = from;
        from = to;
        to = tmp;
      }
      return { from, to };
    };
    const prior = isoDate(sameCalendarDayLastMonth(asOf));
    const a = normalizeRange(
      opts.primaryFromDate || opts.primaryDate || today,
      opts.primaryToDate || opts.primaryDate || today,
    );
    const b = normalizeRange(
      opts.compareFromDate || opts.compareDate || prior,
      opts.compareToDate || opts.compareDate || prior,
    );
    return {
      primary: {
        fromDate: a.from,
        toDate: a.to,
        label:
          a.from === a.to
            ? `Period A (${formatDisplayDate(a.from)})`
            : `Period A (${formatDisplayDate(a.from)} → ${formatDisplayDate(a.to)})`,
      },
      compare: {
        fromDate: b.from,
        toDate: b.to,
        label:
          b.from === b.to
            ? `Period B (${formatDisplayDate(b.from)})`
            : `Period B (${formatDisplayDate(b.from)} → ${formatDisplayDate(b.to)})`,
      },
    };
  }

  if (preset === 'customWeeks') {
    const rawA = (opts.primaryWeekStart || isoDate(startOfWeek(asOf))).slice(0, 10);
    const rawB = (
      opts.compareWeekStart || isoDate(startOfWeek(sameCalendarDayLastMonth(asOf)))
    ).slice(0, 10);
    const startA = isoDate(startOfWeek(parseIsoDateLocal(rawA)));
    const startB = isoDate(startOfWeek(parseIsoDateLocal(rawB)));
    const endA = addDaysIso(startA, 6);
    const endB = addDaysIso(startB, 6);
    // Cap primary week end at today when it is the current week
    const primaryTo = endA > today && startA <= today ? today : endA;
    const span = daysInclusive(startA, primaryTo);
    const compareTo = addDaysIso(startB, span);
    return {
      primary: {
        fromDate: startA,
        toDate: primaryTo,
        label: `Week A (${formatDisplayDate(startA)} → ${formatDisplayDate(primaryTo)})`,
      },
      compare: {
        fromDate: startB,
        toDate: compareTo,
        label: `Week B (${formatDisplayDate(startB)} → ${formatDisplayDate(compareTo)})`,
      },
    };
  }

  return null;
}

export function entriesInDateRange<T extends { production_date: string; status?: string }>(
  rows: T[],
  fromDate: string,
  toDate: string,
): T[] {
  const from = fromDate.slice(0, 10);
  const to = toDate.slice(0, 10);
  return rows.filter((r) => {
    if (r.status === 'cancelled') return false;
    const d = String(r.production_date || '').slice(0, 10);
    return d >= from && d <= to;
  });
}

export function sumProductionAmount(
  rows: { amount?: number | null; status?: string }[],
): { jobs: number; amount: number } {
  let jobs = 0;
  let amount = 0;
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    jobs += 1;
    amount += Number(r.amount) || 0;
  }
  return { jobs, amount: Math.round(amount * 100) / 100 };
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Align primary vs compare by day offset within each range for trend charts.
 * Single-day ranges yield one point.
 */
export function buildCompareTrendPoints(
  primaryRows: { production_date: string; amount?: number | null; status?: string }[],
  compareRows: { production_date: string; amount?: number | null; status?: string }[],
  primary: DateRange,
  compare: DateRange,
  metric: 'jobs' | 'amount' = 'jobs',
): {
  label: string;
  a: number;
  b: number;
  meta: { primaryDate: string; compareDate: string };
}[] {
  const span = daysInclusive(primary.fromDate, primary.toDate);
  const points: {
    label: string;
    a: number;
    b: number;
    meta: { primaryDate: string; compareDate: string };
  }[] = [];

  for (let i = 0; i <= span; i++) {
    const pDate = addDaysIso(primary.fromDate, i);
    const cDate = addDaysIso(compare.fromDate, i);
    if (pDate > primary.toDate) break;
    const pDay = entriesInDateRange(primaryRows, pDate, pDate);
    const cDay = cDate <= compare.toDate ? entriesInDateRange(compareRows, cDate, cDate) : [];
    const pSum = sumProductionAmount(pDay);
    const cSum = sumProductionAmount(cDay);
    const dow = WEEKDAY_SHORT[parseIsoDateLocal(pDate).getDay()] || '';
    const label =
      span === 0
        ? formatDisplayDate(pDate)
        : `${dow} ${pDate.slice(8)}`;
    points.push({
      label,
      a: metric === 'jobs' ? pSum.jobs : pSum.amount,
      b: metric === 'jobs' ? cSum.jobs : cSum.amount,
      meta: { primaryDate: pDate, compareDate: cDate },
    });
  }
  return points;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

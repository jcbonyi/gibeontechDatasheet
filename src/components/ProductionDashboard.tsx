'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { formatMoney, formatDisplayDate } from '@/lib/productionConfig';
import { SimpleBarChart, SimpleHorizontalBars, SimpleLineChart } from '@/components/SimpleCharts';
import { NotificationBell } from '@/components/NotificationBell';
import {
  CHART_PERIODS,
  resolveChartPeriodRange,
  type ChartPeriod,
  type ProductionSummary,
} from '@/lib/productionAnalytics';
import type { AnalyticsSummary } from '@/lib/tracking';
import {
  filterOpenDatasheetsByAssessor,
  filterOpenDatasheetsByAssessorAging,
  filterOpenDatasheetsByInsurer,
  filterProductionByAssignment,
  filterProductionByDate,
  filterProductionByDoneBy,
  filterProductionByDoneByAssignment,
  filterProductionByInstructedBy,
  filterProductionByInsurer,
  filterProductionBySeenBy,
  filterProductionBySeenByAssignment,
  parseAssessorAgingLabel,
  parseAssignmentBarLabel,
  type DatasheetDrillEntry,
  type ProductionDrillEntry,
} from '@/lib/productionDashboardDrillDown';
import {
  ProductionDashboardDetailModal,
  type DashboardDetailModalState,
} from '@/components/ProductionDashboardDetailModal';
import { isOpenStatus } from '@/lib/status';

function agingBarColor(band: string): string | undefined {
  if (band === '15+') return '#EF4444';
  if (band === '8-14') return '#F59E0B';
  if (band === 'unknown') return '#94A3B8';
  return undefined;
}

function stripTrailingParen(label: string): string {
  const idx = label.lastIndexOf(' (');
  return idx > 0 ? label.slice(0, idx).trim() : label.trim();
}

function mapProductionEntries(raw: unknown): ProductionDrillEntry[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: Number(row.id),
      production_date: String(row.production_date || ''),
      registration_number: String(row.registration_number || ''),
      insurer_name: (row.insurer_name as string) || null,
      assignment: (row.assignment as string) || null,
      amount: Number(row.amount) || 0,
      amount_without_vat: Number(row.amount_without_vat) || 0,
      done_by_name: (row.done_by_name as string) || null,
      seen_by_name: (row.seen_by_name as string) || null,
      instructed_by_name: (row.instructed_by_name as string) || null,
      status: String(row.status || ''),
    };
  });
}

function mapDatasheetEntries(raw: unknown): DatasheetDrillEntry[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((e) => {
    const row = e as Record<string, unknown>;
    return {
      id: Number(row.id),
      serial_no: String(row.serial_no || ''),
      claim_no: (row.claim_no as string) || null,
      reg_no: (row.reg_no as string) || null,
      status: String(row.status || ''),
      client_insurer: (row.client_insurer as string) || null,
      assigned_to_name: (row.assigned_to_name as string) || null,
      created_by_name: (row.created_by_name as string) || null,
      age_days: row.age_days != null ? Number(row.age_days) : null,
      age_band: (row.age_band as DatasheetDrillEntry['age_band']) || 'unknown',
      is_overdue: Boolean(row.is_overdue),
      delay_notes: row.delay_notes,
    };
  });
}

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayNum = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayNum}`;
}

function monthStart(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function registerHref(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value) !== '') p.set(key, String(value));
  });
  const qs = p.toString();
  return `/production/entries${qs ? `?${qs}` : ''}`;
}

function shortDayLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

function KpiCard({
  href,
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  icon?: typeof CalendarDays;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border bg-white/95 p-4 shadow-md shadow-brand-900/5 transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
        accent
          ? 'border-brand-200/80 hover:border-brand-400'
          : 'border-white/80 hover:border-brand-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? (
          <span
            className={`rounded-lg p-1.5 ${
              accent ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-500'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : null}
      </div>
      <p
        className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${
          accent ? 'text-brand-800' : 'text-slate-900'
        } group-hover:text-brand-700`}
      >
        {value}
      </p>
      {sub != null && <p className="mt-0.5 text-sm text-slate-600">{sub}</p>}
      <p className="mt-3 text-xs font-medium text-brand-600 transition group-hover:translate-x-0.5">
        View in register →
      </p>
    </Link>
  );
}

function ChartPanel({
  title,
  hint,
  count,
  interactive,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="section-card !p-4 sm:!p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-800">{title}</h2>
        {count != null && count > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600">
            {count}
          </span>
        )}
      </div>
      {children}
      {hint ? (
        <p className="mt-3 text-xs text-slate-500">
          {hint}
          {interactive ? ' · Click a bar to view the list' : ''}
        </p>
      ) : interactive ? (
        <p className="mt-3 text-xs text-slate-500">Click a bar to view the list</p>
      ) : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="section-card !p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-20 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="section-card !py-5">
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProductionDashboard() {
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [chartSummary, setChartSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartsError, setChartsError] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('thisMonth');
  const [datasheetPending, setDatasheetPending] = useState<AnalyticsSummary | null>(null);
  const [detail, setDetail] = useState<DashboardDetailModalState>(null);
  const [periodEntries, setPeriodEntries] = useState<ProductionDrillEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<ProductionDrillEntry[]>([]);
  const [openDatasheets, setOpenDatasheets] = useState<DatasheetDrillEntry[]>([]);

  const chartRange = useMemo(() => resolveChartPeriodRange(chartPeriod), [chartPeriod]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const todayLocal = isoToday();
    const monthFromLocal = monthStart();
    try {
      const [prodRes, dsRes, dsListRes, monthProdRes] = await Promise.all([
        fetch('/api/production/analytics'),
        fetch('/api/analytics'),
        fetch('/api/datasheets'),
        fetch(`/api/production?fromDate=${monthFromLocal}&toDate=${todayLocal}`),
      ]);
      const prodData = await prodRes.json().catch(() => ({}));
      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to load KPIs');
      setSummary(prodData.summary || null);

      const dsData = await dsRes.json().catch(() => ({}));
      setDatasheetPending(dsRes.ok ? dsData.summary || null : null);

      const dsListData = await dsListRes.json().catch(() => ({}));
      const sheets = mapDatasheetEntries(dsListData.datasheets);
      setOpenDatasheets(sheets.filter((r) => isOpenStatus(r.status)));

      const monthProdData = await monthProdRes.json().catch(() => ({}));
      setMonthEntries(monthProdRes.ok ? mapProductionEntries(monthProdData.entries) : []);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCharts = useCallback(async () => {
    setChartsLoading(true);
    setChartsError(null);
    try {
      const params = new URLSearchParams({
        fromDate: chartRange.fromDate,
        toDate: chartRange.toDate,
      });
      const [analyticsRes, prodRes] = await Promise.all([
        fetch(`/api/production/analytics?${params}`),
        fetch(`/api/production?${params}`),
      ]);
      const data = await analyticsRes.json().catch(() => ({}));
      if (!analyticsRes.ok) throw new Error(data.error || 'Failed to load charts');
      if (!data.summary) throw new Error('No chart data returned');
      setChartSummary(data.summary);

      const prodData = await prodRes.json().catch(() => ({}));
      setPeriodEntries(prodRes.ok ? mapProductionEntries(prodData.entries) : []);
    } catch (err) {
      setChartSummary(null);
      setPeriodEntries([]);
      setChartsError(err instanceof Error ? err.message : 'Failed to load charts');
    } finally {
      setChartsLoading(false);
    }
  }, [chartRange.fromDate, chartRange.toDate]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const refresh = () => {
    loadOverview();
    loadCharts();
  };

  const k = summary?.kpis;
  const ck = chartSummary?.kpis;
  const today = isoToday();
  const weekFrom = startOfWeek();
  const monthFrom = monthStart();
  const periodLabel = CHART_PERIODS.find((p) => p.key === chartPeriod)?.label || '';
  const showDailyBars =
    chartPeriod === 'today' ||
    chartPeriod === 'yesterday' ||
    chartPeriod === 'thisWeek' ||
    chartPeriod === 'lastWeek';

  const topStaffName =
    chartPeriod === 'thisMonth' && chartSummary
      ? chartSummary.byDoneBy.find((s) => s.name !== 'Unassigned')?.name ||
        chartSummary.kpis.topStaff ||
        null
      : k?.topStaff || null;
  const topStaffAmount =
    chartPeriod === 'thisMonth' && chartSummary
      ? chartSummary.byDoneBy.find((s) => s.name !== 'Unassigned')?.amount ??
        chartSummary.kpis.topStaffMonthAmount ??
        null
      : k?.topStaffMonthAmount ?? null;
  const topStaffUserId =
    chartPeriod === 'thisMonth' && chartSummary
      ? chartSummary.kpis.topStaffUserId
      : k?.topStaffUserId;

  const pendingByIndividual = useMemo(
    () =>
      (datasheetPending?.byAssessor ?? [])
        .filter((a) => a.open > 0)
        .map((a) => ({ name: a.name, jobs: a.open })),
    [datasheetPending],
  );
  const pendingByInsurer = useMemo(
    () =>
      (datasheetPending?.byInsurer ?? [])
        .filter((i) => i.open > 0)
        .map((i) => ({ name: i.name, jobs: i.open })),
    [datasheetPending],
  );
  const pendingByIndividualAging = useMemo(
    () => datasheetPending?.pendingByAssessorAging ?? [],
    [datasheetPending],
  );
  const exportBase = `/api/production/export?fromDate=${chartRange.fromDate}&toDate=${chartRange.toDate}&pack=dashboard`;
  const periodRegisterHref = registerHref({
    fromDate: chartRange.fromDate,
    toDate: chartRange.toDate,
  });

  const showProductionList = (
    title: string,
    rows: ProductionDrillEntry[],
    subtitle?: string,
    listHref?: string,
  ) => {
    setDetail({
      kind: 'production',
      title,
      subtitle,
      rows,
      registerHref: listHref ?? periodRegisterHref,
    });
  };

  const showDatasheetList = (title: string, rows: DatasheetDrillEntry[], subtitle?: string) => {
    setDetail({
      kind: 'datasheet',
      title,
      subtitle,
      rows,
      registerHref: '/datasheets',
    });
  };

  const drillDay = (item: { label: string; meta?: Record<string, string> }) => {
    const date = item.meta?.date;
    if (!date) return;
    showProductionList(
      `Production · ${formatDisplayDate(date)}`,
      filterProductionByDate(periodEntries, date),
      periodLabel,
    );
  };

  return (
    <div className="pb-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Production dashboard</h1>
          <p className="page-subtitle">
            Vehicle valuation production · jobs, value &amp; staff performance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NotificationBell />
          <Link href="/production/entries" className="btn-secondary">
            Register
          </Link>
          <Link href="/production/reports" className="btn-secondary">
            Reports
          </Link>
          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={loading || chartsLoading}
            aria-label="Refresh dashboard"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading || chartsLoading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link href="/production/entries/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New entry
          </Link>
        </div>
      </div>

      {loading || !summary ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="mb-2">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Overview
            </h2>
            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                href={registerHref({ fromDate: today, toDate: today })}
                label="Today's production"
                value={`${k?.todayJobs ?? 0} jobs`}
                sub={formatMoney(k?.todayAmount ?? 0)}
                icon={CalendarDays}
                accent
              />
              <KpiCard
                href={registerHref({ fromDate: weekFrom, toDate: today })}
                label="This week"
                value={`${k?.weekJobs ?? 0} jobs`}
                sub={formatMoney(k?.weekAmount ?? 0)}
                icon={TrendingUp}
                accent
              />
              <KpiCard
                href={registerHref({ fromDate: monthFrom, toDate: today })}
                label="This month"
                value={`${k?.monthJobs ?? 0} jobs`}
                sub={formatMoney(k?.monthAmount ?? 0)}
                icon={Target}
                accent
              />
              <KpiCard
                href={registerHref({})}
                label="Total jobs"
                value={String(k?.totalJobs ?? 0)}
                sub={formatMoney(k?.totalAmount ?? 0)}
                icon={ClipboardList}
                accent
              />
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                href={registerHref({})}
                label="Total production value"
                value={formatMoney(k?.totalAmount ?? 0)}
                sub={`Without VAT ${formatMoney(k?.totalWithoutVat ?? 0)}`}
                icon={TrendingUp}
              />
              <KpiCard
                href="/production/reports"
                label="Avg per user"
                value={k?.avgPerUser != null ? formatMoney(k.avgPerUser) : '—'}
                sub={`Avg / job ${k?.avgPerJob != null ? formatMoney(k.avgPerJob) : '—'}`}
                icon={Users}
              />
              <Link
                href={
                  topStaffUserId
                    ? registerHref({
                        doneBy: topStaffUserId,
                        fromDate: monthFrom,
                        toDate: today,
                      })
                    : topStaffName
                      ? registerHref({
                          q: topStaffName,
                          fromDate: monthFrom,
                          toDate: today,
                        })
                      : registerHref({ fromDate: monthFrom, toDate: today })
                }
                className="group block rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-md shadow-brand-900/5 transition hover:border-amber-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" aria-hidden />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Top staff
                  </p>
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                  {topStaffName || '—'}
                </p>
                <p className="text-sm text-slate-600">
                  {topStaffAmount != null
                    ? `${formatMoney(topStaffAmount)} this month`
                    : 'No production this month'}
                </p>
                <p className="mt-3 text-xs font-medium text-brand-600">View this month →</p>
              </Link>
              <Link
                href={
                  k?.topInsurerId
                    ? registerHref({ insurerId: k.topInsurerId })
                    : k?.topInsurer
                      ? registerHref({ q: k.topInsurer })
                      : '/production/entries'
                }
                className="group block rounded-2xl border border-white/80 bg-white/95 p-4 shadow-md shadow-brand-900/5 transition hover:border-brand-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" aria-hidden />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Top insurer
                  </p>
                </div>
                <p className="mt-2 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                  {k?.topInsurer || '—'}
                </p>
                <p className="mt-3 text-xs font-medium text-brand-600">View insurer jobs →</p>
              </Link>
            </div>
          </section>

          {(summary.targets.daily || summary.targets.weekly || summary.targets.monthly) && (
            <div className="section-card mb-6 !p-4 sm:!p-5">
              <div className="mb-3 flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-600" aria-hidden />
                <h2 className="text-sm font-semibold text-brand-800">Target progress</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['daily', 'weekly', 'monthly'] as const).map((key) => {
                  const t = summary.targets[key];
                  if (!t) return null;
                  const href =
                    key === 'daily'
                      ? registerHref({ fromDate: today, toDate: today })
                      : key === 'weekly'
                        ? registerHref({ fromDate: weekFrom, toDate: today })
                        : registerHref({ fromDate: monthFrom, toDate: today });
                  const jobPct =
                    t.targetJobs > 0
                      ? Math.min(100, Math.round((t.jobs / t.targetJobs) * 100))
                      : 0;
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`rounded-xl border px-3 py-3 transition hover:shadow-md ${
                        t.met
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">{key}</p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {t.jobs}/{t.targetJobs} jobs
                      </p>
                      <p className="text-xs text-slate-600">
                        {formatMoney(t.amount)} / {formatMoney(t.targetAmount)}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div
                          className={`h-full rounded-full ${
                            t.met ? 'bg-emerald-500' : 'bg-brand-500'
                          }`}
                          style={{ width: `${jobPct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {t.met ? 'Target met' : `${jobPct}% of jobs target`}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Datasheet pending
          </h3>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <ChartPanel
              title="Pending By Individual"
              count={pendingByIndividual.length}
              hint="Open datasheet tasks by assessor"
              interactive
            >
              <SimpleHorizontalBars
                maxHeight={420}
                onItemClick={(item) =>
                  showDatasheetList(
                    `Pending · ${item.label}`,
                    filterOpenDatasheetsByAssessor(openDatasheets, item.label),
                    'Open assessment tasks',
                  )
                }
                items={pendingByIndividual.map((i) => ({
                  label: i.name,
                  value: i.jobs,
                }))}
              />
            </ChartPanel>
            <ChartPanel
              title="Pending By Insurer"
              count={pendingByInsurer.length}
              hint="Open datasheet tasks by insurer"
              interactive
            >
              <SimpleHorizontalBars
                maxHeight={420}
                onItemClick={(item) =>
                  showDatasheetList(
                    `Pending · ${item.label}`,
                    filterOpenDatasheetsByInsurer(openDatasheets, item.label),
                    'Open assessment tasks',
                  )
                }
                items={pendingByInsurer.map((i) => ({
                  label: i.name,
                  value: i.jobs,
                }))}
              />
            </ChartPanel>
            <div className="lg:col-span-2">
              <ChartPanel
                title="Pending By Individual By Aging"
                count={pendingByIndividualAging.length}
                hint="Open tasks · person and days since instruction (0–3, 4–7, 8–14, 15+)"
                interactive
              >
                <SimpleHorizontalBars
                  maxHeight={420}
                  onItemClick={(item) => {
                    const parsed = parseAssessorAgingLabel(item.label);
                    if (!parsed) return;
                    showDatasheetList(
                      item.label,
                      filterOpenDatasheetsByAssessorAging(
                        openDatasheets,
                        parsed.person,
                        parsed.band,
                      ),
                      'Open assessment tasks',
                    );
                  }}
                  items={pendingByIndividualAging.map((i) => ({
                    label: i.label,
                    value: i.count,
                    color: agingBarColor(i.band),
                  }))}
                />
              </ChartPanel>
            </div>
          </div>

          <div className="section-card mb-4 !p-4 sm:!p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-brand-800">Graphs</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {periodLabel}: {formatDisplayDate(chartRange.fromDate)}
                  {chartRange.fromDate !== chartRange.toDate
                    ? ` → ${formatDisplayDate(chartRange.toDate)}`
                    : ''}
                  {ck
                    ? ` · ${ck.totalJobs} jobs · ${formatMoney(ck.totalAmount)}`
                    : chartsLoading
                      ? ' · Loading…'
                      : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={periodRegisterHref}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800"
                >
                  Open register →
                </Link>
                <a href={`${exportBase}&format=xlsx`} className="btn-secondary !px-3 !py-1.5 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </a>
                <a href={`${exportBase}&format=pdf`} className="btn-secondary !px-3 !py-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </a>
              </div>
            </div>

            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Chart period"
            >
              {CHART_PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={chartPeriod === key}
                  onClick={() => setChartPeriod(key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    chartPeriod === key
                      ? 'border-brand-500 bg-brand-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {chartsLoading ? (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="section-card !p-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                  <div className="mt-6 h-36 animate-pulse rounded-xl bg-slate-100" />
                </div>
              ))}
            </div>
          ) : chartsError || !chartSummary ? (
            <div className="section-card mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-red-700">
                {chartsError || 'Charts could not be loaded for this period.'}
              </p>
              <button type="button" className="btn-secondary" onClick={loadCharts}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Trends · {periodLabel}
              </h3>
              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <ChartPanel
                  title={showDailyBars ? 'Production by day' : 'Daily production trend'}
                  hint={
                    showDailyBars
                      ? 'Jobs per day in the selected period'
                      : 'Jobs (brand) vs amount ÷ 1000 (teal)'
                  }
                  interactive
                >
                  {showDailyBars ? (
                    <SimpleBarChart
                      hideEmpty={false}
                      onItemClick={drillDay}
                      items={(chartSummary.dailyTrend ?? []).map((d) => ({
                        label: shortDayLabel(d.date),
                        value: d.jobs,
                        meta: { date: d.date },
                      }))}
                    />
                  ) : (
                    <SimpleLineChart
                      legendA="Jobs"
                      legendB="Amount ÷ 1000"
                      onPointClick={(p) => drillDay(p)}
                      points={(chartSummary.dailyTrend ?? []).map((d) => ({
                        label: shortDayLabel(d.date),
                        a: d.jobs,
                        b: Math.round(d.amount / 1000),
                        meta: { date: d.date },
                      }))}
                    />
                  )}
                </ChartPanel>
                <ChartPanel
                  title="Production value by day"
                  hint="Amount (incl. VAT) per day"
                  interactive
                >
                  <SimpleBarChart
                    hideEmpty={false}
                    onItemClick={drillDay}
                    items={(chartSummary.dailyTrend ?? []).map((d) => ({
                      label: shortDayLabel(d.date),
                      value: Math.round(d.amount),
                      meta: { date: d.date },
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Production by insurer · ${periodLabel}`}
                  count={(chartSummary.byInsurer ?? []).length}
                  hint="Top 10 by jobs"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={320}
                    onItemClick={(item) => {
                      const name = stripTrailingParen(item.label);
                      showProductionList(
                        `Insurer · ${name}`,
                        filterProductionByInsurer(periodEntries, name),
                        periodLabel,
                      );
                    }}
                    items={(chartSummary.byInsurer ?? []).slice(0, 10).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Production by Done By · ${periodLabel}`}
                  count={(chartSummary.byDoneBy ?? []).length}
                  hint="Ranked by production value"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={320}
                    formatValue={(v) => formatMoney(v)}
                    onItemClick={(item) =>
                      showProductionList(
                        `Done by · ${item.label}`,
                        filterProductionByDoneBy(periodEntries, item.label),
                        periodLabel,
                      )
                    }
                    items={(chartSummary.byDoneBy ?? []).slice(0, 10).map((i) => ({
                      label: i.name,
                      value: i.amount,
                    }))}
                  />
                </ChartPanel>
              </div>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                People · {periodLabel}
              </h3>
              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <ChartPanel
                  title={`By Seen By · ${periodLabel}`}
                  count={(chartSummary.bySeenBy ?? []).length}
                  hint="All persons · jobs reviewed"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    onItemClick={(item) =>
                      showProductionList(
                        `Seen by · ${item.label}`,
                        filterProductionBySeenBy(periodEntries, item.label),
                        periodLabel,
                      )
                    }
                    items={(chartSummary.bySeenBy ?? []).map((i) => ({
                      label: i.name,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`By Instructed By · ${periodLabel}`}
                  count={(chartSummary.byInstructedBy ?? []).length}
                  hint="All persons · jobs instructed"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    onItemClick={(item) =>
                      showProductionList(
                        `Instructed by · ${item.label}`,
                        filterProductionByInstructedBy(periodEntries, item.label),
                        periodLabel,
                      )
                    }
                    items={(chartSummary.byInstructedBy ?? []).map((i) => ({
                      label: i.name,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Done By · ${periodLabel}`}
                  count={(chartSummary.byDoneBy ?? []).length}
                  hint="All staff · production value"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    formatValue={(v) => formatMoney(v)}
                    onItemClick={(item) =>
                      showProductionList(
                        `Done by · ${item.label}`,
                        filterProductionByDoneBy(periodEntries, item.label),
                        periodLabel,
                      )
                    }
                    items={(chartSummary.byDoneBy ?? []).map((i) => ({
                      label: i.name,
                      value: i.amount,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title="Staff leaderboard (this month)"
                  count={(summary.staffLeaderboard ?? []).length}
                  hint="From overview · ranked by value"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    formatValue={(v) => formatMoney(v)}
                    onItemClick={(item) => {
                      const name = stripTrailingParen(item.label.split(' · ')[0] || item.label);
                      showProductionList(
                        `Staff · ${name}`,
                        filterProductionByDoneBy(monthEntries, name),
                        'This month',
                        registerHref({ fromDate: monthFrom, toDate: today }),
                      );
                    }}
                    items={(summary.staffLeaderboard ?? []).map((s) => ({
                      label: `${s.name} · ${s.jobs} jobs`,
                      value: s.amount,
                    }))}
                  />
                </ChartPanel>
              </div>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Assignments · {periodLabel}
              </h3>
              <div className="mb-6 grid gap-4 lg:grid-cols-2">
                <ChartPanel
                  title={`Production by Assignment · ${periodLabel}`}
                  count={(chartSummary.byAssignment ?? []).length}
                  hint="Jobs by assignment type"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={320}
                    onItemClick={(item) => {
                      const name = stripTrailingParen(item.label);
                      showProductionList(
                        `Assignment · ${name}`,
                        filterProductionByAssignment(periodEntries, name),
                        periodLabel,
                      );
                    }}
                    items={(chartSummary.byAssignment ?? []).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Assignment value · ${periodLabel}`}
                  hint="Amount (incl. VAT) by assignment type"
                  interactive
                >
                  <SimpleBarChart
                    hideEmpty
                    onItemClick={(item) => {
                      const name = item.meta?.assignment || item.label;
                      showProductionList(
                        `Assignment · ${name}`,
                        filterProductionByAssignment(periodEntries, name),
                        periodLabel,
                      );
                    }}
                    items={(chartSummary.byAssignment ?? []).slice(0, 8).map((i) => ({
                      label: i.name.length > 14 ? `${i.name.slice(0, 12)}…` : i.name,
                      value: Math.round(i.amount),
                      meta: { assignment: i.name },
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Assignments by Done By · ${periodLabel}`}
                  count={(chartSummary.byDoneByAssignment ?? []).length}
                  hint="User · assignment type (jobs completed)"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    onItemClick={(item) => {
                      const key = parseAssignmentBarLabel(item.label);
                      showProductionList(
                        key,
                        filterProductionByDoneByAssignment(periodEntries, key),
                        periodLabel,
                      );
                    }}
                    items={(chartSummary.byDoneByAssignment ?? []).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
                <ChartPanel
                  title={`Assignments by Seen By · ${periodLabel}`}
                  count={(chartSummary.bySeenByAssignment ?? []).length}
                  hint="User · assignment type (jobs reviewed)"
                  interactive
                >
                  <SimpleHorizontalBars
                    maxHeight={420}
                    onItemClick={(item) => {
                      const key = parseAssignmentBarLabel(item.label);
                      showProductionList(
                        key,
                        filterProductionBySeenByAssignment(periodEntries, key),
                        periodLabel,
                      );
                    }}
                    items={(chartSummary.bySeenByAssignment ?? []).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.jobs,
                    }))}
                  />
                </ChartPanel>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/production/reports" className="btn-secondary">
              Open reports
            </Link>
            <Link href="/production/entries" className="btn-secondary">
              Full register
            </Link>
          </div>
        </>
      )}

      <ProductionDashboardDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

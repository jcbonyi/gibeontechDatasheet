'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trophy,
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

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function registerHref(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && String(value) !== '') p.set(key, String(value));
  });
  const qs = p.toString();
  return `/production/entries${qs ? `?${qs}` : ''}`;
}

function KpiCard({
  href,
  label,
  value,
  sub,
  accent,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="section-card group block !p-4 transition hover:border-brand-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${accent ? 'text-brand-800' : 'text-slate-900'} group-hover:text-brand-700`}
      >
        {value}
      </p>
      {sub != null && <p className="text-sm text-slate-600">{sub}</p>}
      <p className="mt-2 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
        View in register →
      </p>
    </Link>
  );
}

function shortDayLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

export function ProductionDashboard() {
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [chartSummary, setChartSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('thisMonth');

  const chartRange = useMemo(() => resolveChartPeriodRange(chartPeriod), [chartPeriod]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/analytics');
      const data = await res.json();
      setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate: chartRange.fromDate,
        toDate: chartRange.toDate,
      });
      const res = await fetch(`/api/production/analytics?${params}`);
      const data = await res.json();
      setChartSummary(data.summary || null);
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
  const showDailyBars = chartPeriod === 'today' || chartPeriod === 'thisWeek' || chartPeriod === 'lastWeek';

  return (
    <div className="pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Production dashboard</h1>
          <p className="page-subtitle">Vehicle valuation production · jobs, value &amp; staff performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NotificationBell />
          <Link href="/production/entries" className="btn-secondary">
            Register
          </Link>
          <Link href="/production/reports" className="btn-secondary">
            Reports
          </Link>
          <button type="button" className="btn-secondary" onClick={refresh} disabled={loading || chartsLoading}>
            <RefreshCw className={`h-4 w-4 ${loading || chartsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link href="/production/entries/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New entry
          </Link>
        </div>
      </div>

      {loading || !summary ? (
        <div className="section-card text-sm text-slate-500">Loading production KPIs…</div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              href={registerHref({ fromDate: today, toDate: today })}
              label="Today's production"
              value={`${k?.todayJobs ?? 0} jobs`}
              sub={formatMoney(k?.todayAmount ?? 0)}
              accent
            />
            <KpiCard
              href={registerHref({ fromDate: weekFrom, toDate: today })}
              label="This week"
              value={`${k?.weekJobs ?? 0} jobs`}
              sub={formatMoney(k?.weekAmount ?? 0)}
              accent
            />
            <KpiCard
              href={registerHref({ fromDate: monthFrom, toDate: today })}
              label="This month"
              value={`${k?.monthJobs ?? 0} jobs`}
              sub={formatMoney(k?.monthAmount ?? 0)}
              accent
            />
            <KpiCard
              href={registerHref({})}
              label="Total jobs"
              value={String(k?.totalJobs ?? 0)}
              sub={formatMoney(k?.totalAmount ?? 0)}
              accent
            />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              href={registerHref({})}
              label="Total production value"
              value={formatMoney(k?.totalAmount ?? 0)}
              sub={`Without VAT ${formatMoney(k?.totalWithoutVat ?? 0)}`}
            />
            <KpiCard
              href="/production/reports"
              label="Avg per user"
              value={k?.avgPerUser != null ? formatMoney(k.avgPerUser) : '—'}
              sub={`Avg / job ${k?.avgPerJob != null ? formatMoney(k.avgPerJob) : '—'}`}
            />
            <Link
              href={
                k?.topStaffUserId
                  ? registerHref({ doneBy: k.topStaffUserId })
                  : k?.topStaff
                    ? registerHref({ q: k.topStaff })
                    : '/production/entries'
              }
              className="section-card group block !p-4 transition hover:border-brand-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-semibold uppercase text-slate-500">Top staff</p>
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                {k?.topStaff || '—'}
              </p>
              <p className="mt-2 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
                View their jobs →
              </p>
            </Link>
            <Link
              href={
                k?.topInsurerId
                  ? registerHref({ insurerId: k.topInsurerId })
                  : k?.topInsurer
                    ? registerHref({ q: k.topInsurer })
                    : '/production/entries'
              }
              className="section-card group block !p-4 transition hover:border-brand-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <p className="text-xs font-semibold uppercase text-slate-500">Top insurer</p>
              <p className="mt-1 text-lg font-bold text-slate-900 group-hover:text-brand-700">
                {k?.topInsurer || '—'}
              </p>
              <p className="mt-2 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100">
                View insurer jobs →
              </p>
            </Link>
          </div>

          {(summary.targets.daily || summary.targets.weekly || summary.targets.monthly) && (
            <div className="section-card mb-6">
              <h2 className="mb-3 text-sm font-semibold text-brand-800">Target progress</h2>
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
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`rounded-xl border px-3 py-2 transition hover:shadow-md ${
                        t.met ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">{key}</p>
                      <p className="text-sm font-bold text-slate-800">
                        {t.jobs}/{t.targetJobs} jobs · {formatMoney(t.amount)} /{' '}
                        {formatMoney(t.targetAmount)}
                      </p>
                      <p className="text-xs text-slate-500">{t.met ? 'Target met' : 'In progress'}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="section-card mb-6 !py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-brand-800">Graphs</h2>
                <p className="text-xs text-slate-500">
                  {periodLabel}: {formatDisplayDate(chartRange.fromDate)}
                  {chartRange.fromDate !== chartRange.toDate
                    ? ` → ${formatDisplayDate(chartRange.toDate)}`
                    : ''}
                  {ck ? ` · ${ck.totalJobs} jobs · ${formatMoney(ck.totalAmount)}` : ''}
                </p>
              </div>
              <Link
                href={registerHref({
                  fromDate: chartRange.fromDate,
                  toDate: chartRange.toDate,
                })}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                Open register for period →
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CHART_PERIODS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
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

          {chartsLoading || !chartSummary ? (
            <div className="section-card mb-6 text-sm text-slate-500">Loading graphs…</div>
          ) : (
            <>
              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">
                    {showDailyBars ? 'Production by day' : 'Daily production trend'}
                  </h2>
                  {showDailyBars ? (
                    <SimpleBarChart
                      hideEmpty={false}
                      items={chartSummary.dailyTrend.map((d) => ({
                        label: shortDayLabel(d.date),
                        value: d.jobs,
                      }))}
                    />
                  ) : (
                    <SimpleLineChart
                      points={chartSummary.dailyTrend.map((d) => ({
                        label: shortDayLabel(d.date),
                        a: d.jobs,
                        b: Math.round(d.amount / 1000),
                      }))}
                    />
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    {showDailyBars
                      ? 'Jobs per day in the selected period'
                      : 'Line B = amount ÷ 1000 for scale'}
                  </p>
                </div>
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">Production value by day</h2>
                  <SimpleBarChart
                    hideEmpty={false}
                    items={chartSummary.dailyTrend.map((d) => ({
                      label: shortDayLabel(d.date),
                      value: Math.round(d.amount),
                    }))}
                  />
                  <p className="mt-2 text-xs text-slate-500">Amount (incl. VAT) per day</p>
                </div>
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">
                    Production by insurer · {periodLabel}
                  </h2>
                  <SimpleHorizontalBars
                    items={chartSummary.byInsurer.slice(0, 10).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.jobs,
                    }))}
                  />
                </div>
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">
                    Production by Done By · {periodLabel}
                  </h2>
                  <SimpleHorizontalBars
                    items={chartSummary.byDoneBy.slice(0, 10).map((i) => ({
                      label: `${i.name} (${formatMoney(i.amount)})`,
                      value: i.amount,
                    }))}
                  />
                </div>
              </div>

              <div className="mb-6 grid gap-6 lg:grid-cols-2">
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">
                    By Seen By · {periodLabel}
                  </h2>
                  <SimpleHorizontalBars
                    items={chartSummary.bySeenBy.slice(0, 8).map((i) => ({
                      label: i.name,
                      value: i.jobs,
                    }))}
                  />
                </div>
                <div className="section-card">
                  <h2 className="mb-4 text-sm font-semibold text-brand-800">
                    By Instructed By · {periodLabel}
                  </h2>
                  <SimpleHorizontalBars
                    items={chartSummary.byInstructedBy.slice(0, 8).map((i) => ({
                      label: i.name,
                      value: i.jobs,
                    }))}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/production/reports" className="btn-secondary">
              Open reports
            </Link>
            <a
              href={`/api/production/export?format=xlsx&pack=dashboard&fromDate=${chartRange.fromDate}&toDate=${chartRange.toDate}`}
              className="btn-secondary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </a>
            <a
              href={`/api/production/export?format=pdf&pack=dashboard&fromDate=${chartRange.fromDate}&toDate=${chartRange.toDate}`}
              className="btn-secondary"
            >
              Export PDF
            </a>
          </div>
        </>
      )}
    </div>
  );
}

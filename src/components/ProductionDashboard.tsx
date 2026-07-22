'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { formatMoney } from '@/lib/productionConfig';
import { SimpleBarChart, SimpleHorizontalBars, SimpleLineChart } from '@/components/SimpleCharts';
import { NotificationBell } from '@/components/NotificationBell';
import type { ProductionSummary } from '@/lib/productionAnalytics';

export function ProductionDashboard() {
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/production/analytics');
      const data = await res.json();
      setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const k = summary?.kpis;

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
          <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
            {[
              { label: "Today's production", value: `${k?.todayJobs ?? 0} jobs`, sub: formatMoney(k?.todayAmount ?? 0) },
              { label: 'This week', value: `${k?.weekJobs ?? 0} jobs`, sub: formatMoney(k?.weekAmount ?? 0) },
              { label: 'This month', value: `${k?.monthJobs ?? 0} jobs`, sub: formatMoney(k?.monthAmount ?? 0) },
              { label: 'Total jobs', value: String(k?.totalJobs ?? 0), sub: formatMoney(k?.totalAmount ?? 0) },
            ].map((card) => (
              <div key={card.label} className="section-card !p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-brand-800">{card.value}</p>
                <p className="text-sm text-slate-600">{card.sub}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="section-card !p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Total production value</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatMoney(k?.totalAmount ?? 0)}</p>
              <p className="text-xs text-slate-500">Without VAT {formatMoney(k?.totalWithoutVat ?? 0)}</p>
            </div>
            <div className="section-card !p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Avg per user</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {k?.avgPerUser != null ? formatMoney(k.avgPerUser) : '—'}
              </p>
              <p className="text-xs text-slate-500">
                Avg / job {k?.avgPerJob != null ? formatMoney(k.avgPerJob) : '—'}
              </p>
            </div>
            <div className="section-card !p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <p className="text-xs font-semibold uppercase text-slate-500">Top staff</p>
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">{k?.topStaff || '—'}</p>
            </div>
            <div className="section-card !p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Top insurer</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{k?.topInsurer || '—'}</p>
            </div>
          </div>

          {(summary.targets.daily || summary.targets.weekly || summary.targets.monthly) && (
            <div className="section-card mb-6">
              <h2 className="mb-3 text-sm font-semibold text-brand-800">Target progress</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {(['daily', 'weekly', 'monthly'] as const).map((key) => {
                  const t = summary.targets[key];
                  if (!t) return null;
                  return (
                    <div
                      key={key}
                      className={`rounded-xl border px-3 py-2 ${
                        t.met ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase text-slate-500">{key}</p>
                      <p className="text-sm font-bold text-slate-800">
                        {t.jobs}/{t.targetJobs} jobs · {formatMoney(t.amount)} / {formatMoney(t.targetAmount)}
                      </p>
                      <p className="text-xs text-slate-500">{t.met ? 'Target met' : 'In progress'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Daily production trend</h2>
              <SimpleLineChart
                points={summary.dailyTrend.map((d) => ({
                  label: d.date,
                  a: d.jobs,
                  b: Math.round(d.amount / 1000),
                }))}
              />
              <p className="mt-2 text-xs text-slate-500">Line B = amount ÷ 1000 for scale</p>
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Monthly trend</h2>
              <SimpleBarChart
                hideEmpty
                items={summary.monthlyTrend.map((m) => ({
                  label: m.month,
                  value: m.jobs,
                }))}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Production by insurer</h2>
              <SimpleHorizontalBars
                items={summary.byInsurer.slice(0, 10).map((i) => ({
                  label: `${i.name} (${formatMoney(i.amount)})`,
                  value: i.jobs,
                }))}
              />
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Production by Done By</h2>
              <SimpleHorizontalBars
                items={summary.byDoneBy.slice(0, 10).map((i) => ({
                  label: `${i.name} (${formatMoney(i.amount)})`,
                  value: i.jobs,
                }))}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">By Seen By</h2>
              <SimpleHorizontalBars
                items={summary.bySeenBy.slice(0, 8).map((i) => ({
                  label: i.name,
                  value: i.jobs,
                }))}
              />
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">By Instructed By</h2>
              <SimpleHorizontalBars
                items={summary.byInstructedBy.slice(0, 8).map((i) => ({
                  label: i.name,
                  value: i.jobs,
                }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/production/reports" className="btn-secondary">
              Open reports
            </Link>
            <a href="/api/production/export?format=xlsx&pack=dashboard" className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </a>
          </div>
        </>
      )}
    </div>
  );
}

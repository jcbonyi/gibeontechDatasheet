'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import type { ProductionSummary } from '@/lib/productionAnalytics';
import { formatMoney } from '@/lib/productionConfig';
import { SimpleBarChart, SimpleHorizontalBars } from '@/components/SimpleCharts';

export function ProductionReportsHub() {
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<ProductionSummary | null>(null);
  const [tab, setTab] = useState<'daily' | 'weekly' | 'monthly' | 'staff' | 'insurer'>('daily');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ fromDate, toDate });
    const res = await fetch(`/api/production/analytics?${params}`);
    const data = await res.json();
    setSummary(data.summary || null);
  }, [fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const exportHref = (format: string) =>
    `/api/production/export?format=${format}&pack=${tab}&fromDate=${fromDate}&toDate=${toDate}`;

  const k = summary?.kpis;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Production reports</h1>
          <p className="page-subtitle">Daily, weekly, monthly, staff &amp; insurer analytics</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={exportHref('xlsx')} className="btn-secondary">
            <Download className="h-4 w-4" />
            Excel
          </a>
          <a href={exportHref('pdf')} className="btn-secondary">
            PDF
          </a>
          <Link href="/production" className="btn-secondary">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="section-card mb-4 grid gap-3 sm:grid-cols-3">
        <input type="date" className="form-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input type="date" className="form-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button type="button" className="btn-secondary" onClick={load}>
          Apply period
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ['daily', 'Daily'],
            ['weekly', 'Weekly'],
            ['monthly', 'Monthly'],
            ['staff', 'Staff performance'],
            ['insurer', 'Insurer analytics'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === key ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!summary ? (
        <div className="section-card text-sm text-slate-500">Loading report…</div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="section-card !p-4">
              <p className="text-xs uppercase text-slate-500">Jobs</p>
              <p className="text-2xl font-bold">{k?.totalJobs ?? 0}</p>
            </div>
            <div className="section-card !p-4">
              <p className="text-xs uppercase text-slate-500">Total amount</p>
              <p className="text-2xl font-bold">{formatMoney(k?.totalAmount ?? 0)}</p>
            </div>
            <div className="section-card !p-4">
              <p className="text-xs uppercase text-slate-500">Without VAT</p>
              <p className="text-2xl font-bold">{formatMoney(k?.totalWithoutVat ?? 0)}</p>
            </div>
            <div className="section-card !p-4">
              <p className="text-xs uppercase text-slate-500">Avg / day</p>
              <p className="text-2xl font-bold">{k?.avgJobsPerDay ?? '—'}</p>
            </div>
          </div>

          {(tab === 'daily' || tab === 'weekly' || tab === 'monthly') && (
            <div className="mb-6 grid gap-6 lg:grid-cols-2">
              <div className="section-card">
                <h2 className="mb-4 text-sm font-semibold text-brand-800">
                  {tab === 'daily' ? 'Daily' : tab === 'weekly' ? 'Weekly' : 'Monthly'} jobs
                </h2>
                <SimpleBarChart
                  hideEmpty
                  items={(tab === 'daily'
                    ? summary.dailyTrend.map((d) => ({ label: d.date.slice(5), value: d.jobs }))
                    : tab === 'weekly'
                      ? summary.weeklyTrend.map((d) => ({ label: d.week.slice(5), value: d.jobs }))
                      : summary.monthlyTrend.map((d) => ({ label: d.month, value: d.jobs }))
                  )}
                />
              </div>
              <div className="section-card">
                <h2 className="mb-4 text-sm font-semibold text-brand-800">Grouped by Done By</h2>
                <SimpleHorizontalBars
                  items={summary.byDoneBy.map((r) => ({
                    label: `${r.name} · ${formatMoney(r.amount)}`,
                    value: r.jobs,
                  }))}
                />
              </div>
            </div>
          )}

          {tab === 'staff' && (
            <div className="section-card overflow-x-auto">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Staff leaderboard (Done By)</h2>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Jobs</th>
                    <th>Total value</th>
                    <th>Avg value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.staffLeaderboard.map((s, i) => (
                    <tr key={s.name}>
                      <td>{i + 1}</td>
                      <td className="font-semibold">{s.name}</td>
                      <td>{s.jobs}</td>
                      <td>{formatMoney(s.amount)}</td>
                      <td>{s.avgValue != null ? formatMoney(s.avgValue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Top Seen By</h3>
                  <SimpleHorizontalBars
                    items={summary.bySeenBy.slice(0, 5).map((r) => ({ label: r.name, value: r.jobs }))}
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Top Instructed By</h3>
                  <SimpleHorizontalBars
                    items={summary.byInstructedBy.slice(0, 5).map((r) => ({ label: r.name, value: r.jobs }))}
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Top Done By</h3>
                  <SimpleHorizontalBars
                    items={summary.byDoneBy.slice(0, 5).map((r) => ({ label: r.name, value: r.jobs }))}
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'insurer' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="section-card">
                <h2 className="mb-4 text-sm font-semibold text-brand-800">Insurer comparison (jobs)</h2>
                <SimpleBarChart
                  hideEmpty
                  items={summary.byInsurer.slice(0, 10).map((i) => ({
                    label: i.name.slice(0, 12),
                    value: i.jobs,
                  }))}
                />
              </div>
              <div className="section-card overflow-x-auto">
                <h2 className="mb-4 text-sm font-semibold text-brand-800">Insurer detail</h2>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Insurer</th>
                      <th>Jobs</th>
                      <th>Amount</th>
                      <th>Avg job</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byInsurer.map((i) => (
                      <tr key={i.name}>
                        <td>{i.name}</td>
                        <td>{i.jobs}</td>
                        <td>{formatMoney(i.amount)}</td>
                        <td>{i.jobs ? formatMoney(i.amount / i.jobs) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

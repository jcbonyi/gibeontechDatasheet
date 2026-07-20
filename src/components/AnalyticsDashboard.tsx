'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet, FileText, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canViewAllDatasheets } from '@/lib/permissions';
import { SLA_DAYS, type AnalyticsSummary } from '@/lib/tracking';
import { STATUS_LABELS } from '@/lib/status';
import { SimpleBarChart, SimpleHorizontalBars, SimpleLineChart } from '@/components/SimpleCharts';
import { StatusBadge } from '@/components/StatusBadge';

interface AssessorOption {
  id: number;
  name: string;
}

export function AnalyticsDashboard() {
  const { user } = useAuth();
  const viewAll = user ? canViewAllDatasheets(user.role) : false;
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [assessorId, setAssessorId] = useState('');
  const [assessors, setAssessors] = useState<AssessorOption[]>([]);

  const queryString = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (assessorId) params.set('assessorId', assessorId);
    return params.toString();
  }, [assessorId, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = queryString();
    const res = await fetch(`/api/analytics${qs ? `?${qs}` : ''}`);
    const data = await res.json();
    setSummary(data.summary || null);
    setLoading(false);
  }, [queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!viewAll) return;
    fetch('/api/users/assessors')
      .then((r) => r.json())
      .then((d) => setAssessors(d.assessors || []));
  }, [viewAll]);

  const download = (pack: string, format: string) => {
    const params = new URLSearchParams(queryString());
    params.set('pack', pack);
    params.set('format', format);
    window.location.href = `/api/reports/export?${params}`;
  };

  const kpis = summary?.kpis;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Operations home</h1>
          <p className="page-subtitle">
            Portfolio tracking for assessments, inspections &amp; reports · ageing from Date of Instruction · SLA {SLA_DAYS} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => download('register', 'xlsx')} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" />
            Excel register
          </button>
          <button type="button" onClick={() => download('ops', 'xlsx')} className="btn-secondary">
            <Download className="h-4 w-4" />
            Excel ops pack
          </button>
          <button type="button" onClick={() => download('analytics-pdf', 'pdf')} className="btn-secondary">
            <FileText className="h-4 w-4" />
            PDF report
          </button>
          <Link href="/datasheets" className="btn-primary">
            Open task board
          </Link>
        </div>
      </div>

      <div className="section-card mb-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" title="From date" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input" title="To date" />
          {viewAll && (
            <select value={assessorId} onChange={(e) => setAssessorId(e.target.value)} className="form-input">
              <option value="">All assessors</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={load} className="btn-secondary">
            <Search className="h-4 w-4" />
            Apply filters
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="section-card flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading analytics…
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Total', value: kpis?.total ?? 0, className: 'text-brand-700' },
              { label: 'Open tasks', value: kpis?.open ?? 0, className: 'text-sky-700' },
              { label: 'Overdue', value: kpis?.overdue ?? 0, className: 'text-red-700' },
              {
                label: 'SLA compliance',
                value: kpis?.slaCompliancePct != null ? `${kpis.slaCompliancePct}%` : '—',
                className: 'text-emerald-700',
              },
              {
                label: 'Avg open age',
                value: kpis?.avgAgeDays != null ? `${kpis.avgAgeDays}d` : '—',
                className: 'text-amber-700',
              },
              { label: 'Reports issued', value: kpis?.approvedInPeriod ?? 0, className: 'text-violet-700' },
            ].map((card) => (
              <div key={card.label} className="section-card py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <p className={`mt-1 text-2xl font-bold ${card.className}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="section-card mb-6">
            <h2 className="mb-3 text-sm font-semibold text-brand-800">Cycle time (from audit trail)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-slate-500">Instructed → Report issued</p>
                <p className="text-xl font-bold text-slate-800">
                  {summary.cycleTime.avgInstructedToIssuedDays != null
                    ? `${summary.cycleTime.avgInstructedToIssuedDays}d`
                    : '—'}
                </p>
                <p className="text-xs text-slate-400">{summary.cycleTime.sampleSizeIssued} samples</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Avg days In Progress</p>
                <p className="text-xl font-bold text-slate-800">
                  {summary.cycleTime.avgInProgressDays != null
                    ? `${summary.cycleTime.avgInProgressDays}d`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Avg days Under Review</p>
                <p className="text-xl font-bold text-slate-800">
                  {summary.cycleTime.avgUnderReviewDays != null
                    ? `${summary.cycleTime.avgUnderReviewDays}d`
                    : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Pipeline by status</h2>
              <SimpleBarChart
                items={summary.byStatus
                  .filter((s) => s.count > 0)
                  .map((s) => ({
                    label: STATUS_LABELS[s.status],
                    value: s.count,
                  }))}
              />
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Ageing by Date of Instruction</h2>
              <SimpleBarChart
                items={summary.byAgeBand.map((b) => ({
                  label: b.label,
                  value: b.count,
                  color:
                    b.band === '15+'
                      ? '#EF4444'
                      : b.band === '8-14'
                        ? '#F59E0B'
                        : b.band === 'unknown'
                          ? '#94A3B8'
                          : undefined,
                }))}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Volume by month</h2>
              <SimpleLineChart
                points={summary.volumeByMonth.map((m) => ({
                  label: m.month,
                  a: m.created,
                  b: m.approved,
                }))}
              />
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Top insurers</h2>
              <SimpleHorizontalBars
                items={summary.byInsurer.map((i) => ({
                  label: `${i.name}${i.slaPct != null ? ` (${i.slaPct}% SLA)` : ''}`,
                  value: i.count,
                }))}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Assessor workload</h2>
              <SimpleHorizontalBars
                items={summary.byAssessor.slice(0, 10).map((a) => ({
                  label: a.name,
                  value: a.open,
                  color: a.overdue > 0 ? '#EF4444' : '#3F3D99',
                }))}
              />
              <p className="mt-3 text-xs text-slate-500">Bars show open (not approved) count. Red = has overdue items.</p>
            </div>
            <div className="section-card">
              <h2 className="mb-4 text-sm font-semibold text-brand-800">Form type mix</h2>
              <SimpleHorizontalBars
                items={summary.byFormType.map((f) => ({ label: f.type, value: f.count }))}
              />
            </div>
          </div>

          <div className="section-card overflow-x-auto">
            <h2 className="mb-4 text-sm font-semibold text-brand-800">Open ageing queue</h2>
            {summary.agingQueue.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No open datasheets in this filter.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Serial</th>
                    <th>Claim</th>
                    <th>Reg</th>
                    <th>Insurer</th>
                    <th>Status</th>
                    <th>Instruction</th>
                    <th>Age</th>
                    <th>Assessor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {summary.agingQueue.map((row) => (
                    <tr key={row.id}>
                      <td className="font-semibold text-brand-800">{row.serial_no}</td>
                      <td>{row.claim_no || '—'}</td>
                      <td>{row.reg_no || '—'}</td>
                      <td>{row.client_insurer || '—'}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>{row.date_of_instruction || '—'}</td>
                      <td>
                        <span
                          className={
                            row.age_days != null && row.age_days > SLA_DAYS
                              ? 'font-semibold text-red-700'
                              : 'text-slate-700'
                          }
                        >
                          {row.age_days != null ? `${row.age_days}d` : '—'}
                        </span>
                      </td>
                      <td>{row.assigned_to_name || '—'}</td>
                      <td>
                        <Link href={`/datasheets/${row.id}`} className="font-medium text-brand-600 hover:text-brand-800">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

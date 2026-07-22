'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Search,
  UserRoundX,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { canViewAllDatasheets } from '@/lib/permissions';
import {
  AT_RISK_FROM_DAY,
  SLA_DAYS,
  type AnalyticsSummary,
  type QueuePriority,
} from '@/lib/tracking';
import { STATUS_LABELS } from '@/lib/status';
import { SimpleBarChart, SimpleHorizontalBars, SimpleLineChart } from '@/components/SimpleCharts';
import { StatusBadge } from '@/components/StatusBadge';

interface AssessorOption {
  id: number;
  name: string;
}

type QueueFilter = 'attention' | 'overdue' | 'at_risk' | 'unassigned' | 'review' | 'all';

const PRIORITY_META: Record<
  QueuePriority,
  { label: string; className: string }
> = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-800 ring-red-200' },
  overdue: { label: 'Overdue', className: 'bg-orange-100 text-orange-900 ring-orange-200' },
  unassigned: { label: 'Unassigned', className: 'bg-slate-200 text-slate-800 ring-slate-300' },
  at_risk: { label: 'At risk', className: 'bg-amber-100 text-amber-900 ring-amber-200' },
  review: { label: 'Needs review', className: 'bg-violet-100 text-violet-800 ring-violet-200' },
  normal: { label: 'Open', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function slaTone(pct: number | null | undefined): string {
  if (pct == null) return 'text-slate-700';
  if (pct >= 90) return 'text-emerald-700';
  if (pct >= 75) return 'text-amber-700';
  return 'text-red-700';
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
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('attention');

  const queryString = useCallback(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    if (assessorId) params.set('assessorId', assessorId);
    return params.toString();
  }, [assessorId, fromDate, toDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString();
      const res = await fetch(`/api/analytics${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
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

  const applyPreset = (preset: 'all' | '30' | 'month' | '7') => {
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    if (preset === 'month') {
      setFromDate(monthStart());
      setToDate(dateOffset(0));
      return;
    }
    if (preset === '7') {
      setFromDate(dateOffset(-6));
      setToDate(dateOffset(0));
      return;
    }
    setFromDate(dateOffset(-29));
    setToDate(dateOffset(0));
  };

  const kpis = summary?.kpis;
  const decisions = summary?.decisions;

  const filteredQueue = useMemo(() => {
    if (!summary) return [];
    const rows = summary.agingQueue;
    switch (queueFilter) {
      case 'overdue':
        return rows.filter((r) => r.is_overdue);
      case 'at_risk':
        return rows.filter((r) => r.priority === 'at_risk');
      case 'unassigned':
        return rows.filter((r) => !r.assigned_to_name);
      case 'review':
        return rows.filter(
          (r) =>
            r.status === 'pending_review' ||
            r.status === 'under_review' ||
            r.status === 'queried',
        );
      case 'attention':
        return rows.filter((r) => r.priority !== 'normal');
      default:
        return rows;
    }
  }, [queueFilter, summary]);

  const bottleneckStages = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: 'awaiting_documents',
        label: 'Awaiting documents',
        count: decisions?.awaitingDocuments ?? 0,
        hint: 'Chase insurers / clients',
        href: '/datasheets?status=awaiting_documents',
      },
      {
        key: 'pending_review',
        label: 'Pending review',
        count: decisions?.pendingReview ?? 0,
        hint: 'Ready for sign-off',
        href: '/datasheets?status=pending_review',
      },
      {
        key: 'under_review',
        label: 'Under review',
        count: decisions?.underReview ?? 0,
        hint: 'Finish QA / issue report',
        href: '/datasheets?status=under_review',
      },
      {
        key: 'queried',
        label: 'Queried',
        count: decisions?.queried ?? 0,
        hint: 'Resolve queries to unblock',
        href: '/datasheets?status=queried',
      },
      {
        key: 'on_hold',
        label: 'On hold',
        count: decisions?.onHold ?? 0,
        hint: 'Decide resume or close',
        href: '/datasheets?status=on_hold',
      },
    ].filter((s) => s.count > 0);
  }, [decisions, summary]);

  const strainedAssessors = useMemo(() => {
    if (!summary) return [];
    return summary.byAssessor
      .filter((a) => a.name !== 'Unassigned' && (a.overdue > 0 || a.open >= 5))
      .slice(0, 6);
  }, [summary]);

  const attentionTotal = decisions?.attentionTotal ?? 0;
  const slaOk = (kpis?.slaCompliancePct ?? 100) >= 90;

  return (
    <div className="pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Management dashboard</h1>
          <p className="page-subtitle">
            What needs a decision today · SLA {SLA_DAYS} days from Date of Instruction
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={load} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={() => download('ops', 'xlsx')} className="btn-secondary">
            <Download className="h-4 w-4" />
            Ops Excel
          </button>
          <button type="button" onClick={() => download('analytics-pdf', 'pdf')} className="btn-secondary">
            <FileText className="h-4 w-4" />
            PDF brief
          </button>
          <Link href="/datasheets" className="btn-primary">
            Task board
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="section-card mb-6 !py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Period</span>
          {(
            [
              ['all', 'All time'],
              ['7', 'Last 7 days'],
              ['30', 'Last 30 days'],
              ['month', 'This month'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="form-input"
            title="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="form-input"
            title="To date"
          />
          {viewAll && (
            <select
              value={assessorId}
              onChange={(e) => setAssessorId(e.target.value)}
              className="form-input"
            >
              <option value="">All assessors</option>
              {assessors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={load} className="btn-secondary lg:col-span-1">
            <Search className="h-4 w-4" />
            Apply
          </button>
          <button
            type="button"
            onClick={() => download('register', 'xlsx')}
            className="btn-secondary"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Register
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="section-card flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading decision view…
        </div>
      ) : (
        <>
          {/* Attention banner */}
          <div
            className={`mb-6 overflow-hidden rounded-2xl border ${
              attentionTotal > 0
                ? 'border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-orange-50'
                : 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-teal-50'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-xl p-2 ${
                    attentionTotal > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {attentionTotal > 0 ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {attentionTotal > 0
                      ? `${attentionTotal} item${attentionTotal === 1 ? '' : 's'} need management attention`
                      : 'Portfolio is clear — no urgent decisions right now'}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {attentionTotal > 0
                      ? [
                          decisions && decisions.overdueCritical > 0
                            ? `${decisions.overdueCritical} critical (15d+)`
                            : null,
                          kpis && kpis.overdue > 0 ? `${kpis.overdue} overdue` : null,
                          decisions && decisions.unassigned > 0
                            ? `${decisions.unassigned} unassigned`
                            : null,
                          decisions && decisions.atRisk > 0
                            ? `${decisions.atRisk} approaching SLA`
                            : null,
                          decisions && decisions.pendingReview + decisions.underReview > 0
                            ? `${decisions.pendingReview + decisions.underReview} in review`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : `SLA compliance ${kpis?.slaCompliancePct != null ? `${kpis.slaCompliancePct}%` : '—'} · ${kpis?.open ?? 0} open tasks`}
                  </p>
                </div>
              </div>
              {attentionTotal > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQueueFilter('attention');
                    document.getElementById('action-queue')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-primary"
                >
                  Review action queue
                </button>
              )}
            </div>
          </div>

          {/* Decision KPIs */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setQueueFilter('overdue')}
              className="section-card group !p-4 text-left transition hover:border-red-200 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overdue</p>
                <Clock3 className="h-4 w-4 text-red-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-red-700">{kpis?.overdue ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">
                Past {SLA_DAYS}-day SLA
                {(decisions?.overdueCritical ?? 0) > 0
                  ? ` · ${decisions?.overdueCritical} at 15d+`
                  : ''}
              </p>
              <p className="mt-2 text-xs font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
                Open overdue queue →
              </p>
            </button>

            <button
              type="button"
              onClick={() => setQueueFilter('at_risk')}
              className="section-card group !p-4 text-left transition hover:border-amber-200 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">At risk</p>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-700">{decisions?.atRisk ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">
                Days {AT_RISK_FROM_DAY}–{SLA_DAYS} · chase before breach
              </p>
              <p className="mt-2 text-xs font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
                Open at-risk queue →
              </p>
            </button>

            <button
              type="button"
              onClick={() => setQueueFilter('unassigned')}
              className="section-card group !p-4 text-left transition hover:border-slate-300 hover:shadow-lg"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unassigned
                </p>
                <UserRoundX className="h-4 w-4 text-slate-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-800">{decisions?.unassigned ?? 0}</p>
              <p className="mt-1 text-xs text-slate-500">Need assessor allocation</p>
              <p className="mt-2 text-xs font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">
                Allocate now →
              </p>
            </button>

            <div className="section-card !p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  SLA compliance
                </p>
                <CheckCircle2 className={`h-4 w-4 ${slaOk ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
              <p className={`mt-2 text-3xl font-bold ${slaTone(kpis?.slaCompliancePct)}`}>
                {kpis?.slaCompliancePct != null ? `${kpis.slaCompliancePct}%` : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Target ≥90% · {kpis?.approvedInPeriod ?? 0} reports issued · avg open age{' '}
                {kpis?.avgAgeDays != null ? `${kpis.avgAgeDays}d` : '—'}
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Open portfolio
              </p>
              <p className="text-xl font-bold text-sky-800">{kpis?.open ?? 0}</p>
              <p className="text-xs text-slate-500">of {kpis?.total ?? 0} in filter</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Instructed → issued
              </p>
              <p className="text-xl font-bold text-slate-800">
                {summary.cycleTime.avgInstructedToIssuedDays != null
                  ? `${summary.cycleTime.avgInstructedToIssuedDays}d`
                  : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {summary.cycleTime.sampleSizeIssued} samples · in progress{' '}
                {summary.cycleTime.avgInProgressDays != null
                  ? `${summary.cycleTime.avgInProgressDays}d`
                  : '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Under review dwell
              </p>
              <p className="text-xl font-bold text-violet-800">
                {summary.cycleTime.avgUnderReviewDays != null
                  ? `${summary.cycleTime.avgUnderReviewDays}d`
                  : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {decisions?.pendingReview ?? 0} pending · {decisions?.underReview ?? 0} in review
              </p>
            </div>
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-5">
            {/* Action queue — primary decision surface */}
            <div id="action-queue" className="section-card xl:col-span-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-brand-800">Action queue</h2>
                  <p className="text-xs text-slate-500">
                    Prioritised for decisions — critical & overdue first
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ['attention', 'Needs action'],
                      ['overdue', 'Overdue'],
                      ['at_risk', 'At risk'],
                      ['unassigned', 'Unassigned'],
                      ['review', 'Review'],
                      ['all', 'All open'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setQueueFilter(key)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                        queueFilter === key
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredQueue.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-sm font-medium text-slate-700">Nothing in this view</p>
                  <p className="text-xs text-slate-500">Switch filter or clear period constraints</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Serial</th>
                        <th>Claim / Reg</th>
                        <th>Insurer</th>
                        <th>Status</th>
                        <th>Age</th>
                        <th>Owner</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQueue.map((row) => {
                        const meta = PRIORITY_META[row.priority];
                        return (
                          <tr key={row.id}>
                            <td>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td className="font-semibold text-brand-800">{row.serial_no}</td>
                            <td>
                              <div className="text-slate-800">{row.claim_no || '—'}</div>
                              <div className="text-xs text-slate-500">{row.reg_no || '—'}</div>
                            </td>
                            <td className="max-w-[9rem] truncate">{row.client_insurer || '—'}</td>
                            <td>
                              <StatusBadge status={row.status} />
                            </td>
                            <td>
                              <span
                                className={
                                  row.is_overdue
                                    ? 'font-semibold text-red-700'
                                    : row.priority === 'at_risk'
                                      ? 'font-semibold text-amber-700'
                                      : 'text-slate-700'
                                }
                              >
                                {row.age_days != null ? `${row.age_days}d` : '—'}
                              </span>
                            </td>
                            <td>{row.assigned_to_name || <span className="text-slate-400">Unassigned</span>}</td>
                            <td>
                              <Link
                                href={`/datasheets/${row.id}`}
                                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-800"
                              >
                                Decide
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Side decisions */}
            <div className="space-y-6 xl:col-span-2">
              <div className="section-card">
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-brand-600" />
                  <h2 className="text-sm font-semibold text-brand-800">Pipeline bottlenecks</h2>
                </div>
                {bottleneckStages.length === 0 ? (
                  <p className="text-sm text-slate-500">No staging backlog — pipeline is flowing.</p>
                ) : (
                  <ul className="space-y-2">
                    {bottleneckStages.map((stage) => (
                      <li key={stage.key}>
                        <Link
                          href={stage.href}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/60"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                            <p className="text-xs text-slate-500">{stage.hint}</p>
                          </div>
                          <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-brand-800 shadow-sm">
                            {stage.count}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="section-card">
                <div className="mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-600" />
                  <h2 className="text-sm font-semibold text-brand-800">Capacity alerts</h2>
                </div>
                {strainedAssessors.length === 0 ? (
                  <p className="text-sm text-slate-500">No overloaded assessors in this filter.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {strainedAssessors.map((a) => (
                      <li key={a.name} className="rounded-xl border border-slate-100 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{a.name}</p>
                          {a.overdue > 0 ? (
                            <span className="shrink-0 text-xs font-bold text-red-700">
                              {a.overdue} overdue
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs font-medium text-amber-700">
                              {a.open} open
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex gap-3 text-[11px] text-slate-500">
                          <span>{a.open} open</span>
                          <span>
                            Avg age {a.avgAgeDays != null ? `${a.avgAgeDays}d` : '—'}
                          </span>
                          <span>SLA {a.slaPct != null ? `${a.slaPct}%` : '—'}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (a.open / Math.max(...strainedAssessors.map((x) => x.open), 1)) * 100)}%`,
                              backgroundColor: a.overdue > 0 ? '#EF4444' : '#F59E0B',
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {(decisions?.unassigned ?? 0) > 0 && (
                  <Link
                    href="/datasheets?unallocated=1"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                  >
                    Assign {decisions?.unassigned} unallocated tasks
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Supporting analytics */}
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Portfolio trends</h2>
              <p className="text-xs text-slate-500">Context for capacity and insurer focus</p>
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Pipeline by status</h3>
              <SimpleBarChart
                hideEmpty
                items={summary.byStatus
                  .filter((s) => s.count > 0)
                  .map((s) => ({
                    label: STATUS_LABELS[s.status],
                    value: s.count,
                  }))}
              />
            </div>
            <div className="section-card">
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Ageing by instruction date</h3>
              <SimpleBarChart
                hideEmpty
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
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Volume by month</h3>
              <SimpleLineChart
                points={summary.volumeByMonth.map((m) => ({
                  label: m.month,
                  a: m.created,
                  b: m.approved,
                }))}
              />
            </div>
            <div className="section-card">
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Insurers · volume &amp; SLA</h3>
              <SimpleHorizontalBars
                items={summary.byInsurer.map((i) => ({
                  label: `${i.name}${i.slaPct != null ? ` · ${i.slaPct}% SLA` : ''}${
                    i.overdue > 0 ? ` · ${i.overdue} overdue` : ''
                  }`,
                  value: i.count,
                  color: i.overdue > 0 ? '#EF4444' : undefined,
                }))}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="section-card">
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Assessor workload (open)</h3>
              <SimpleHorizontalBars
                items={summary.byAssessor.slice(0, 10).map((a) => ({
                  label: a.name,
                  value: a.open,
                  color: a.overdue > 0 ? '#EF4444' : '#3F3D99',
                }))}
              />
              <p className="mt-3 text-xs text-slate-500">
                Red bars include overdue work — rebalance load from capacity alerts above.
              </p>
            </div>
            <div className="section-card">
              <h3 className="mb-4 text-sm font-semibold text-brand-800">Form type mix</h3>
              <SimpleHorizontalBars
                items={summary.byFormType.map((f) => ({ label: f.type, value: f.count }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

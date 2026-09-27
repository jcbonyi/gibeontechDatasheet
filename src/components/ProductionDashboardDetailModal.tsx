'use client';

import Link from 'next/link';
import { FileText, X } from 'lucide-react';
import { formatMoney, formatDisplayDate } from '@/lib/productionConfig';
import { formatDelayNotesSummary } from '@/lib/opsConfig';
import {
  datasheetRegisterHref,
  productionRegisterHref,
} from '@/lib/dashboardRegisterLinks';
import { normalizeStatus } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';
import {
  formatDatasheetAssignment,
  sumProductionByAssignment,
  type DatasheetDrillEntry,
  type ProductionDrillEntry,
} from '@/lib/productionDashboardDrillDown';
import { StatusBadge } from '@/components/StatusBadge';
import { SimpleCompareBars, SimpleLineChart } from '@/components/SimpleCharts';
import {
  downloadDashboardDetailModalPdf,
  downloadComparisonModalPdf,
} from '@/utils/pendingDatasheetModalPdf';

export type ProductionTotalsContext = {
  /** Label for the query window the modal represents */
  queryLabel: string;
  queryJobs: number;
  queryAmount: number;
  /** Month-to-date as at the query date */
  monthLabel: string;
  monthJobs: number;
  monthAmount: number;
  asOfDate: string;
};

export type CompareTrendPoint = {
  label: string;
  a: number;
  b: number;
  meta?: Record<string, string>;
};

export type ComparisonModalState = {
  kind: 'comparison';
  title: string;
  subtitle?: string;
  person?: string;
  primaryLabel: string;
  compareLabel: string;
  primaryJobs: number;
  primaryAmount: number;
  compareJobs: number;
  compareAmount: number;
  jobsDelta: number | null;
  amountDelta: number | null;
  primaryRows: ProductionDrillEntry[];
  compareRows: ProductionDrillEntry[];
  primaryTotalsContext: ProductionTotalsContext;
  compareTotalsContext: ProductionTotalsContext;
  jobsTrend: CompareTrendPoint[];
  amountTrend: CompareTrendPoint[];
};

export type DashboardDetailModalState =
  | {
      kind: 'production';
      title: string;
      subtitle?: string;
      rows: ProductionDrillEntry[];
      totalsContext?: ProductionTotalsContext;
    }
  | {
      kind: 'datasheet';
      title: string;
      subtitle?: string;
      rows: DatasheetDrillEntry[];
    }
  | ComparisonModalState
  | null;

function registerHrefForDetail(detail: NonNullable<DashboardDetailModalState>): string | null {
  if (detail.kind === 'comparison') {
    const ids = [...detail.primaryRows, ...detail.compareRows].map((r) => r.id);
    return ids.length ? productionRegisterHref(ids) : null;
  }
  if (!detail.rows.length) return null;
  const ids = detail.rows.map((r) => r.id);
  return detail.kind === 'production'
    ? productionRegisterHref(ids)
    : datasheetRegisterHref(ids);
}

function TotalsContextCards({ ctx }: { ctx: ProductionTotalsContext }) {
  return (
    <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
      <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-2.5 py-1.5">
        <p className="font-semibold uppercase tracking-wide text-brand-700">Query total</p>
        <p className="mt-0.5 text-slate-800">
          {ctx.queryJobs} jobs · <span className="font-bold">{formatMoney(ctx.queryAmount)}</span>
        </p>
        <p className="truncate text-[10px] text-slate-500">{ctx.queryLabel}</p>
      </div>
      <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-2.5 py-1.5">
        <p className="font-semibold uppercase tracking-wide text-teal-800">
          Month production as at {formatDisplayDate(ctx.asOfDate)}
        </p>
        <p className="mt-0.5 text-slate-800">
          {ctx.monthJobs} jobs · <span className="font-bold">{formatMoney(ctx.monthAmount)}</span>
        </p>
        <p className="truncate text-[10px] text-slate-500">{ctx.monthLabel}</p>
      </div>
    </div>
  );
}

function ProductionRowsTable({ rows }: { rows: ProductionDrillEntry[] }) {
  if (!rows.length) {
    return <p className="py-4 text-center text-sm text-slate-500">No matching records.</p>;
  }
  const productionTotals = sumProductionByAssignment(rows);
  return (
    <div className="space-y-4">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Reg.</th>
            <th>Insurer</th>
            <th>Assignment</th>
            <th>Done by</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-slate-600">
                {formatDisplayDate(r.production_date.slice(0, 10))}
              </td>
              <td className="font-medium text-brand-800">
                <Link href={`/production/entries/${r.id}`} className="hover:text-brand-600">
                  {r.registration_number}
                </Link>
              </td>
              <td>{r.insurer_name || '—'}</td>
              <td>{r.assignment || '—'}</td>
              <td>{r.done_by_name || '—'}</td>
              <td className="font-semibold tabular-nums">{formatMoney(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
        <h3 className="text-sm font-semibold text-brand-800">Totals by assignment</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-brand-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-3 font-semibold">Assignment</th>
              <th className="pb-2 pr-3 text-right font-semibold">Jobs</th>
              <th className="pb-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {productionTotals.totals.map((t) => (
              <tr key={t.name} className="border-b border-white/80">
                <td className="py-2 pr-3 font-medium text-slate-800">Total {t.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{t.jobs}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-slate-900">
                  {formatMoney(t.amount)}
                </td>
              </tr>
            ))}
            <tr>
              <td className="pt-3 pr-3 text-sm font-bold text-brand-800">Modal total</td>
              <td className="pt-3 pr-3 text-right text-sm font-bold tabular-nums text-brand-800">
                {rows.length}
              </td>
              <td className="pt-3 text-right text-sm font-bold tabular-nums text-brand-800">
                {formatMoney(productionTotals.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductionDashboardDetailModal({
  detail,
  onClose,
}: {
  detail: DashboardDetailModalState;
  onClose: () => void;
}) {
  if (!detail) return null;

  const isComparison = detail.kind === 'comparison';
  const isDatasheet = detail.kind === 'datasheet';
  const count = isComparison
    ? detail.primaryRows.length + detail.compareRows.length
    : detail.rows.length;
  const registerHref = registerHrefForDetail(detail);
  const productionTotals =
    detail.kind === 'production' && detail.rows.length
      ? sumProductionByAssignment(detail.rows)
      : null;

  const handleGeneratePdf = () => {
    if (detail.kind === 'comparison') {
      downloadComparisonModalPdf(detail);
      return;
    }
    if (detail.kind === 'production') {
      downloadDashboardDetailModalPdf({
        kind: 'production',
        title: detail.title,
        subtitle: detail.subtitle,
        rows: detail.rows,
        totalsContext: detail.totalsContext,
      });
    } else {
      downloadDashboardDetailModalPdf({
        kind: 'datasheet',
        title: detail.title,
        subtitle: detail.subtitle,
        rows: detail.rows,
      });
    }
  };

  const legendA = detail.kind === 'comparison'
    ? detail.person
      ? `${detail.person} · A`
      : 'Period A'
    : 'Period A';
  const legendB = detail.kind === 'comparison'
    ? detail.person
      ? `${detail.person} · B`
      : 'Period B'
    : 'Period B';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-detail-title"
      onClick={onClose}
    >
      <div
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl border border-white/80 bg-white shadow-xl ${
          isComparison ? 'max-w-6xl' : isDatasheet ? 'max-w-6xl' : 'max-w-5xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id="dashboard-detail-title" className="text-lg font-bold text-slate-900">
              {detail.title}
            </h2>
            {detail.subtitle ? (
              <p className="mt-0.5 text-sm text-slate-500">{detail.subtitle}</p>
            ) : null}
            {!isComparison ? (
              <>
                <p className="mt-1 text-xs font-semibold text-brand-700">
                  {count} {count === 1 ? 'record' : 'records'}
                  {productionTotals ? (
                    <span className="ml-2 font-bold text-slate-800">
                      · {formatMoney(productionTotals.grandTotal)}
                    </span>
                  ) : null}
                </p>
                {detail.kind === 'production' && detail.totalsContext ? (
                  <TotalsContextCards ctx={detail.totalsContext} />
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-xs font-semibold text-brand-700">
                {count} records across both periods
                {detail.person ? ` · ${detail.person}` : ' · overall'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">
          {isComparison ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                    Period A
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{detail.primaryLabel}</p>
                  <p className="mt-2 text-xl font-bold text-brand-900">
                    {detail.primaryJobs}{' '}
                    <span className="text-sm font-semibold">jobs</span>
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatMoney(detail.primaryAmount)}
                  </p>
                  <TotalsContextCards ctx={detail.primaryTotalsContext} />
                </div>
                <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                    Period B
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{detail.compareLabel}</p>
                  <p className="mt-2 text-xl font-bold text-teal-900">
                    {detail.compareJobs}{' '}
                    <span className="text-sm font-semibold">jobs</span>
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatMoney(detail.compareAmount)}
                  </p>
                  {detail.jobsDelta != null && (
                    <p
                      className={`mt-1 text-xs font-semibold ${
                        detail.jobsDelta >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      Jobs {detail.jobsDelta >= 0 ? '+' : ''}
                      {detail.jobsDelta}% vs A
                      {detail.amountDelta != null
                        ? ` · Value ${detail.amountDelta >= 0 ? '+' : ''}${detail.amountDelta}%`
                        : ''}
                    </p>
                  )}
                  <TotalsContextCards ctx={detail.compareTotalsContext} />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-brand-800">Jobs trend · A vs B</h3>
                  <SimpleCompareBars
                    legendA={legendA}
                    legendB={legendB}
                    items={detail.jobsTrend}
                    height={160}
                  />
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-brand-800">Value trend · A vs B</h3>
                  <SimpleLineChart
                    legendA={`${legendA} value`}
                    legendB={`${legendB} value`}
                    points={detail.amountTrend}
                    height={140}
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-brand-800">Period A records</h3>
                  <ProductionRowsTable rows={detail.primaryRows} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-teal-800">Period B records</h3>
                  <ProductionRowsTable rows={detail.compareRows} />
                </div>
              </div>
            </div>
          ) : count === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No matching records.</p>
          ) : detail.kind === 'production' ? (
            <ProductionRowsTable rows={detail.rows} />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Claim</th>
                  <th>Reg.</th>
                  <th>Assignment</th>
                  <th>Status</th>
                  <th>Insurer</th>
                  <th>Assessor</th>
                  <th>Repairer</th>
                  <th>Age</th>
                  <th className="min-w-[12rem]">Delay note</th>
                </tr>
              </thead>
              <tbody>
                {detail.rows.map((r) => {
                  const delaySummary = formatDelayNotesSummary(r.delay_notes);
                  return (
                    <tr key={r.id} className={r.is_overdue ? 'bg-red-50/40' : undefined}>
                      <td className="whitespace-nowrap font-semibold text-brand-800">
                        <Link href={`/datasheets/${r.id}`} className="hover:text-brand-600">
                          {r.serial_no}
                        </Link>
                      </td>
                      <td>{r.claim_no || '—'}</td>
                      <td>{r.reg_no || '—'}</td>
                      <td className="text-slate-700">
                        {formatDatasheetAssignment(r.form_types)}
                      </td>
                      <td>
                        <StatusBadge status={normalizeStatus(r.status) as DatasheetStatus} />
                      </td>
                      <td>{r.client_insurer || '—'}</td>
                      <td>{r.assigned_to_name || r.created_by_name || '—'}</td>
                      <td
                        className="max-w-[10rem] text-xs text-slate-700"
                        title={r.repairer || undefined}
                      >
                        {r.repairer || '—'}
                      </td>
                      <td className="whitespace-nowrap">
                        {r.age_days != null ? (
                          <span className={r.is_overdue ? 'font-semibold text-red-700' : ''}>
                            {r.age_days}d
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className="max-w-xs text-xs leading-relaxed text-slate-600"
                        title={delaySummary !== '—' ? delaySummary : undefined}
                      >
                        {delaySummary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {isComparison || count > 0 ? (
            <button type="button" className="btn-secondary text-sm" onClick={handleGeneratePdf}>
              <FileText className="h-4 w-4" />
              Generate PDF
            </button>
          ) : null}
          {registerHref ? (
            <Link href={registerHref} className="btn-secondary text-sm">
              Open in register
            </Link>
          ) : null}
          <button type="button" className="btn-primary text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

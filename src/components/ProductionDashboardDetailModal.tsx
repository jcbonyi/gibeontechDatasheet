'use client';

import Link from 'next/link';
import { FileText, X } from 'lucide-react';
import { formatMoney, formatDisplayDate } from '@/lib/productionConfig';
import { formatDelayNotesSummary } from '@/lib/opsConfig';
import { normalizeStatus } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';
import type { DatasheetDrillEntry, ProductionDrillEntry } from '@/lib/productionDashboardDrillDown';
import { StatusBadge } from '@/components/StatusBadge';
import { downloadPendingDatasheetModalPdf } from '@/utils/pendingDatasheetModalPdf';

export type DashboardDetailModalState =
  | {
      kind: 'production';
      title: string;
      subtitle?: string;
      rows: ProductionDrillEntry[];
      registerHref?: string;
    }
  | {
      kind: 'datasheet';
      title: string;
      subtitle?: string;
      rows: DatasheetDrillEntry[];
      registerHref?: string;
    }
  | null;

export function ProductionDashboardDetailModal({
  detail,
  onClose,
}: {
  detail: DashboardDetailModalState;
  onClose: () => void;
}) {
  if (!detail) return null;

  const count = detail.rows.length;
  const isDatasheet = detail.kind === 'datasheet';

  const handleGeneratePdf = () => {
    if (detail.kind !== 'datasheet') return;
    downloadPendingDatasheetModalPdf(detail.title, detail.subtitle, detail.rows);
  };

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
          isDatasheet ? 'max-w-6xl' : 'max-w-4xl'
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
            <p className="mt-1 text-xs font-semibold text-brand-700">
              {count} {count === 1 ? 'record' : 'records'}
            </p>
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
          {count === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No matching records.</p>
          ) : detail.kind === 'production' ? (
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
                {detail.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-slate-600">
                      {formatDisplayDate(r.production_date.slice(0, 10))}
                    </td>
                    <td className="font-medium text-brand-800">
                      <Link
                        href={`/production/entries/${r.id}`}
                        className="hover:text-brand-600"
                      >
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
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Claim</th>
                  <th>Reg.</th>
                  <th>Status</th>
                  <th>Insurer</th>
                  <th>Assessor</th>
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
                      <td>
                        <StatusBadge status={normalizeStatus(r.status) as DatasheetStatus} />
                      </td>
                      <td>{r.client_insurer || '—'}</td>
                      <td>{r.assigned_to_name || r.created_by_name || '—'}</td>
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
          {isDatasheet && count > 0 ? (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={handleGeneratePdf}
            >
              <FileText className="h-4 w-4" />
              Generate PDF
            </button>
          ) : null}
          {detail.registerHref ? (
            <Link href={detail.registerHref} className="btn-secondary text-sm">
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

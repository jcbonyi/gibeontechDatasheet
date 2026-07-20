'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { SLA_DAYS } from '@/lib/tracking';
import { STATUS_LABELS, isOpenStatus } from '@/lib/status';
import type { DatasheetStatus } from '@/types/datasheet';
import { COMPANY } from '@/constants/brand';

interface Row {
  id: number;
  serial_no: string;
  status: DatasheetStatus;
  claim_no: string | null;
  reg_no: string | null;
  client_insurer: string | null;
  date_of_instruction: string | null;
  age_days: number | null;
  assigned_to_name?: string | null;
  is_overdue: boolean;
}

export function PrintQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/datasheets')
      .then((r) => r.json())
      .then((d) => {
        const list = ((d.datasheets || []) as Row[]).filter((r) => isOpenStatus(r.status));
        list.sort((a, b) => (b.age_days ?? -1) - (a.age_days ?? -1));
        setRows(list);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Open queue — print</h1>
          <p className="page-subtitle">
            Morning meeting sheet · open tasks sorted by age · SLA {SLA_DAYS} days
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="print-sheet rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 border-b border-slate-200 pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            {COMPANY.shortName}
          </p>
          <h2 className="text-xl font-bold text-slate-900">Open assessment queue</h2>
          <p className="text-sm text-slate-500">
            Printed {new Date().toLocaleString()} · {rows.length} open tasks
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No open tasks.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs uppercase text-slate-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Serial</th>
                <th className="py-2 pr-2">Claim / Reg</th>
                <th className="py-2 pr-2">Insurer</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Instruction</th>
                <th className="py-2 pr-2">Age</th>
                <th className="py-2">Assessor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-2 pr-2 font-semibold">{r.serial_no}</td>
                  <td className="py-2 pr-2">
                    {r.claim_no || '—'} / {r.reg_no || '—'}
                  </td>
                  <td className="py-2 pr-2">{r.client_insurer || '—'}</td>
                  <td className="py-2 pr-2">
                    <span className="no-print"><StatusBadge status={r.status} /></span>
                    <span className="hidden print:inline">{STATUS_LABELS[r.status]}</span>
                  </td>
                  <td className="py-2 pr-2">{r.date_of_instruction || '—'}</td>
                  <td className={`py-2 pr-2 ${r.is_overdue ? 'font-bold text-red-700' : ''}`}>
                    {r.age_days != null ? `${r.age_days}d` : '—'}
                  </td>
                  <td className="py-2">{r.assigned_to_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

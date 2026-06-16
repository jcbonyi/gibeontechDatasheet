'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from 'lucide-react';

interface DatasheetRow {
  id: number;
  serial_no: string;
  status: 'draft' | 'submitted';
  claim_no: string | null;
  reg_no: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = '' | 'draft' | 'submitted';

export function DatasheetRegister() {
  const [datasheets, setDatasheets] = useState<DatasheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimNo, setClaimNo] = useState('');
  const [regNo, setRegNo] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (claimNo) params.set('claimNo', claimNo);
    if (regNo) params.set('regNo', regNo);
    const res = await fetch(`/api/datasheets?${params}`);
    const data = await res.json();
    setDatasheets(data.datasheets || []);
    setLoading(false);
  }, [claimNo, regNo]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const submitted = datasheets.filter((d) => d.status === 'submitted').length;
    const drafts = datasheets.filter((d) => d.status === 'draft').length;
    return { total: datasheets.length, submitted, drafts };
  }, [datasheets]);

  const visibleDatasheets = useMemo(() => {
    if (!status) return datasheets;
    return datasheets.filter((d) => d.status === status);
  }, [datasheets, status]);

  const statCards: {
    key: StatusFilter;
    label: string;
    value: number;
    valueClass: string;
    activeClass: string;
  }[] = [
    {
      key: '',
      label: 'Total',
      value: stats.total,
      valueClass: 'text-brand-700',
      activeClass: 'ring-2 ring-brand-500 border-brand-200 bg-brand-50/60',
    },
    {
      key: 'submitted',
      label: 'Submitted',
      value: stats.submitted,
      valueClass: 'text-emerald-700',
      activeClass: 'ring-2 ring-emerald-500 border-emerald-200 bg-emerald-50/60',
    },
    {
      key: 'draft',
      label: 'Drafts',
      value: stats.drafts,
      valueClass: 'text-amber-700',
      activeClass: 'ring-2 ring-amber-500 border-amber-200 bg-amber-50/60',
    },
  ];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Datasheet Register</h1>
          <p className="page-subtitle">Motor claim assessment datasheets</p>
        </div>
        <Link href="/datasheets/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          New Datasheet
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {statCards.map((card) => {
          const isActive = status === card.key;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setStatus(card.key)}
              className={`section-card w-full py-4 text-left transition hover:shadow-md ${
                isActive ? card.activeClass : 'hover:border-slate-300'
              }`}
              aria-pressed={isActive}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${card.valueClass}`}>{card.value}</p>
              {isActive && card.key !== '' && (
                <p className="mt-1 text-xs font-medium text-slate-500">Filtered view</p>
              )}
            </button>
          );
        })}
      </div>

      <div className="section-card mb-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={claimNo}
            onChange={(e) => setClaimNo(e.target.value)}
            placeholder="Claim No."
            className="form-input"
          />
          <input
            value={regNo}
            onChange={(e) => setRegNo(e.target.value)}
            placeholder="Reg. No."
            className="form-input"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="form-input"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
          </select>
          <button type="button" onClick={load} className="btn-secondary">
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </div>

      <div className="section-card overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading datasheets…</p>
        ) : visibleDatasheets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">
              {datasheets.length === 0
                ? 'No datasheets found.'
                : 'No datasheets match the selected filter.'}
            </p>
            {datasheets.length === 0 ? (
              <Link href="/datasheets/new" className="btn-primary mt-4 inline-flex">
                Create your first datasheet
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setStatus('')}
                className="btn-secondary mt-4 inline-flex"
              >
                Show all
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial</th>
                <th>Claim No.</th>
                <th>Reg. No.</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleDatasheets.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold text-brand-800">{row.serial_no}</td>
                  <td>{row.claim_no || '—'}</td>
                  <td>{row.reg_no || '—'}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        row.status === 'submitted' ? 'status-submitted' : 'status-draft'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="text-slate-500">
                    {new Date(row.updated_at).toLocaleString()}
                  </td>
                  <td>
                    <Link
                      href={`/datasheets/${row.id}`}
                      className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-800"
                    >
                      <FileText className="h-4 w-4" />
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
